const mongoose = require('mongoose');

/*
 * Líneas de trabajo (nodos) agrupadas por área.
 * Las administra el admin; se guarda un único documento
 * (clave "lineas"). La primera vez se crea con evConfig.
 */

const areaSchema = new mongoose.Schema(
    {
        nombre: { type: String, required: true },
        nodos: { type: [String], default: [] }
    },
    { _id: false }
);

const configuracionLineasSchema = new mongoose.Schema(
    {
        clave: { type: String, default: 'lineas', unique: true },
        areas: { type: [areaSchema], default: [] },
        actualizadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' }
    },
    { timestamps: true }
);

module.exports = mongoose.model('ConfiguracionLineas', configuracionLineasSchema);
