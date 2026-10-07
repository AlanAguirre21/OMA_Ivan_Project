const ConfiguracionLineas = require('../models/ConfiguracionLineas');
const { areas: AREAS_BASE } = require('../config/evConfig');

/*
 * =========================================================
 * LÍNEAS DE TRABAJO (NODOS) CONFIGURABLES
 *
 * - Las áreas son fijas (las de evConfig).
 * - Las líneas de cada área las define el administrador:
 *   se pueden renombrar, agregar, mover de área o quitar.
 * - Las evaluaciones guardadas conservan sus propias líneas
 *   (nodosEvaluados), así que el historial no cambia.
 * =========================================================
 */


const NOMBRES_AREAS = Object.keys(AREAS_BASE);
const MAX_LINEAS = 80;
const MAX_LONGITUD = 24;

// Letras, números, espacio y . - / & ( ) #
const NOMBRE_VALIDO = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9][A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 .\-/&()#]*$/;

// Clave con la que se guarda el valor en MongoDB (W7.2 -> W7_2)
const claveAlmacen = (nodo) => String(nodo).replace(/[.$]/g, '_');

const base = () =>
    NOMBRES_AREAS.map((nombre) => ({ nombre, nodos: [...AREAS_BASE[nombre]] }));

let cache = null;


// Áreas vigentes: [{ nombre, nodos }] en el orden de evConfig
async function obtenerAreas() {
    if (cache) return cache;

    let documento = await ConfiguracionLineas.findOne({ clave: 'lineas' }).lean();

    if (!documento) {
        documento = (await ConfiguracionLineas.create({ clave: 'lineas', areas: base() })).toObject();
    }

    const porNombre = new Map(documento.areas.map((area) => [area.nombre, area.nodos || []]));

    cache = NOMBRES_AREAS.map((nombre) => ({ nombre, nodos: [...(porNombre.get(nombre) || [])] }));

    return cache;
}

// Formato { AREA: [nodos] } que usa /evaluaciones/config
async function obtenerAreasObjeto() {
    const areas = await obtenerAreas();
    return Object.fromEntries(areas.map((area) => [area.nombre, area.nodos]));
}

async function obtenerInfo() {
    const documento = await ConfiguracionLineas
        .findOne({ clave: 'lineas' })
        .populate('actualizadoPor', 'nombre')
        .lean();

    return {
        actualizado: documento?.updatedAt || null,
        actualizadoPor: documento?.actualizadoPor?.nombre || null
    };
}


/*
 * Valida una propuesta [{ nombre, nodos }].
 * Devuelve { areas } normalizadas o { error }.
 */
function validarAreas(recibidas) {
    if (!Array.isArray(recibidas)) {
        return { error: 'No recibimos las líneas. Recarga la página e inténtalo de nuevo.' };
    }

    const porNombre = new Map();

    for (const area of recibidas) {
        const nombre = String(area?.nombre ?? '');

        if (!NOMBRES_AREAS.includes(nombre)) {
            return { error: `El área "${nombre}" no existe.` };
        }

        if (porNombre.has(nombre)) {
            return { error: `El área ${nombre} está repetida.` };
        }

        if (!Array.isArray(area.nodos)) {
            return { error: `Las líneas del área ${nombre} no son válidas.` };
        }

        porNombre.set(nombre, area.nodos);
    }

    const vistos = new Map();       // nombre en minúsculas -> área
    const areas = [];
    let total = 0;

    for (const nombreArea of NOMBRES_AREAS) {
        const claves = new Set();
        const nodos = [];

        for (const valor of porNombre.get(nombreArea) || []) {
            const nodo = String(valor ?? '').trim().replace(/\s+/g, ' ');

            if (!nodo) {
                return { error: `Hay una línea sin nombre en ${nombreArea}.` };
            }

            if (nodo.length > MAX_LONGITUD) {
                return { error: `"${nodo}" es demasiado largo (máximo ${MAX_LONGITUD} caracteres).` };
            }

            if (!NOMBRE_VALIDO.test(nodo)) {
                return {
                    error: `"${nodo}" tiene caracteres no permitidos. Usa letras, números, espacio y . - / & ( ) #`
                };
            }

            const minusculas = nodo.toLowerCase();

            if (vistos.has(minusculas)) {
                return { error: `La línea "${nodo}" está repetida (también en ${vistos.get(minusculas)}).` };
            }

            // "W7.2" y "W7_2" se guardarían con la misma clave
            const clave = claveAlmacen(nodo).toLowerCase();

            if (claves.has(clave)) {
                return { error: `"${nodo}" se confunde con otra línea de ${nombreArea}. Cambia el nombre.` };
            }

            vistos.set(minusculas, nombreArea);
            claves.add(clave);
            nodos.push(nodo);
        }

        total += nodos.length;
        areas.push({ nombre: nombreArea, nodos });
    }

    if (total === 0) {
        return { error: 'Debe existir al menos una línea.' };
    }

    if (total > MAX_LINEAS) {
        return { error: `Se permiten máximo ${MAX_LINEAS} líneas.` };
    }

    return { areas };
}


async function guardarAreas(areas, usuarioId) {
    await ConfiguracionLineas.findOneAndUpdate(
        { clave: 'lineas' },
        { $set: { areas, actualizadoPor: usuarioId } },
        { upsert: true, setDefaultsOnInsert: true }
    );

    cache = null;

    return obtenerAreas();
}


module.exports = {
    NOMBRES_AREAS,
    AREAS_BASE,
    MAX_LINEAS,
    MAX_LONGITUD,
    claveAlmacen,
    obtenerAreas,
    obtenerAreasObjeto,
    obtenerInfo,
    validarAreas,
    guardarAreas
};
