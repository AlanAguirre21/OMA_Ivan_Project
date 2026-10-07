const mongoose = require('mongoose');

const Usuario = require('../models/Usuario');
const Sesion = require('../models/Sesion');
const config = require('../config/seguridad');
const {
    abrirSesion,
    cerrarSesionesDe,
    limpiarCookie,
    listarSesionesDe
} = require('../services/sesiones');
const {
    CORREO_VALIDO,
    hashPassword,
    registrarAuditoria,
    texto,
    validarPassword,
    verificarPassword
} = require('../utils/seguridad');

// Mensaje único: no revela si el correo existe, está inactivo
// o no tiene contraseña asignada.
const CREDENCIALES_INVALIDAS = 'Correo o contraseña incorrectos.';


// =========================================================
// POST /api/auth/login
// =========================================================

const login = async (req, res) => {
    try {
        const correo = texto(req.body?.correo, 160).toLowerCase();
        const password = String(req.body?.password ?? '');

        if (!correo || !password) {
            return res.status(400).json({ mensaje: 'Escribe tu correo y tu contraseña.' });
        }

        if (!CORREO_VALIDO.test(correo) || password.length > config.PASSWORD_MAX) {
            return res.status(401).json({ mensaje: CREDENCIALES_INVALIDAS });
        }

        const usuario = await Usuario
            .findOne({ correo })
            .select('+passwordHash +intentosFallidos +bloqueadoHasta');

        // Cuenta bloqueada temporalmente
        if (usuario?.bloqueadoHasta && usuario.bloqueadoHasta > new Date()) {
            const minutos = Math.ceil((usuario.bloqueadoHasta - Date.now()) / 60000);

            await registrarAuditoria(req, {
                accion: 'login', resultado: 'fallo', actorCorreo: correo, objetivo: usuario._id,
                detalle: 'Cuenta bloqueada temporalmente'
            });

            return res.status(429).json({
                mensaje: `Demasiados intentos fallidos. Intenta de nuevo en ${minutos} minuto(s).`
            });
        }

        // Siempre se compara (aunque no exista) para no revelar por tiempo
        const valida = await verificarPassword(password, usuario?.passwordHash);

        if (!usuario || !usuario.activo || !usuario.passwordHash || !valida) {
            if (usuario && usuario.passwordHash && !valida) {
                usuario.intentosFallidos = (usuario.intentosFallidos || 0) + 1;

                if (usuario.intentosFallidos >= config.INTENTOS_MAXIMOS) {
                    usuario.bloqueadoHasta = new Date(Date.now() + config.BLOQUEO_MINUTOS * 60000);
                    usuario.intentosFallidos = 0;
                }

                await usuario.save();
            }

            await registrarAuditoria(req, {
                accion: 'login', resultado: 'fallo', actorCorreo: correo, objetivo: usuario?._id,
                detalle: !usuario
                    ? 'Correo no registrado'
                    : !usuario.activo
                        ? 'Usuario inactivo'
                        : !usuario.passwordHash
                            ? 'Usuario sin contraseña asignada'
                            : 'Contraseña incorrecta'
            });

            return res.status(401).json({ mensaje: CREDENCIALES_INVALIDAS });
        }

        usuario.intentosFallidos = 0;
        usuario.bloqueadoHasta = undefined;
        usuario.ultimoAcceso = new Date();
        await usuario.save();

        const sesion = await abrirSesion(req, res, usuario);

        await registrarAuditoria(req, {
            accion: 'login', actor: usuario._id, actorCorreo: usuario.correo,
            detalle: sesion.equipo
        });

        return res.status(200).json({
            mensaje: 'Inicio de sesión correcto.',
            usuario: usuario.aPublico()
        });
    } catch (error) {
        console.error('Error en login:', error);

        return res.status(500).json({ mensaje: 'No pudimos iniciar tu sesión. Inténtalo de nuevo en unos momentos.' });
    }
};


// =========================================================
// GET /api/auth/me
// =========================================================

const obtenerUsuarioActual = async (req, res) =>
    res.status(200).json({ usuario: req.usuario.aPublico() });


// =========================================================
// POST /api/auth/cambiar-password
// =========================================================

const cambiarPassword = async (req, res) => {
    try {
        const actual = String(req.body?.actual ?? '');
        const nueva = String(req.body?.nueva ?? '');
        const usuario = req.usuario;

        if (!(await verificarPassword(actual, usuario.passwordHash))) {
            await registrarAuditoria(req, {
                accion: 'cambiar_password', resultado: 'fallo', objetivo: usuario._id,
                detalle: 'Contraseña actual incorrecta'
            });

            return res.status(400).json({ mensaje: 'La contraseña actual no es correcta.' });
        }

        const error = validarPassword(nueva, { correo: usuario.correo });

        if (error) {
            return res.status(400).json({ mensaje: error });
        }

        if (await verificarPassword(nueva, usuario.passwordHash)) {
            return res.status(400).json({ mensaje: 'La nueva contraseña debe ser distinta de la actual.' });
        }

        usuario.passwordHash = await hashPassword(nueva);
        usuario.passwordActualizada = new Date();
        usuario.debeCambiarPassword = false;
        // Cierra las sesiones de todos los equipos y abre una nueva en este
        usuario.tokenVersion = (usuario.tokenVersion || 0) + 1;
        await usuario.save();
        await cerrarSesionesDe(usuario._id);
        await abrirSesion(req, res, usuario);

        await registrarAuditoria(req, { accion: 'cambiar_password', objetivo: usuario._id });

        return res.status(200).json({
            mensaje: 'Contraseña actualizada correctamente. Se cerró tu sesión en los demás equipos.',
            usuario: usuario.aPublico()
        });
    } catch (error) {
        console.error('Error al cambiar contraseña:', error);

        return res.status(500).json({ mensaje: 'No fue posible cambiar la contraseña.' });
    }
};


// =========================================================
// POST /api/auth/logout  (cierra la sesión de este equipo)
// =========================================================

const logout = async (req, res) => {
    try {
        await Sesion.deleteOne({ _id: req.sesionId });
        limpiarCookie(req, res);
        await registrarAuditoria(req, { accion: 'logout' });

        return res.status(200).json({ mensaje: 'Sesión cerrada.' });
    } catch (error) {
        console.error('Error al cerrar sesión:', error);

        return res.status(500).json({ mensaje: 'No pudimos cerrar la sesión. Inténtalo de nuevo.' });
    }
};


// =========================================================
// GET /api/auth/sesiones  (equipos con sesión abierta)
// =========================================================

const listarMisSesiones = async (req, res) => {
    try {
        return res.status(200).json({
            sesiones: await listarSesionesDe(req.usuario._id, req.sesionId)
        });
    } catch (error) {
        console.error('Error al listar sesiones:', error);

        return res.status(500).json({ mensaje: 'No pudimos cargar tus sesiones. Inténtalo de nuevo en unos momentos.' });
    }
};


// =========================================================
// DELETE /api/auth/sesiones/:id      (cierra un equipo)
// POST   /api/auth/sesiones/cerrar-otras (todos menos este)
// =========================================================

const cerrarMiSesion = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(404).json({ mensaje: 'Esa sesión ya no está abierta.' });
        }

        const sesion = await Sesion.findOneAndDelete({ _id: id, usuario: req.usuario._id }).lean();

        if (!sesion) {
            return res.status(404).json({ mensaje: 'Esa sesión ya no está abierta.' });
        }

        const esActual = sesion._id.equals(req.sesionId);

        if (esActual) limpiarCookie(req, res);

        await registrarAuditoria(req, {
            accion: 'cerrar_sesion_equipo',
            objetivo: req.usuario._id,
            detalle: `${sesion.equipo}${sesion.ip ? ` · ${sesion.ip}` : ''}`
        });

        return res.status(200).json({ mensaje: 'Sesión cerrada en ese equipo.', actual: esActual });
    } catch (error) {
        console.error('Error al cerrar sesión de equipo:', error);

        return res.status(500).json({ mensaje: 'No pudimos cerrar esa sesión. Inténtalo de nuevo.' });
    }
};

const cerrarOtrasSesiones = async (req, res) => {
    try {
        const { deletedCount } = await cerrarSesionesDe(req.usuario._id, { excepto: req.sesionId });

        await registrarAuditoria(req, {
            accion: 'cerrar_sesion_equipo',
            objetivo: req.usuario._id,
            detalle: `Todas las demás sesiones (${deletedCount})`
        });

        return res.status(200).json({
            mensaje: deletedCount === 0
                ? 'No tenías sesiones abiertas en otros equipos.'
                : `Se cerró tu sesión en ${deletedCount} equipo(s).`,
            cerradas: deletedCount
        });
    } catch (error) {
        console.error('Error al cerrar otras sesiones:', error);

        return res.status(500).json({ mensaje: 'No pudimos cerrar las demás sesiones. Inténtalo de nuevo.' });
    }
};


module.exports = {
    login,
    obtenerUsuarioActual,
    cambiarPassword,
    logout,
    listarMisSesiones,
    cerrarMiSesion,
    cerrarOtrasSesiones
};
