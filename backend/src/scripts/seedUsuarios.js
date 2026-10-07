const path = require('path');
require('dotenv').config({
    path: path.join(__dirname, '../../.env')
});

const connectDB = require('../config/database');
const Usuario = require('../models/Usuario');
const usuariosIniciales = require('../config/usersIniciales');

const ejecutar = async () => {
    try {
        await connectDB();

        for (const usuario of usuariosIniciales) {
            await Usuario.findOneAndUpdate(
                { correo: usuario.correo.toLowerCase() },
                {
                    ...usuario,
                    correo: usuario.correo.toLowerCase()
                },
                {
                    upsert: true,
                    returnDocument: 'after',
                    setDefaultsOnInsert: true
                }
            );

            console.log(
                `Usuario preparado: ${usuario.correo}`
            );
        }

        console.log(
            '\nUsuarios iniciales registrados correctamente.'
        );

        process.exit(0);
    } catch (error) {
        console.error(
            'Error al registrar usuarios:',
            error.message
        );

        process.exit(1);
    }
};

ejecutar();