const mongoose = require('mongoose');

/*
 * Evaluación programada en el calendario: una fecha, las
 * líneas que se evaluarán ese día y una nota opcional.
 * La fecha se guarda como texto "AAAA-MM-DD" para que no
 * cambie de día por zonas horarias.
 */

const lineaSchema = new mongoose.Schema(
    {
        area: { type: String, required: true },
        nodo: { type: String, required: true }
    },
    { _id: false }
);

const programacionSchema = new mongoose.Schema(
    {
        fecha: {
            type: String,
            required: true,
            match: /^\d{4}-\d{2}-\d{2}$/,
            index: true
        },

        lineas: {
            type: [lineaSchema],
            validate: [(lista) => lista.length > 0, 'Elige al menos una línea.']
        },

        nota: {
            type: String,
            trim: true,
            maxlength: 300,
            default: ''
        },

        // Programaciones creadas juntas al repetir cada semana
        serie: {
            type: String,
            index: true
        },

        creadoPor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Usuario'
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('Programacion', programacionSchema);
