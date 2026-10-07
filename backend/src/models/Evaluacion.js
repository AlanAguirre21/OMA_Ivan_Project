const mongoose = require('mongoose');

/*
 * =========================================================
 * VALORACIONES DE NODOS
 *
 * { AREA: { CLAVE_NODO: 1 | 2 | 3 } }. Las líneas son
 * configurables, así que el objeto es flexible; el
 * controlador valida áreas, líneas y valores antes de guardar.
 * Las claves con punto se guardan con "_" (W7.2 -> W7_2).
 * =========================================================
 */

const nodoEvaluadoSchema = new mongoose.Schema(
    {
        area: { type: String, required: true },
        nodo: { type: String, required: true }
    },
    { _id: false }
);


/*
 * =========================================================
 * RESULTADO DE CADA CRITERIO
 * =========================================================
 */

const resultadoSchema = new mongoose.Schema(
    {
        suma: {
            type: Number,
            required: true
        },

        cantidadNodos: {
            type: Number,
            required: true
        },

        promedio: {
            type: Number,
            required: true
        }
    },
    { _id: false }
);


/*
 * =========================================================
 * CRITERIO
 *
 * Cada criterio tiene:
 * - Nivel Planta
 * - Nivel Objetivo
 * - 12 nodos
 * - Resultado propio
 * =========================================================
 */

const criterioSchema = new mongoose.Schema(
    {
        numero: {
            type: String,
            required: true
        },

        nombre: {
            type: String,
            required: true
        },

        nivelPlanta: {
            type: Number,
            required: true,
            min: 1,
            max: 3
        },

        nivelObjetivo: {
            type: Number,
            required: true,
            min: 1,
            max: 3
        },

        evaluaciones: {
            type: mongoose.Schema.Types.Mixed,
            required: true
        },

        resultado: {
            type: resultadoSchema,
            required: true
        }
    },
    { _id: false }
);


/*
 * =========================================================
 * RESPUESTAS DEL EVALUADO (opcional)
 *
 * Lo que la persona evaluada respondió en cada criterio:
 * opciones de la lista predeterminada + comentario libre.
 * =========================================================
 */

const respuestaSchema = new mongoose.Schema(
    {
        numero: { type: String, required: true },
        nombre: { type: String, default: '' },
        opciones: { type: [String], default: [] },
        comentario: { type: String, default: '', maxlength: 600 }
    },
    { _id: false }
);


/*
 * =========================================================
 * EVALUACIÓN COMPLETA
 * =========================================================
 */

const evaluacionSchema = new mongoose.Schema(
    {

        usuario: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Usuario',
            required: true,
            index: true
        },

        area: {
            type: String,
            required: true,
            trim: true,
            index: true
        },

        fecha: {
            type: Date,
            default: Date.now
        },

        // Líneas (nodos) que se evaluaron. Vacío en evaluaciones
        // anteriores a esta función (= se evaluaron todas).
        nodosEvaluados: {
            type: [nodoEvaluadoSchema],
            default: undefined
        },

        criterios: {
            type: [criterioSchema],
            required: true
        },

        respuestas: {
            type: [respuestaSchema],
            default: undefined
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model(
    'Evaluacion',
    evaluacionSchema
);