/*
 * Crea (o promueve) un usuario administrador.
 *
 * Uso:
 *   npm run crear-admin -- --correo admin@empresa.com --nombre "Administrador OMA" --area "Mejora Continua"
 *
 * Contraseña: se toma de la variable ADMIN_PASSWORD si existe;
 * si no, se genera una temporal que se muestra UNA sola vez.
 * En ambos casos deberá cambiarse en el primer inicio de sesión.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env'), quiet: true });

const mongoose = require('mongoose');
const connectDB = require('../config/database');
const Usuario = require('../models/Usuario');
const areasUsuarios = require('../config/areasUsuarios');
const {
    CORREO_VALIDO,
    generarPasswordTemporal,
    hashPassword,
    validarPassword
} = require('../utils/seguridad');

// Toma todas las palabras hasta el siguiente "--opcion"
// (en PowerShell npm pierde las comillas de "Nombre Apellido").
function argumento(nombre, porDefecto = '') {
    const indice = process.argv.indexOf(`--${nombre}`);

    if (indice === -1) return porDefecto;

    const partes = [];

    for (let i = indice + 1; i < process.argv.length && !process.argv[i].startsWith('--'); i++) {
        partes.push(process.argv[i]);
    }

    return partes.join(' ').trim() || porDefecto;
}

(async () => {
    const correo = argumento('correo').toLowerCase();
    const nombre = argumento('nombre', 'Administrador OMA');
    const area = argumento('area', 'Mejora Continua');

    if (!CORREO_VALIDO.test(correo)) {
        console.error('Indica un correo válido: --correo admin@empresa.com');
        process.exit(1);
    }

    if (!areasUsuarios.includes(area)) {
        console.error(`Área no válida. Opciones: ${areasUsuarios.join(', ')}`);
        process.exit(1);
    }

    const passwordDefinida = process.env.ADMIN_PASSWORD;
    const password = passwordDefinida || generarPasswordTemporal();

    if (passwordDefinida) {
        const error = validarPassword(passwordDefinida, { correo });

        if (error) {
            console.error(`ADMIN_PASSWORD no cumple la política: ${error}`);
            process.exit(1);
        }
    }

    try {
        await connectDB();

        const existente = await Usuario.findOne({ correo });

        const usuario = existente || new Usuario({ correo, nombre, area });

        usuario.rol = 'admin';
        usuario.activo = true;
        usuario.passwordHash = await hashPassword(password);
        usuario.debeCambiarPassword = true;
        usuario.tokenVersion = (usuario.tokenVersion || 0) + 1;

        await usuario.save();

        console.log(`\n${existente ? 'Usuario promovido a administrador' : 'Administrador creado'}: ${correo}`);

        if (!passwordDefinida) {
            console.log(`Contraseña temporal (se muestra una sola vez): ${password}`);
        }

        console.log('Deberá cambiarla en el primer inicio de sesión.\n');

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('No fue posible crear el administrador:', error.message);
        process.exit(1);
    }
})();
