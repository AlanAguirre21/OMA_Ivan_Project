/*
 * Protección contra inyección NoSQL: elimina del body y de
 * los parámetros cualquier clave que empiece con "$" o que
 * contenga "." (operadores de MongoDB como $gt, $where...).
 *
 * Nota: las claves de nodos con punto ("W7.2") se aceptan
 * dentro de "evaluaciones", porque el controlador las
 * convierte a "W7_2" antes de guardarlas.
 */

const CLAVE_PELIGROSA = /^\$|\./;

function limpiar(valor, permitirPunto = false, profundidad = 0) {
    if (profundidad > 10 || valor === null || typeof valor !== 'object') {
        return valor;
    }

    if (Array.isArray(valor)) {
        return valor.map((item) => limpiar(item, permitirPunto, profundidad + 1));
    }

    const limpio = {};

    for (const [clave, contenido] of Object.entries(valor)) {
        const peligrosa = clave.startsWith('$') || (!permitirPunto && CLAVE_PELIGROSA.test(clave));

        if (peligrosa || clave === '__proto__' || clave === 'constructor' || clave === 'prototype') {
            continue;
        }

        limpio[clave] = limpiar(
            contenido,
            permitirPunto || clave === 'evaluaciones',
            profundidad + 1
        );
    }

    return limpio;
}

function sanitizar(req, res, next) {
    if (req.body && typeof req.body === 'object') {
        req.body = limpiar(req.body);
    }

    if (req.params && typeof req.params === 'object') {
        for (const clave of Object.keys(req.params)) {
            if (typeof req.params[clave] !== 'string') {
                req.params[clave] = String(req.params[clave]);
            }
        }
    }

    next();
}

module.exports = sanitizar;
