const Evaluacion = require('../models/Evaluacion');
const { AREAS_BASE } = require('../services/lineas');

/*
 * Migraciones que se ejecutan al iniciar el servidor.
 * Son idempotentes: si no hay nada que migrar, no hacen nada.
 */

// Las evaluaciones anteriores a las líneas configurables no tienen
// "nodosEvaluados": se evaluaron las 12 líneas originales. Se les
// asigna esa lista para que su historial no cambie si el admin
// renombra, mueve o quita líneas.
async function completarNodosEvaluados() {
    const originales = Object.entries(AREAS_BASE).flatMap(([area, nodos]) =>
        nodos.map((nodo) => ({ area, nodo }))
    );

    const resultado = await Evaluacion.updateMany(
        { $or: [{ nodosEvaluados: { $exists: false } }, { nodosEvaluados: { $size: 0 } }] },
        { $set: { nodosEvaluados: originales } }
    );

    if (resultado.modifiedCount > 0) {
        console.log(`Migración: ${resultado.modifiedCount} evaluación(es) anteriores registradas con sus 12 líneas originales.`);
    }
}

async function ejecutarMigraciones() {
    try {
        await completarNodosEvaluados();
    } catch (error) {
        // No impide arrancar; se reintenta en el siguiente inicio
        console.error('No se pudieron ejecutar las migraciones:', error.message);
    }
}

module.exports = { ejecutarMigraciones };
