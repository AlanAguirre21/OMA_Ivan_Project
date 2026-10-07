/*
 * =========================================================
 * PARÁMETROS DE SEGURIDAD
 * =========================================================
 */

module.exports = {
    // Contraseñas
    PASSWORD_MIN: 10,
    PASSWORD_MAX: 128,
    BCRYPT_COSTO: 12,

    // Bloqueo de cuenta por intentos fallidos
    INTENTOS_MAXIMOS: 5,
    BLOQUEO_MINUTOS: 15,

    // Sesión (JWT en cookie httpOnly)
    SESION_HORAS: 8,
    JWT_EXPIRACION: '8h',
    COOKIE_SESION: 'oma_sesion',
    // Sesiones abiertas a la vez por usuario (se cierra la más antigua)
    MAX_SESIONES_POR_USUARIO: 10,
    // Cada cuánto se actualiza "última actividad" (evita escribir en cada petición)
    ACTIVIDAD_CADA_SEG: 60,
    JWT_EMISOR: 'oma-digital-api',
    JWT_AUDIENCIA: 'oma-digital-web',
    JWT_SECRET_MIN: 32,

    // Límite de peticiones
    LOGIN_VENTANA_MIN: 15,
    LOGIN_MAX_POR_IP: Number(process.env.LOGIN_MAX_POR_IP) || 10,
    API_VENTANA_MIN: 15,
    API_MAX_POR_IP: Number(process.env.API_MAX_POR_IP) || 600,

    // Roles
    ROLES: ['admin', 'evaluador'],

    // Auditoría: días que se conservan los registros
    AUDITORIA_DIAS: 180
};
