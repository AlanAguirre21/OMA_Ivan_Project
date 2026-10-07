const express = require('express');

const { listarProgramacion, obtenerProgramacionHoy } = require('../controllers/calendarioController');

const router = express.Router();

// Todos los usuarios con sesión consultan el calendario
router.get('/', listarProgramacion);
router.get('/hoy', obtenerProgramacionHoy);

module.exports = router;
