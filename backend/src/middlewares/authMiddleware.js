const mongoose = require('mongoose');

const Usuario = require('../models/Usuario');
const Sesion = require('../models/Sesion');
const config = require('../config/seguridad');
const { verificarToken } = require('../utils/seguridad');
const { leerTokenCookie, limpiarCookie } = require('../services/sesiones');

/*
 * =========================================================
 * AUTENTICACIÓN
 *
 * - El token llega en la cookie httpOnly de sesión.
 * - Verifica firma, algoritmo, emisor, audiencia y
 *   expiración del token.
 * - La sesión del equipo debe seguir abierta (se puede
 *   cerrar desde otro equipo o por el administrador).
 * - El usuario debe existir y estar activo.
 * - tokenVersion debe coincidir: al cambiar la contraseña,
 *   restablecerla o desactivar al usuario, todas sus
 *   sesiones abiertas dejan de ser válidas.
 * - Si debe cambiar su contraseña, solo puede acceder a
 *   las rutas marcadas con permitirCambioPendiente.
 * =========================================================
 */

/*
 * opcional: para consultar si hay sesión al abrir la app.
 * Sin sesión válida responde 200 { usuario: null } en lugar
 * de 401 (no es un error: simplemente hay que iniciar sesión).
 */
function crearAuthMiddleware({ permitirCambioPendiente = false, opcional = false } = {}) {
    const noAutorizado = (req, res, mensaje, codigo = 'SESION_INVALIDA') => {
        limpiarCookie(req, res);

        return opcional
            ? res.status(200).json({ usuario: null, mensaje, codigo })
            : res.status(401).json({ mensaje, codigo });
    };

    return async (req, res, next) => {
        try {
            const token = leerTokenCookie(req);

            if (!token) {
                return opcional
                    ? res.status(200).json({ usuario: null, codigo: 'SIN_SESION' })
                    : res.status(401).json({ mensaje: 'Inicia sesión para continuar.', codigo: 'SIN_SESION' });
            }

            let datos;

            try {
                datos = verificarToken(token);
            } catch (error) {
                return noAutorizado(
                    req,
                    res,
                    error.name === 'TokenExpiredError'
                        ? 'Tu sesión ha expirado. Inicia sesión nuevamente.'
                        : 'La sesión no es válida. Inicia sesión nuevamente.',
                    error.name === 'TokenExpiredError' ? 'SESION_EXPIRADA' : 'SESION_INVALIDA'
                );
            }

            if (
                !datos?.sub || !mongoose.isValidObjectId(datos.sub) ||
                !datos?.sid || !mongoose.isValidObjectId(datos.sid)
            ) {
                return noAutorizado(req, res, 'La sesión no es válida. Inicia sesión nuevamente.');
            }

            const sesion = await Sesion
                .findOne({ _id: datos.sid, usuario: datos.sub, expira: { $gt: new Date() } })
                .select('ultimaActividad')
                .lean();

            if (!sesion) {
                return noAutorizado(
                    req,
                    res,
                    'Tu sesión en este equipo se cerró. Inicia sesión nuevamente.',
                    'SESION_REVOCADA'
                );
            }

            const usuario = await Usuario.findById(datos.sub).select('+passwordHash');

            if (!usuario || !usuario.activo) {
                return noAutorizado(
                    req,
                    res,
                    'Tu usuario está inactivo o ya no existe. Contacta al administrador.',
                    'USUARIO_INACTIVO'
                );
            }

            if ((usuario.tokenVersion || 0) !== (datos.tv || 0)) {
                return noAutorizado(
                    req,
                    res,
                    'Tu sesión se cerró porque tu contraseña o tu acceso cambiaron. Inicia sesión nuevamente.',
                    'SESION_REVOCADA'
                );
            }

            if (usuario.debeCambiarPassword && !permitirCambioPendiente) {
                return res.status(403).json({
                    mensaje: 'Debes cambiar tu contraseña antes de continuar.',
                    codigo: 'CAMBIO_PASSWORD_REQUERIDO'
                });
            }

            // Última actividad del equipo (como máximo una escritura por minuto)
            if (Date.now() - new Date(sesion.ultimaActividad).getTime() > config.ACTIVIDAD_CADA_SEG * 1000) {
                await Sesion.updateOne({ _id: sesion._id }, { ultimaActividad: new Date() });
            }

            req.usuario = usuario;
            req.sesionId = sesion._id;

            return next();
        } catch (error) {
            console.error('Error de autenticación:', error);

            return res.status(500).json({
                mensaje: 'No fue posible validar la sesión. Intenta de nuevo.'
            });
        }
    };
}

const authMiddleware = crearAuthMiddleware();

// Solo para administradores
function requireAdmin(req, res, next) {
    if (req.usuario?.rol !== 'admin') {
        return res.status(403).json({
            mensaje: 'Esta acción requiere permisos de administrador.',
            codigo: 'SIN_PERMISO'
        });
    }

    return next();
}

module.exports = authMiddleware;
module.exports.crearAuthMiddleware = crearAuthMiddleware;
module.exports.requireAdmin = requireAdmin;
