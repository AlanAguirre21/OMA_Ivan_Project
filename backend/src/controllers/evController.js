const mongoose = require('mongoose');
const Evaluacion = require('../models/Evaluacion');
const NivelesPlanta = require('../models/NivelesPlanta');
const { criterios } = require('../config/evConfig');
const { obtenerAreas } = require('../services/lineas');
const { registrarAuditoria } = require('../utils/seguridad');
const { lineasProgramadasHoy } = require('./calendarioController');
const { obtenerRespuestas, procesarRespuestasEvaluacion } = require('../services/respuestas');

/*
 * =========================================================
 * EVALUACIÓN OMA EN PISO
 *
 * Una evaluación replica la matriz del Excel para las
 * líneas (nodos) que el evaluador eligió:
 * - Planta y Objetivo: los define el administrador para
 *   toda la planta y se toman del servidor (no del cliente).
 * - Nodos elegidos: valoración 1, 2 o 3 en los 13 criterios.
 * =========================================================
 */

const NIVELES_VALIDOS = [1, 2, 3];

// MongoDB no permite "." ni "$" en las claves:
// W7.2 -> W7_2, P.ELEC -> P_ELEC
const obtenerClaveNodo = (nodo) =>
    String(nodo).replace(/[.$]/g, '_');

// Acepta la clave original ("W7.2") o la de almacenamiento ("W7_2")
const leerValorNodo = (datosArea, nodo) => {
    const valor =
        datosArea?.[obtenerClaveNodo(nodo)] ??
        datosArea?.[nodo];

    return valor === undefined || valor === null
        ? undefined
        : Number(valor);
};

const esNivelValido = (valor) =>
    NIVELES_VALIDOS.includes(Number(valor));

const esAdmin = (req) => req.usuario?.rol === 'admin';


// Niveles Planta / Objetivo vigentes: Map(numero -> { planta, objetivo })
async function obtenerMapaNiveles() {
    const documento = await NivelesPlanta.findOne({ clave: 'planta' }).lean();

    return new Map(
        (documento?.niveles || []).map((nivel) => [String(nivel.numero), nivel])
    );
}


/*
 * Nodos elegidos: [{ area, nodo }]. Si no se envían, se
 * evalúan todos (compatibilidad con el formulario anterior).
 * Devuelve { nodos } o { error }.
 */
function procesarNodos(recibidos, listaAreas) {
    if (recibidos === undefined) {
        return {
            nodos: listaAreas.flatMap((area) =>
                area.nodos.map((nodo) => ({ area: area.nombre, nodo }))
            )
        };
    }

    if (!Array.isArray(recibidos) || recibidos.length === 0) {
        return { error: 'Elige al menos una línea (nodo) para evaluar.' };
    }

    const vistos = new Set();
    const nodos = [];

    for (const item of recibidos) {
        const area = listaAreas.find((candidata) => candidata.nombre === String(item?.area));

        if (!area || !area.nodos.includes(String(item?.nodo))) {
            return { error: `La línea ${item?.area ?? ''} → ${item?.nodo ?? ''} no existe.` };
        }

        const clave = `${area.nombre}|${item.nodo}`;

        if (!vistos.has(clave)) {
            vistos.add(clave);
            nodos.push({ area: area.nombre, nodo: String(item.nodo) });
        }
    }

    // Orden de la configuración (como en el Excel)
    const orden = listaAreas.flatMap((area) => area.nodos.map((nodo) => `${area.nombre}|${nodo}`));

    nodos.sort(
        (a, b) => orden.indexOf(`${a.area}|${a.nodo}`) - orden.indexOf(`${b.area}|${b.nodo}`)
    );

    return { nodos };
}


/*
 * Valida y normaliza un criterio recibido.
 * Devuelve { criterio } o { error, codigo }.
 */
function procesarCriterio(config, recibido, nivel, nodos) {
    const etiqueta = `${config.numero} ${config.nombre}`;

    if (!recibido) {
        return { error: `Falta el criterio ${etiqueta}.` };
    }

    if (!esNivelValido(nivel?.planta) || !esNivelValido(nivel?.objetivo)) {
        return {
            error: `El administrador aún no define Planta y Objetivo del criterio ${etiqueta}.`,
            codigo: 'NIVELES_PENDIENTES'
        };
    }

    const evaluaciones = {};
    let suma = 0;

    for (const { area, nodo } of nodos) {
        const valor = leerValorNodo(recibido.evaluaciones?.[area], nodo);

        if (!esNivelValido(valor)) {
            return {
                error: `Falta una valoración válida (1, 2 o 3) en ${area} → ${nodo} del criterio ${etiqueta}.`
            };
        }

        evaluaciones[area] = evaluaciones[area] || {};
        evaluaciones[area][obtenerClaveNodo(nodo)] = valor;
        suma += valor;
    }

    return {
        criterio: {
            numero: config.numero,
            nombre: config.nombre,
            nivelPlanta: Number(nivel.planta),
            nivelObjetivo: Number(nivel.objetivo),
            evaluaciones,
            resultado: {
                suma,
                cantidadNodos: nodos.length,
                promedio: Number((suma / nodos.length).toFixed(2))
            }
        }
    };
}


// =========================================================
// GET /api/evaluaciones/niveles
// Planta y Objetivo vigentes (todos los usuarios los leen)
// =========================================================

const obtenerNiveles = async (req, res) => {
    try {
        const documento = await NivelesPlanta
            .findOne({ clave: 'planta' })
            .populate('actualizadoPor', 'nombre')
            .lean();

        return res.status(200).json({
            niveles: documento?.niveles || [],
            actualizado: documento?.updatedAt || null,
            actualizadoPor: documento?.actualizadoPor?.nombre || null
        });
    } catch (error) {
        console.error('Error al obtener niveles:', error);

        return res.status(500).json({ mensaje: 'No pudimos cargar Planta y Objetivo. Inténtalo de nuevo en unos momentos.' });
    }
};


// =========================================================
// GET /api/evaluaciones/respuestas
// Respuestas predeterminadas por criterio (todos los usuarios)
// =========================================================

const listarRespuestas = async (req, res) => {
    try {
        return res.status(200).json(await obtenerRespuestas());
    } catch (error) {
        console.error('Error al obtener respuestas predeterminadas:', error);

        return res.status(500).json({ mensaje: 'No pudimos cargar las respuestas predeterminadas. Inténtalo de nuevo en unos momentos.' });
    }
};


// =========================================================
// POST /api/evaluaciones
// Body: { nodos: [{ area, nodo }], criterios: [{ numero, evaluaciones }] }
// =========================================================

const crearEvaluacion = async (req, res) => {
    try {
        const recibidos = req.body?.criterios;

        if (!Array.isArray(recibidos)) {
            return res.status(400).json({
                mensaje: 'La evaluación enviada está incompleta. Recarga la página e inténtalo de nuevo.'
            });
        }

        const listaAreas = await obtenerAreas();
        const { nodos, error: errorNodos } = procesarNodos(req.body?.nodos, listaAreas);

        if (errorNodos) {
            return res.status(400).json({ mensaje: errorNodos });
        }

        // Un evaluador solo evalúa las líneas que el calendario indica para hoy
        if (!esAdmin(req)) {
            const { lineas } = await lineasProgramadasHoy(req.usuario);
            const permitidas = new Set(lineas.map((linea) => `${linea.area}|${linea.nodo}`));

            if (req.body?.nodos === undefined || permitidas.size === 0) {
                return res.status(400).json({
                    mensaje: 'Hoy no hay líneas programadas para evaluar. Consulta el Calendario.',
                    codigo: 'SIN_PROGRAMACION'
                });
            }

            const fuera = nodos.filter((item) => !permitidas.has(`${item.area}|${item.nodo}`));

            if (fuera.length > 0) {
                return res.status(400).json({
                    mensaje: `Hoy no está programada la evaluación de: ${fuera.map((item) => `${item.area} → ${item.nodo}`).join(', ')}. Solo puedes evaluar las líneas que indica el Calendario.`,
                    codigo: 'LINEA_NO_PROGRAMADA'
                });
            }
        }

        const niveles = await obtenerMapaNiveles();
        const criteriosProcesados = [];

        for (const config of criterios) {
            const recibido = recibidos.find(
                (criterio) => String(criterio?.numero) === String(config.numero)
            );

            const { criterio, error, codigo } = procesarCriterio(
                config,
                recibido,
                niveles.get(String(config.numero)),
                nodos
            );

            if (error) {
                return res.status(400).json({ mensaje: error, codigo });
            }

            criteriosProcesados.push(criterio);
        }

        const { respuestas, error: errorRespuestas, codigo: codigoRespuestas } =
            await procesarRespuestasEvaluacion(req.body?.respuestas);

        if (errorRespuestas) {
            return res.status(400).json({ mensaje: errorRespuestas, codigo: codigoRespuestas });
        }

        const evaluacion = await Evaluacion.create({
            usuario: req.usuario._id,
            area: req.usuario.area,
            nodosEvaluados: nodos,
            criterios: criteriosProcesados,
            ...(respuestas.length > 0 ? { respuestas } : {})
        });

        await registrarAuditoria(req, {
            accion: 'crear_evaluacion',
            detalle: `Evaluación ${evaluacion._id} · Área: ${req.usuario.area} · Líneas: ${nodos.map((item) => item.nodo).join(', ')}`
        });

        return res.status(201).json({
            mensaje: 'Evaluación guardada correctamente.',
            evaluacion: evaluacion._id,
            validacion: {
                criteriosEsperados: criterios.length,
                criteriosRecibidos: criteriosProcesados.length,
                nodosPorCriterio: nodos.length,
                valoresEsperados: criterios.length * nodos.length,
                valoresRecibidos: criteriosProcesados.length * nodos.length,
                resultadosGenerados: criteriosProcesados.length,
                completa: true
            }
        });
    } catch (error) {
        console.error('Error al crear evaluación:', error);

        return res.status(500).json({
            mensaje: 'No pudimos guardar la evaluación. Tu avance sigue guardado en este equipo; inténtalo de nuevo en unos momentos.'
        });
    }
};


// Datos del evaluador que se adjuntan a cada evaluación
const CAMPOS_EVALUADOR = 'nombre correo area';


// =========================================================
// GET /api/evaluaciones
//
// Evaluador: solo las suyas.
// Admin: todas, o las de un usuario con ?usuario=<id>.
// =========================================================

const obtenerEvaluaciones = async (req, res) => {
    try {
        const filtro = {};

        if (esAdmin(req)) {
            const usuario = String(req.query.usuario ?? '');

            if (usuario) {
                if (!mongoose.isValidObjectId(usuario)) {
                    return res.status(200).json([]);
                }

                filtro.usuario = usuario;
            }
        } else {
            filtro.usuario = req.usuario._id;
        }

        const evaluaciones = await Evaluacion
            .find(filtro)
            .sort({ fecha: -1 })
            .populate('usuario', CAMPOS_EVALUADOR)
            .limit(2000)
            .lean();

        return res.status(200).json(evaluaciones);
    } catch (error) {
        console.error('Error al obtener evaluaciones:', error);

        return res.status(500).json({
            mensaje: 'No pudimos cargar las evaluaciones. Inténtalo de nuevo en unos momentos.'
        });
    }
};


// =========================================================
// GET /api/evaluaciones/:id
// =========================================================

const obtenerEvaluacionPorId = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(404).json({ mensaje: 'Evaluación no encontrada.' });
        }

        const filtro = esAdmin(req)
            ? { _id: id }
            : { _id: id, usuario: req.usuario._id };

        const evaluacion = await Evaluacion
            .findOne(filtro)
            .populate('usuario', CAMPOS_EVALUADOR)
            .lean();

        if (!evaluacion) {
            return res.status(404).json({ mensaje: 'Evaluación no encontrada.' });
        }

        return res.status(200).json(evaluacion);
    } catch (error) {
        console.error('Error al obtener evaluación:', error);

        return res.status(500).json({
            mensaje: 'No pudimos cargar la evaluación. Inténtalo de nuevo en unos momentos.'
        });
    }
};


module.exports = {
    obtenerNiveles,
    listarRespuestas,
    crearEvaluacion,
    obtenerEvaluaciones,
    obtenerEvaluacionPorId
};
