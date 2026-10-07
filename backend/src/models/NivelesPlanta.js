const mongoose = require('mongoose');

/*
 * Niveles Planta y Objetivo de cada criterio.
 * Son únicos para toda la planta y solo los define el
 * administrador. Se guarda un único documento (clave "planta").
 */

const nivelSchema = new mongoose.Schema(
    {
        numero: { type: String, required: true },
        planta: { type: Number, min: 1, max: 3 },
        objetivo: { type: Number, min: 1, max: 3 }
    },
    { _id: false }
);

const nivelesPlantaSchema = new mongoose.Schema(
    {
        clave: {
            type: String,
            default: 'planta',
            unique: true
        },

        niveles: {
            type: [nivelSchema],
            default: []
        },

        actualizadoPor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Usuario'
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('NivelesPlanta', nivelesPlantaSchema);
