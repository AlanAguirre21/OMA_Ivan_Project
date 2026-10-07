const mongoose = require('mongoose');

/*
 * Sesión abierta en un equipo. El token de la cookie lleva
 * el id de esta sesión: si se elimina (cerrar sesión, cerrar
 * desde otro equipo o por el administrador), el token deja
 * de ser válido al instante.
 * MongoDB borra solas las sesiones vencidas (índice TTL).
 */

const sesionSchema = new mongoose.Schema(
    {
        usuario: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Usuario',
            required: true,
            index: true
        },

        // Descripción legible del equipo, p. ej. "Edge en Windows"
        equipo: {
            type: String,
            maxlength: 120,
            default: 'Equipo desconocido'
        },

        ip: {
            type: String,
            maxlength: 64,
            default: ''
        },

        ultimaActividad: {
            type: Date,
            default: Date.now
        },

        expira: {
            type: Date,
            required: true
        }
    },
    { timestamps: true }
);

sesionSchema.index({ expira: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Sesion', sesionSchema);
