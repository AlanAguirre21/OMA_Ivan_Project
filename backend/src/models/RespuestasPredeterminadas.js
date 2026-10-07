const mongoose = require('mongoose');

/*
 * Respuestas predeterminadas por criterio: lo que el
 * evaluado suele responder durante la evaluación. Las
 * define el administrador (un solo documento para la
 * planta) y el evaluador las elige en el formulario.
 */

const respuestasCriterioSchema = new mongoose.Schema(
    {
        numero: { type: String, required: true },
        opciones: { type: [String], default: [] }
    },
    { _id: false }
);

const respuestasPredeterminadasSchema = new mongoose.Schema(
    {
        clave: {
            type: String,
            default: 'planta',
            unique: true
        },

        criterios: {
            type: [respuestasCriterioSchema],
            default: []
        },

        actualizadoPor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Usuario'
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('RespuestasPredeterminadas', respuestasPredeterminadasSchema);
