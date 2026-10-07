const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const Auditoria = require('../models/Auditoria');
const config = require('../config/seguridad');

/*
 * =========================================================
 * CONTRASEÑAS
 * =========================================================
 */

const hashPassword = (password) =>
    bcrypt.hash(password, config.BCRYPT_COSTO);

// Hash de referencia para comparar aunque el usuario no exista
// (evita revelar por tiempo de respuesta si un correo existe)
const HASH_FICTICIO = bcrypt.hashSync('contraseña-ficticia-oma', config.BCRYPT_COSTO);

const verificarPassword = (password, hash) =>
    bcrypt.compare(String(password || ''), hash || HASH_FICTICIO);

/*
 * Política: 10+ caracteres, al menos una letra y un número,
 * sin espacios en los extremos y distinta del correo.
 * Devuelve el mensaje de error o '' si es válida.
 */
function validarPassword(password, { correo = '' } = {}) {
    const valor = String(password ?? '');

    if (valor.length < config.PASSWORD_MIN) {
        return `La contraseña debe tener al menos ${config.PASSWORD_MIN} caracteres.`;
    }

    if (valor.length > config.PASSWORD_MAX) {
        return `La contraseña no puede tener más de ${config.PASSWORD_MAX} caracteres.`;
    }

    if (valor !== valor.trim()) {
        return 'La contraseña no puede empezar ni terminar con espacios.';
    }

    if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(valor) || !/\d/.test(valor)) {
        return 'La contraseña debe incluir al menos una letra y un número.';
    }

    const usuarioCorreo = String(correo).split('@')[0].toLowerCase();

    if (usuarioCorreo.length >= 4 && valor.toLowerCase().includes(usuarioCorreo)) {
        return 'La contraseña no debe contener tu correo.';
    }

    return '';
}

// Contraseña temporal legible, p. ej. "Oma-k7Xq-9mPd-3tRw"
function generarPasswordTemporal() {
    const alfabeto = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bloque = () =>
        Array.from(crypto.randomBytes(4), (byte) => alfabeto[byte % alfabeto.length]).join('');

    let password;

    do {
        password = `Oma-${bloque()}-${bloque()}-${bloque()}`;
    } while (!/\d/.test(password));

    return password;
}


/*
 * =========================================================
 * SESIÓN (JWT)
 * =========================================================
 */

function firmarToken(usuario, sesionId) {
    return jwt.sign(
        {
            sub: usuario._id.toString(),
            rol: usuario.rol || 'evaluador',
            tv: usuario.tokenVersion || 0,
            sid: sesionId.toString()
        },
        process.env.JWT_SECRET,
        {
            algorithm: 'HS256',
            expiresIn: config.JWT_EXPIRACION,
            issuer: config.JWT_EMISOR,
            audience: config.JWT_AUDIENCIA
        }
    );
}

function verificarToken(token) {
    return jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: ['HS256'],
        issuer: config.JWT_EMISOR,
        audience: config.JWT_AUDIENCIA
    });
}


/*
 * =========================================================
 * AUDITORÍA
 * =========================================================
 */

const obtenerIp = (req) =>
    String(req.ip || req.socket?.remoteAddress || '').replace('::ffff:', '');

// Nunca interrumpe la petición si falla el registro
async function registrarAuditoria(req, datos) {
    try {
        await Auditoria.create({
            ...datos,
            actor: datos.actor ?? req.usuario?._id,
            actorCorreo: datos.actorCorreo ?? req.usuario?.correo,
            ip: obtenerIp(req)
        });
    } catch (error) {
        console.error('No se pudo registrar auditoría:', error.message);
    }
}


// Texto seguro: string recortado y con longitud máxima
const texto = (valor, max = 200) => String(valor ?? '').trim().slice(0, max);

const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;


module.exports = {
    hashPassword,
    verificarPassword,
    validarPassword,
    generarPasswordTemporal,
    firmarToken,
    verificarToken,
    registrarAuditoria,
    obtenerIp,
    texto,
    CORREO_VALIDO
};
