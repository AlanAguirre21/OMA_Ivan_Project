const Sesion = require('../models/Sesion');
const config = require('../config/seguridad');
const { firmarToken, obtenerIp } = require('../utils/seguridad');

/*
 * =========================================================
 * SESIONES POR EQUIPO
 *
 * - El token viaja en una cookie httpOnly: el código de la
 *   página no puede leerlo (protege ante inyección de JS).
 * - SameSite=Strict: otros sitios no pueden usarla.
 * - Secure cuando la conexión es HTTPS.
 * - Cada inicio de sesión crea un registro Sesion; borrarlo
 *   cierra la sesión de ese equipo de inmediato.
 * =========================================================
 */

const DURACION_MS = config.SESION_HORAS * 60 * 60 * 1000;
const RUTA_COOKIE = '/api';

// "Edge en Windows", "Chrome en Android", "Safari en iPhone"...
function describirEquipo(agente = '') {
    const ua = String(agente);

    const navegador =
        /Edg\//.test(ua) ? 'Edge'
            : /OPR\/|Opera/.test(ua) ? 'Opera'
                : /Firefox\//.test(ua) ? 'Firefox'
                    : /Chrome\//.test(ua) ? 'Chrome'
                        : /Safari\//.test(ua) ? 'Safari'
                            : '';

    const sistema =
        /iPhone/.test(ua) ? 'iPhone'
            : /iPad/.test(ua) ? 'iPad'
                : /Android/.test(ua) ? 'Android'
                    : /Windows/.test(ua) ? 'Windows'
                        : /Mac OS X|Macintosh/.test(ua) ? 'macOS'
                            : /Linux/.test(ua) ? 'Linux'
                                : '';

    if (navegador && sistema) return `${navegador} en ${sistema}`;

    return navegador || sistema || 'Equipo desconocido';
}

const cookieSegura = (req) =>
    Boolean(req.secure) || process.env.COOKIE_SECURE === '1';

const opcionesCookie = (req) => ({
    httpOnly: true,
    secure: cookieSegura(req),
    sameSite: 'strict',
    path: RUTA_COOKIE
});


// Lee la cookie de sesión sin dependencias extra
function leerTokenCookie(req) {
    const cabecera = String(req.headers.cookie || '');

    for (const parte of cabecera.split(';')) {
        const indice = parte.indexOf('=');
        if (indice === -1) continue;

        if (parte.slice(0, indice).trim() === config.COOKIE_SESION) {
            try {
                return decodeURIComponent(parte.slice(indice + 1).trim());
            } catch {
                return '';
            }
        }
    }

    return '';
}


// Crea la sesión del equipo y envía la cookie
async function abrirSesion(req, res, usuario) {
    const sesion = await Sesion.create({
        usuario: usuario._id,
        equipo: describirEquipo(req.headers['user-agent']),
        ip: obtenerIp(req),
        expira: new Date(Date.now() + DURACION_MS)
    });

    // Límite de sesiones simultáneas: se cierran las más antiguas
    const sobrantes = await Sesion
        .find({ usuario: usuario._id })
        .sort({ createdAt: -1 })
        .skip(config.MAX_SESIONES_POR_USUARIO)
        .select('_id')
        .lean();

    if (sobrantes.length > 0) {
        await Sesion.deleteMany({ _id: { $in: sobrantes.map((item) => item._id) } });
    }

    res.cookie(config.COOKIE_SESION, firmarToken(usuario, sesion._id), {
        ...opcionesCookie(req),
        maxAge: DURACION_MS
    });

    return sesion;
}

function limpiarCookie(req, res) {
    res.clearCookie(config.COOKIE_SESION, opcionesCookie(req));
}

// Cierra todas las sesiones de un usuario (opcionalmente menos una)
const cerrarSesionesDe = (usuarioId, { excepto } = {}) =>
    Sesion.deleteMany({
        usuario: usuarioId,
        ...(excepto ? { _id: { $ne: excepto } } : {})
    });

// Sesiones vigentes, la más reciente primero
async function listarSesionesDe(usuarioId, sesionActual) {
    const sesiones = await Sesion
        .find({ usuario: usuarioId, expira: { $gt: new Date() } })
        .sort({ ultimaActividad: -1 })
        .lean();

    return sesiones.map((sesion) => ({
        id: sesion._id,
        equipo: sesion.equipo,
        ip: sesion.ip,
        inicio: sesion.createdAt,
        ultimaActividad: sesion.ultimaActividad,
        expira: sesion.expira,
        actual: Boolean(sesionActual) && sesion._id.equals(sesionActual)
    }));
}


module.exports = {
    abrirSesion,
    limpiarCookie,
    leerTokenCookie,
    cerrarSesionesDe,
    listarSesionesDe,
    describirEquipo
};
