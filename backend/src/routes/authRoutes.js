const express = require('express');
const rateLimit = require('express-rate-limit');

const {
    login,
    obtenerUsuarioActual,
    cambiarPassword,
    logout,
    listarMisSesiones,
    cerrarMiSesion,
    cerrarOtrasSesiones
} = require('../controllers/authController');

const { crearAuthMiddleware } = require('../middlewares/authMiddleware');
const config = require('../config/seguridad');

const router = express.Router();

// Rutas accesibles aunque el usuario deba cambiar su contraseña
const authPermitiendoCambio = crearAuthMiddleware({ permitirCambioPendiente: true });

// Consulta de sesión al abrir la app (sin sesión → 200 { usuario: null })
const authOpcional = crearAuthMiddleware({ permitirCambioPendiente: true, opcional: true });

// Límite de intentos de login por IP (además del bloqueo por cuenta)
const limiteLogin = rateLimit({
    windowMs: config.LOGIN_VENTANA_MIN * 60 * 1000,
    limit: config.LOGIN_MAX_POR_IP,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: {
        mensaje: `Demasiados intentos de inicio de sesión desde este equipo. Intenta de nuevo en ${config.LOGIN_VENTANA_MIN} minutos.`
    }
});

const limiteCambio = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { mensaje: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' }
});

router.post('/login', limiteLogin, login);
router.get('/me', authPermitiendoCambio, obtenerUsuarioActual);
router.get('/sesion', authOpcional, obtenerUsuarioActual);
router.post('/cambiar-password', limiteCambio, authPermitiendoCambio, cambiarPassword);
router.post('/logout', authPermitiendoCambio, logout);
router.get('/sesiones', authPermitiendoCambio, listarMisSesiones);
router.post('/sesiones/cerrar-otras', authPermitiendoCambio, cerrarOtrasSesiones);
router.delete('/sesiones/:id', authPermitiendoCambio, cerrarMiSesion);

module.exports = router;
