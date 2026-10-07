const mongoose = require('mongoose');
const { ROLES } = require('../config/seguridad');

const usuarioSchema = new mongoose.Schema(
    {
        nombre: {
            type: String,
            required: true,
            trim: true,
            maxlength: 120
        },

        correo: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            maxlength: 160
        },

        area: {
            type: String,
            required: true,
            trim: true
        },

        rol: {
            type: String,
            enum: ROLES,
            default: 'evaluador'
        },

        activo: {
            type: Boolean,
            default: true
        },

        // Hash bcrypt; nunca se devuelve en consultas
        passwordHash: {
            type: String,
            select: false
        },

        // true tras crear o restablecer: debe cambiarla al entrar
        debeCambiarPassword: {
            type: Boolean,
            default: true
        },

        passwordActualizada: Date,

        // Se incrementa para invalidar todas las sesiones abiertas
        tokenVersion: {
            type: Number,
            default: 0
        },

        intentosFallidos: {
            type: Number,
            default: 0,
            select: false
        },

        bloqueadoHasta: {
            type: Date,
            select: false
        },

        ultimoAcceso: Date,

        creadoPor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Usuario'
        }
    },
    {
        timestamps: true
    }
);

// Datos que se pueden enviar al cliente.
// conPassword: indica si tiene contraseña asignada (solo cuando
// la consulta incluyó +passwordHash; nunca se envía el hash).
usuarioSchema.methods.aPublico = function aPublico({ conPassword = false } = {}) {
    return {
        id: this._id,
        nombre: this.nombre,
        correo: this.correo,
        area: this.area,
        rol: this.rol || 'evaluador',
        activo: this.activo,
        debeCambiarPassword: Boolean(this.debeCambiarPassword),
        ...(conPassword ? { tienePassword: Boolean(this.passwordHash) } : {}),
        ultimoAcceso: this.ultimoAcceso || null,
        createdAt: this.createdAt
    };
};

module.exports = mongoose.model('Usuario', usuarioSchema);
