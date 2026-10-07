const crypto = require('crypto');
const mongoose = require('mongoose');

const Programacion = require('../models/Programacion');
const Evaluacion = require('../models/Evaluacion');
const { obtenerAreas } = require('../services/lineas');
const { registrarAuditoria, texto } = require('../utils/seguridad');

/*
 * =========================================================
 * CALENDARIO DE EVALUACIONES POR LÍNEA
 *
 * - Todos los usuarios lo consultan; solo el administrador
 *   programa, edita y elimina.
 * - Un evaluador ve las fechas a partir del día en que se
 *   dio de alta, y solo puede evaluar las líneas
 *   programadas para hoy.
 * - Cada línea indica si ya se evaluó ese día (para el
 *   evaluador: si él ya la evaluó).
 * =========================================================
 */

const ZONA_HORARIA = 'America/Mexico_City';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const MAX_SEMANAS = 52;
const MAX_RANGO_DIAS = 400;

const esFechaValida = (valor) => {
    if (!FECHA.test(valor)) return false;
    const fecha = new Date(`${valor}T00:00:00Z`);
    return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
};

const sumarDias = (valor, dias) => {
    const fecha = new Date(`${valor}T00:00:00Z`);
    fecha.setUTCDate(fecha.getUTCDate() + dias);
    return fecha.toISOString().slice(0, 10);
};

// Día local "AAAA-MM-DD" (hora de México)
const diaLocal = (fecha = new Date()) =>
    new Date(fecha).toLocaleDateString('en-CA', { timeZone: ZONA_HORARIA });

const esAdmin = (usuario) => usuario?.rol === 'admin';

// Primer día del calendario que ve un evaluador: el de su alta
const primerDiaVisible = (usuario) =>
    esAdmin(usuario) || !usuario?.createdAt ? null : diaLocal(usuario.createdAt);

const noEncontrada = (res) =>
    res.status(404).json({ mensaje: 'No encontramos esa evaluación programada.' });


// Valida las líneas contra la configuración vigente
async function procesarLineas(recibidas) {
    if (!Array.isArray(recibidas) || recibidas.length === 0) {
        return { error: 'Elige al menos una línea.' };
    }

    const areas = await obtenerAreas();
    const vistas = new Set();
    const lineas = [];

    for (const item of recibidas) {
        const area = areas.find((candidata) => candidata.nombre === String(item?.area));

        if (!area || !area.nodos.includes(String(item?.nodo))) {
            return { error: `La línea ${item?.area ?? ''} → ${item?.nodo ?? ''} no existe.` };
        }

        const clave = `${area.nombre}|${item.nodo}`;

        if (!vistas.has(clave)) {
            vistas.add(clave);
            lineas.push({ area: area.nombre, nodo: String(item.nodo) });
        }
    }

    return { lineas };
}


/*
 * Para cada programación indica qué líneas ya tienen una
 * evaluación guardada ese mismo día (hora de México).
 * Con "usuario" solo cuentan sus propias evaluaciones.
 */
async function marcarRealizadas(programaciones, { usuario } = {}) {
    if (programaciones.length === 0) return [];

    const fechas = programaciones.map((item) => item.fecha).sort();
    // Margen de un día por la zona horaria
    const desde = new Date(`${sumarDias(fechas[0], -1)}T00:00:00Z`);
    const hasta = new Date(`${sumarDias(fechas[fechas.length - 1], 2)}T00:00:00Z`);

    const evaluaciones = await Evaluacion
        .find({ fecha: { $gte: desde, $lt: hasta }, ...(usuario ? { usuario } : {}) })
        .select('fecha usuario nodosEvaluados')
        .lean();

    // dia -> "area|nodo" -> evaluadores distintos
    const evaluadasPorDia = new Map();

    evaluaciones.forEach((evaluacion) => {
        const dia = diaLocal(evaluacion.fecha);
        if (!evaluadasPorDia.has(dia)) evaluadasPorDia.set(dia, new Map());
        const delDia = evaluadasPorDia.get(dia);

        (evaluacion.nodosEvaluados || []).forEach((n) => {
            const clave = `${n.area}|${n.nodo}`;
            if (!delDia.has(clave)) delDia.set(clave, new Set());
            delDia.get(clave).add(String(evaluacion.usuario));
        });
    });

    return programaciones.map((item) => {
        const evaluadas = evaluadasPorDia.get(item.fecha) || new Map();

        return {
            id: item._id,
            fecha: item.fecha,
            nota: item.nota,
            serie: item.serie || null,
            lineas: item.lineas.map((linea) => {
                const evaluadores = evaluadas.get(`${linea.area}|${linea.nodo}`)?.size || 0;

                return { ...linea, realizada: evaluadores > 0, evaluadores };
            })
        };
    });
}


// GET /api/calendario?desde=AAAA-MM-DD&hasta=AAAA-MM-DD
const listarProgramacion = async (req, res) => {
    try {
        const desde = texto(req.query.desde, 10);
        const hasta = texto(req.query.hasta, 10);

        if (!esFechaValida(desde) || !esFechaValida(hasta) || desde > hasta) {
            return res.status(400).json({ mensaje: 'Indica un rango de fechas válido.' });
        }

        if ((new Date(hasta) - new Date(desde)) / 86400000 > MAX_RANGO_DIAS) {
            return res.status(400).json({ mensaje: 'El rango de fechas es demasiado amplio.' });
        }

        // Un evaluador solo ve lo programado desde su alta
        const visibleDesde = primerDiaVisible(req.usuario);
        const inicio = visibleDesde && visibleDesde > desde ? visibleDesde : desde;

        const programaciones = inicio > hasta
            ? []
            : await Programacion
                .find({ fecha: { $gte: inicio, $lte: hasta } })
                .sort({ fecha: 1, createdAt: 1 })
                .lean();

        return res.status(200).json({
            hoy: diaLocal(),
            visibleDesde,
            programaciones: await marcarRealizadas(
                programaciones,
                esAdmin(req.usuario) ? {} : { usuario: req.usuario._id }
            )
        });
    } catch (error) {
        console.error('Error al obtener calendario:', error);

        return res.status(500).json({ mensaje: 'No pudimos cargar el calendario. Inténtalo de nuevo en unos momentos.' });
    }
};


/*
 * Líneas programadas hoy para el usuario: [{ area, nodo, nota, realizada }]
 * (sin repetidos; para un evaluador, realizada = él ya la evaluó hoy).
 */
async function lineasProgramadasHoy(usuario) {
    const hoy = diaLocal();
    const visibleDesde = primerDiaVisible(usuario);

    if (visibleDesde && visibleDesde > hoy) return { hoy, lineas: [] };

    const programaciones = await Programacion.find({ fecha: hoy }).sort({ createdAt: 1 }).lean();
    const marcadas = await marcarRealizadas(programaciones, esAdmin(usuario) ? {} : { usuario: usuario._id });

    const porClave = new Map();

    marcadas.forEach((programacion) => {
        programacion.lineas.forEach((linea) => {
            const clave = `${linea.area}|${linea.nodo}`;

            if (!porClave.has(clave)) {
                porClave.set(clave, { area: linea.area, nodo: linea.nodo, nota: programacion.nota, realizada: linea.realizada });
            }
        });
    });

    return { hoy, lineas: [...porClave.values()] };
}


// GET /api/calendario/hoy
const obtenerProgramacionHoy = async (req, res) => {
    try {
        return res.status(200).json(await lineasProgramadasHoy(req.usuario));
    } catch (error) {
        console.error('Error al obtener la programación de hoy:', error);

        return res.status(500).json({ mensaje: 'No pudimos consultar el calendario de hoy. Inténtalo de nuevo en unos momentos.' });
    }
};


// POST /api/admin/calendario   { fecha, lineas, nota, repetirSemanas }
const crearProgramacion = async (req, res) => {
    try {
        const fecha = texto(req.body?.fecha, 10);
        const nota = texto(req.body?.nota, 300);
        const repetir = Math.min(MAX_SEMANAS, Math.max(0, Math.floor(Number(req.body?.repetirSemanas) || 0)));

        if (!esFechaValida(fecha)) {
            return res.status(400).json({ mensaje: 'Indica una fecha válida.' });
        }

        const { lineas, error } = await procesarLineas(req.body?.lineas);

        if (error) return res.status(400).json({ mensaje: error });

        const serie = repetir > 0 ? crypto.randomUUID() : undefined;
        const documentos = Array.from({ length: repetir + 1 }, (_, semana) => ({
            fecha: sumarDias(fecha, semana * 7),
            lineas,
            nota,
            serie,
            creadoPor: req.usuario._id
        }));

        await Programacion.insertMany(documentos);

        await registrarAuditoria(req, {
            accion: 'programar_evaluacion',
            detalle: `${fecha}${repetir ? ` y ${repetir} semana(s) más` : ''} · Líneas: ${lineas.map((l) => l.nodo).join(', ')}${nota ? ` · ${nota}` : ''}`.slice(0, 900)
        });

        return res.status(201).json({
            mensaje: documentos.length === 1
                ? 'Evaluación programada.'
                : `Se programaron ${documentos.length} evaluaciones (una por semana).`,
            creadas: documentos.length
        });
    } catch (error) {
        console.error('Error al programar evaluación:', error);

        return res.status(500).json({ mensaje: 'No pudimos programar la evaluación. Inténtalo de nuevo en unos momentos.' });
    }
};


// PATCH /api/admin/calendario/:id   { fecha?, lineas?, nota? }
const actualizarProgramacion = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) return noEncontrada(res);

        const programacion = await Programacion.findById(id);

        if (!programacion) return noEncontrada(res);

        if (req.body?.fecha !== undefined) {
            const fecha = texto(req.body.fecha, 10);
            if (!esFechaValida(fecha)) return res.status(400).json({ mensaje: 'Indica una fecha válida.' });
            programacion.fecha = fecha;
        }

        if (req.body?.lineas !== undefined) {
            const { lineas, error } = await procesarLineas(req.body.lineas);
            if (error) return res.status(400).json({ mensaje: error });
            programacion.lineas = lineas;
        }

        if (req.body?.nota !== undefined) {
            programacion.nota = texto(req.body.nota, 300);
        }

        await programacion.save();

        await registrarAuditoria(req, {
            accion: 'editar_programacion',
            detalle: `${programacion.fecha} · Líneas: ${programacion.lineas.map((l) => l.nodo).join(', ')}`.slice(0, 900)
        });

        return res.status(200).json({ mensaje: 'Programación actualizada.' });
    } catch (error) {
        console.error('Error al actualizar programación:', error);

        return res.status(500).json({ mensaje: 'No pudimos actualizar la programación. Inténtalo de nuevo en unos momentos.' });
    }
};


// DELETE /api/admin/calendario/:id?serie=1  (serie=1 borra también las siguientes de la misma serie)
const eliminarProgramacion = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) return noEncontrada(res);

        const programacion = await Programacion.findById(id).lean();

        if (!programacion) return noEncontrada(res);

        const filtro = req.query.serie === '1' && programacion.serie
            ? { serie: programacion.serie, fecha: { $gte: programacion.fecha } }
            : { _id: programacion._id };

        const { deletedCount } = await Programacion.deleteMany(filtro);

        await registrarAuditoria(req, {
            accion: 'eliminar_programacion',
            detalle: `${programacion.fecha} · ${deletedCount} programación(es) · Líneas: ${programacion.lineas.map((l) => l.nodo).join(', ')}`.slice(0, 900)
        });

        return res.status(200).json({
            mensaje: deletedCount === 1 ? 'Programación eliminada.' : `Se eliminaron ${deletedCount} programaciones.`,
            eliminadas: deletedCount
        });
    } catch (error) {
        console.error('Error al eliminar programación:', error);

        return res.status(500).json({ mensaje: 'No pudimos eliminar la programación. Inténtalo de nuevo en unos momentos.' });
    }
};


module.exports = {
    lineasProgramadasHoy,
    obtenerProgramacionHoy,
    listarProgramacion,
    crearProgramacion,
    actualizarProgramacion,
    eliminarProgramacion
};
