const express = require('express');

const {
    obtenerNiveles,
    listarRespuestas,
    crearEvaluacion,
    obtenerEvaluaciones,
    obtenerEvaluacionPorId
} = require('../controllers/evController');

const { criterios } = require('../config/evConfig');
const { obtenerAreasObjeto } = require('../services/lineas');

const router = express.Router();

// Áreas con sus líneas vigentes (configurables por el admin) y criterios
router.get('/config', async (req, res, next) => {
    try {
        res.status(200).json({
            areas: await obtenerAreasObjeto(),
            criterios
        });
    } catch (error) {
        next(error);
    }
});


router.get('/niveles', obtenerNiveles);
router.get('/respuestas', listarRespuestas);

router.post('/', crearEvaluacion);
router.get('/', obtenerEvaluaciones);
router.get('/:id', obtenerEvaluacionPorId);

module.exports = router;