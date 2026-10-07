const RespuestasPredeterminadas = require('../models/RespuestasPredeterminadas');
const { criterios } = require('../config/evConfig');

/*
 * =========================================================
 * RESPUESTAS PREDETERMINADAS DEL EVALUADO
 * =========================================================
 */

const MAX_OPCIONES = 30;
const MAX_TEXTO_OPCION = 140;
const MAX_COMENTARIO = 600;

const limpiar = (valor, max) =>
    String(valor ?? '').replace(/\s+/g, ' ').trim().slice(0, max);


// { numero -> [opciones] } con todos los criterios vigentes
async function obtenerRespuestas() {
    const documento = await RespuestasPredeterminadas
        .findOne({ clave: 'planta' })
        .populate('actualizadoPor', 'nombre')
        .lean();

    const porNumero = new Map(
        (documento?.criterios || []).map((item) => [String(item.numero), item.opciones || []])
    );

    return {
        criterios: criterios.map((criterio) => ({
            numero: criterio.numero,
            nombre: criterio.nombre,
            opciones: porNumero.get(String(criterio.numero)) || []
        })),
        actualizado: documento?.updatedAt || null,
        actualizadoPor: documento?.actualizadoPor?.nombre || null
    };
}


// Valida la lista que envía el admin. Devuelve { criterios } o { error }.
function validarLista(recibidos) {
    if (!Array.isArray(recibidos)) {
        return { error: 'La lista de respuestas no es válida. Recarga la página e inténtalo de nuevo.' };
    }

    const resultado = [];

    for (const criterio of criterios) {
        const recibido = recibidos.find((item) => String(item?.numero) === String(criterio.numero));
        const opciones = [];
        const vistas = new Set();

        for (const opcion of Array.isArray(recibido?.opciones) ? recibido.opciones : []) {
            const texto = limpiar(opcion, MAX_TEXTO_OPCION + 1);

            if (!texto) continue;

            if (texto.length > MAX_TEXTO_OPCION) {
                return { error: `Cada respuesta debe tener como máximo ${MAX_TEXTO_OPCION} caracteres (criterio ${criterio.numero}).` };
            }

            const clave = texto.toLocaleLowerCase('es');

            if (vistas.has(clave)) {
                return { error: `La respuesta "${texto}" está repetida en el criterio ${criterio.numero}.` };
            }

            vistas.add(clave);
            opciones.push(texto);
        }

        if (opciones.length > MAX_OPCIONES) {
            return { error: `El criterio ${criterio.numero} admite como máximo ${MAX_OPCIONES} respuestas.` };
        }

        resultado.push({ numero: criterio.numero, opciones });
    }

    return { criterios: resultado };
}


/*
 * Respuestas que el evaluador marcó en una evaluación:
 * [{ numero, opciones: [...], comentario }]. Solo se aceptan
 * opciones de la lista vigente. Devuelve { respuestas } o { error }.
 */
async function procesarRespuestasEvaluacion(recibidas) {
    if (recibidas === undefined || recibidas === null) return { respuestas: [] };

    if (!Array.isArray(recibidas)) {
        return { error: 'Las respuestas del evaluado no son válidas. Recarga la página e inténtalo de nuevo.' };
    }

    const { criterios: lista } = await obtenerRespuestas();
    const respuestas = [];

    for (const criterio of lista) {
        const recibida = recibidas.find((item) => String(item?.numero) === String(criterio.numero));

        if (!recibida) continue;

        const permitidas = new Set(criterio.opciones);
        const opciones = [...new Set((Array.isArray(recibida.opciones) ? recibida.opciones : []).map(String))];
        const desconocida = opciones.find((opcion) => !permitidas.has(opcion));

        if (desconocida) {
            return {
                error: `La respuesta "${desconocida.slice(0, 60)}" ya no está disponible en el criterio ${criterio.numero}. Recarga la página para ver la lista actualizada.`,
                codigo: 'RESPUESTA_NO_DISPONIBLE'
            };
        }

        const comentario = limpiar(recibida.comentario, MAX_COMENTARIO);

        if (opciones.length > 0 || comentario) {
            respuestas.push({ numero: criterio.numero, nombre: criterio.nombre, opciones, comentario });
        }
    }

    return { respuestas };
}


module.exports = {
    obtenerRespuestas,
    validarLista,
    procesarRespuestasEvaluacion,
    MAX_COMENTARIO
};
