const express = require('express');

const {
    guardarRespuestas,
    listarAreas,
    listarUsuarios,
    crearUsuario,
    actualizarUsuario,
    restablecerPassword,
    eliminarUsuario,
    listarSesionesUsuario,
    cerrarSesionesUsuario,
    eliminarEvaluaciones,
    listarAuditoria,
    guardarNiveles,
    listarLineas,
    guardarLineas
} = require('../controllers/adminController');

const {
    crearProgramacion,
    actualizarProgramacion,
    eliminarProgramacion
} = require('../controllers/calendarioController');

const authMiddleware = require('../middlewares/authMiddleware');
const { requireAdmin } = require('../middlewares/authMiddleware');

const router = express.Router();

// Todas las rutas de administración requieren sesión + rol admin
router.use(authMiddleware, requireAdmin);

router.get('/areas', listarAreas);
router.get('/usuarios', listarUsuarios);
router.post('/usuarios', crearUsuario);
router.patch('/usuarios/:id', actualizarUsuario);
router.post('/usuarios/:id/restablecer-password', restablecerPassword);
router.delete('/usuarios/:id', eliminarUsuario);
router.get('/usuarios/:id/sesiones', listarSesionesUsuario);
router.delete('/usuarios/:id/sesiones', cerrarSesionesUsuario);
router.delete('/usuarios/:id/sesiones/:sid', cerrarSesionesUsuario);
router.post('/evaluaciones/eliminar', eliminarEvaluaciones);
router.post('/calendario', crearProgramacion);
router.patch('/calendario/:id', actualizarProgramacion);
router.delete('/calendario/:id', eliminarProgramacion);
router.get('/auditoria', listarAuditoria);
router.put('/niveles', guardarNiveles);
router.put('/respuestas', guardarRespuestas);
router.get('/lineas', listarLineas);
router.put('/lineas', guardarLineas);

module.exports = router;
