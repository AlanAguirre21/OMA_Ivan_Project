const mongoose = require('mongoose');
const { AUDITORIA_DIAS } = require('../config/seguridad');

/*
 * Registro de auditoría: quién hizo qué y cuándo.
 * Los registros se eliminan solos después de AUDITORIA_DIAS.
 */
const auditoriaSchema = new mongoose.Schema({
    fecha: {
        type: Date,
        default: Date.now,
        expires: AUDITORIA_DIAS * 24 * 60 * 60
    },

    accion: {
        type: String,
        required: true,
        index: true
    },

    resultado: {
        type: String,
        enum: ['ok', 'fallo'],
        default: 'ok'
    },

    actor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario'
    },

    actorCorreo: String,

    objetivo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario'
    },

    objetivoCorreo: String,

    detalle: String,

    ip: String
});

module.exports = mongoose.model('Auditoria', auditoriaSchema);
