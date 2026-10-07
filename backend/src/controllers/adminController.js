const mongoose = require('mongoose');

const Usuario = require('../models/Usuario');
const Evaluacion = require('../models/Evaluacion');
const Auditoria = require('../models/Auditoria');
const NivelesPlanta = require('../models/NivelesPlanta');
const Sesion = require('../models/Sesion');
const { cerrarSesionesDe, listarSesionesDe } = require('../services/sesiones');
const RespuestasPredeterminadas = require('../models/RespuestasPredeterminadas');
const { obtenerRespuestas, validarLista } = require('../services/respuestas');
const lineas = require('../services/lineas');
const { criterios } = require('../config/evConfig');
const areasUsuarios = require('../config/areasUsuarios');
const { ROLES } = require('../config/seguridad');
const {
    CORREO_VALIDO,
    generarPasswordTemporal,
    hashPassword,
    registrarAuditoria,
    texto
} = require('../utils/seguridad');

/*
 * =========================================================
 * ADMINISTRACIÓN DE USUARIOS
 *
 * Los usuarios no se eliminan: se desactivan, para que
 * su historial de evaluaciones se conserve.
 * =========================================================
 */

const escaparRegex = (valor) => valor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const noEncontrado = (res) =>
    res.status(404).json({ mensaje: 'Usuario no encontrado.' });

// ¿Quedaría el sistema sin administradores activos?
async function esUltimoAdmin(usuario) {
    if (usuario.rol !== 'admin' || !usuario.activo) return false;

    const otros = await Usuario.countDocuments({
        _id: { $ne: usuario._id },
        rol: 'admin',
        activo: true
    });

    return otros === 0;
}


// GET /api/admin/areas
const listarAreas = (req, res) =>
    res.status(200).json({ areas: areasUsuarios, roles: ROLES });


// GET /api/admin/usuarios?q=&area=&rol=&estado=
const listarUsuarios = async (req, res) => {
    try {
        const filtro = {};
        const q = texto(req.query.q, 80);
        const area = texto(req.query.area, 80);
        const rol = texto(req.query.rol, 20);
        const estado = texto(req.query.estado, 20);

        if (q) {
            const patron = new RegExp(escaparRegex(q), 'i');
            filtro.$or = [{ nombre: patron }, { correo: patron }];
        }

        if (area) filtro.area = area;
        if (ROLES.includes(rol)) filtro.rol = rol;
        if (estado === 'activo') filtro.activo = true;
        if (estado === 'inactivo') filtro.activo = false;

        const usuarios = await Usuario
            .find(filtro)
            .select('+passwordHash +bloqueadoHasta')
            .sort({ activo: -1, nombre: 1 })
            .limit(500);

        // Resumen de evaluaciones por usuario
        const resumen = await Evaluacion.aggregate([
            { $match: { usuario: { $in: usuarios.map((usuario) => usuario._id) } } },
            { $group: { _id: '$usuario', total: { $sum: 1 }, ultima: { $max: '$fecha' } } }
        ]);

        const porUsuario = new Map(resumen.map((item) => [String(item._id), item]));

        // Equipos con sesión abierta por usuario
        const sesiones = await Sesion.aggregate([
            { $match: { usuario: { $in: usuarios.map((usuario) => usuario._id) }, expira: { $gt: new Date() } } },
            { $group: { _id: '$usuario', total: { $sum: 1 } } }
        ]);

        const sesionesPorUsuario = new Map(sesiones.map((item) => [String(item._id), item.total]));

        return res.status(200).json({
            usuarios: usuarios.map((usuario) => ({
                ...usuario.aPublico({ conPassword: true }),
                bloqueado: Boolean(usuario.bloqueadoHasta && usuario.bloqueadoHasta > new Date()),
                evaluaciones: porUsuario.get(String(usuario._id))?.total || 0,
                ultimaEvaluacion: porUsuario.get(String(usuario._id))?.ultima || null,
                sesionesActivas: sesionesPorUsuario.get(String(usuario._id)) || 0
            }))
        });
    } catch (error) {
        console.error('Error al listar usuarios:', error);

        return res.status(500).json({ mensaje: 'No fue posible obtener los usuarios.' });
    }
};


// POST /api/admin/usuarios
const crearUsuario = async (req, res) => {
    try {
        const nombre = texto(req.body?.nombre, 120);
        const correo = texto(req.body?.correo, 160).toLowerCase();
        const area = texto(req.body?.area, 80);
        const rol = texto(req.body?.rol, 20) || 'evaluador';

        if (nombre.length < 3) {
            return res.status(400).json({ mensaje: 'Escribe el nombre completo (mínimo 3 caracteres).' });
        }

        if (!CORREO_VALIDO.test(correo)) {
            return res.status(400).json({ mensaje: 'El correo no tiene un formato válido.' });
        }

        if (!areasUsuarios.includes(area)) {
            return res.status(400).json({ mensaje: 'Selecciona un área válida.' });
        }

        if (!ROLES.includes(rol)) {
            return res.status(400).json({ mensaje: 'El rol no es válido.' });
        }

        if (await Usuario.exists({ correo })) {
            return res.status(409).json({ mensaje: 'Ya existe un usuario con ese correo.' });
        }

        const passwordTemporal = generarPasswordTemporal();

        const usuario = await Usuario.create({
            nombre,
            correo,
            area,
            rol,
            activo: true,
            passwordHash: await hashPassword(passwordTemporal),
            debeCambiarPassword: true,
            creadoPor: req.usuario._id
        });

        await registrarAuditoria(req, {
            accion: 'crear_usuario',
            objetivo: usuario._id,
            objetivoCorreo: correo,
            detalle: `Área: ${area} · Rol: ${rol}`
        });

        return res.status(201).json({
            mensaje: 'Usuario creado. Comparte la contraseña temporal de forma segura.',
            usuario: usuario.aPublico(),
            // Se muestra una sola vez; no se guarda en texto plano
            passwordTemporal
        });
    } catch (error) {
        if (error?.code === 11000) {
            return res.status(409).json({ mensaje: 'Ya existe un usuario con ese correo.' });
        }

        console.error('Error al crear usuario:', error);

        return res.status(500).json({ mensaje: 'No fue posible crear el usuario.' });
    }
};


// PATCH /api/admin/usuarios/:id   { nombre?, area?, rol?, activo? }
const actualizarUsuario = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) return noEncontrado(res);

        const usuario = await Usuario.findById(id);

        if (!usuario) return noEncontrado(res);

        const esPropio = usuario._id.equals(req.usuario._id);
        const cambios = [];
        let revocarSesiones = false;

        if (req.body?.nombre !== undefined) {
            const nombre = texto(req.body.nombre, 120);

            if (nombre.length < 3) {
                return res.status(400).json({ mensaje: 'Escribe el nombre completo (mínimo 3 caracteres).' });
            }

            if (nombre !== usuario.nombre) {
                cambios.push(`Nombre: ${usuario.nombre} → ${nombre}`);
                usuario.nombre = nombre;
            }
        }

        if (req.body?.area !== undefined) {
            const area = texto(req.body.area, 80);

            if (!areasUsuarios.includes(area)) {
                return res.status(400).json({ mensaje: 'Selecciona un área válida.' });
            }

            if (area !== usuario.area) {
                cambios.push(`Área: ${usuario.area} → ${area}`);
                usuario.area = area;
            }
        }

        if (req.body?.rol !== undefined) {
            const rol = texto(req.body.rol, 20);

            if (!ROLES.includes(rol)) {
                return res.status(400).json({ mensaje: 'El rol no es válido.' });
            }

            if (rol !== usuario.rol) {
                if (esPropio) {
                    return res.status(400).json({ mensaje: 'No puedes cambiar tu propio rol.' });
                }

                if (rol !== 'admin' && (await esUltimoAdmin(usuario))) {
                    return res.status(400).json({ mensaje: 'Debe existir al menos un administrador activo.' });
                }

                cambios.push(`Rol: ${usuario.rol} → ${rol}`);
                usuario.rol = rol;
                revocarSesiones = true;
            }
        }

        if (req.body?.activo !== undefined) {
            const activo = req.body.activo === true || req.body.activo === 'true';

            if (activo !== usuario.activo) {
                if (!activo && esPropio) {
                    return res.status(400).json({ mensaje: 'No puedes desactivar tu propio usuario.' });
                }

                if (!activo && (await esUltimoAdmin(usuario))) {
                    return res.status(400).json({ mensaje: 'Debe existir al menos un administrador activo.' });
                }

                cambios.push(activo ? 'Activado' : 'Desactivado');
                usuario.activo = activo;
                revocarSesiones = revocarSesiones || !activo;
            }
        }

        if (cambios.length === 0) {
            return res.status(200).json({ mensaje: 'Sin cambios.', usuario: usuario.aPublico() });
        }

        // Un cambio de rol o una desactivación cierran sus sesiones
        if (revocarSesiones) {
            usuario.tokenVersion = (usuario.tokenVersion || 0) + 1;
        }

        await usuario.save();

        if (revocarSesiones) await cerrarSesionesDe(usuario._id);

        await registrarAuditoria(req, {
            accion: 'editar_usuario',
            objetivo: usuario._id,
            objetivoCorreo: usuario.correo,
            detalle: cambios.join(' · ')
        });

        return res.status(200).json({ mensaje: 'Usuario actualizado.', usuario: usuario.aPublico() });
    } catch (error) {
        console.error('Error al actualizar usuario:', error);

        return res.status(500).json({ mensaje: 'No fue posible actualizar el usuario.' });
    }
};


// POST /api/admin/usuarios/:id/restablecer-password
const restablecerPassword = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) return noEncontrado(res);

        const usuario = await Usuario.findById(id).select('+intentosFallidos +bloqueadoHasta');

        if (!usuario) return noEncontrado(res);

        if (usuario._id.equals(req.usuario._id)) {
            return res.status(400).json({
                mensaje: 'Para tu propia cuenta usa "Cambiar contraseña".'
            });
        }

        const passwordTemporal = generarPasswordTemporal();

        usuario.passwordHash = await hashPassword(passwordTemporal);
        usuario.debeCambiarPassword = true;
        usuario.intentosFallidos = 0;
        usuario.bloqueadoHasta = undefined;
        usuario.tokenVersion = (usuario.tokenVersion || 0) + 1;
        await usuario.save();
        await cerrarSesionesDe(usuario._id);

        await registrarAuditoria(req, {
            accion: 'restablecer_password',
            objetivo: usuario._id,
            objetivoCorreo: usuario.correo
        });

        return res.status(200).json({
            mensaje: 'Contraseña restablecida. El usuario deberá cambiarla al entrar.',
            usuario: usuario.aPublico(),
            passwordTemporal
        });
    } catch (error) {
        console.error('Error al restablecer contraseña:', error);

        return res.status(500).json({ mensaje: 'No fue posible restablecer la contraseña.' });
    }
};


// DELETE /api/admin/usuarios/:id   { confirmacion: "<correo del usuario>" }
// Elimina al usuario y todas sus evaluaciones (irreversible).
// La auditoría se conserva para poder rastrear la acción.
const eliminarUsuario = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) return noEncontrado(res);

        const usuario = await Usuario.findById(id);

        if (!usuario) return noEncontrado(res);

        if (usuario._id.equals(req.usuario._id)) {
            return res.status(400).json({ mensaje: 'No puedes eliminar tu propio usuario.' });
        }

        if (await esUltimoAdmin(usuario)) {
            return res.status(400).json({ mensaje: 'Debe existir al menos un administrador activo.' });
        }

        // Confirmación explícita: evita borrados accidentales
        if (texto(req.body?.confirmacion, 160).toLowerCase() !== usuario.correo) {
            return res.status(400).json({
                mensaje: 'Para confirmar, escribe exactamente el correo del usuario.',
                codigo: 'CONFIRMACION_REQUERIDA'
            });
        }

        const { deletedCount: evaluaciones } = await Evaluacion.deleteMany({ usuario: usuario._id });
        await Usuario.deleteOne({ _id: usuario._id });
        await cerrarSesionesDe(usuario._id);

        await registrarAuditoria(req, {
            accion: 'eliminar_usuario',
            objetivo: usuario._id,
            objetivoCorreo: usuario.correo,
            detalle: `${usuario.nombre} · Área: ${usuario.area} · Rol: ${usuario.rol} · ${evaluaciones} evaluación(es) eliminada(s)`
        });

        return res.status(200).json({
            mensaje: `${usuario.nombre} y ${evaluaciones} evaluación(es) fueron eliminados.`,
            evaluacionesEliminadas: evaluaciones
        });
    } catch (error) {
        console.error('Error al eliminar usuario:', error);

        return res.status(500).json({ mensaje: 'No fue posible eliminar el usuario.' });
    }
};


// GET /api/admin/usuarios/:id/sesiones
const listarSesionesUsuario = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) return noEncontrado(res);

        const usuario = await Usuario.findById(id).select('_id').lean();

        if (!usuario) return noEncontrado(res);

        return res.status(200).json({
            sesiones: await listarSesionesDe(usuario._id, req.sesionId)
        });
    } catch (error) {
        console.error('Error al listar sesiones del usuario:', error);

        return res.status(500).json({ mensaje: 'No pudimos cargar las sesiones. Inténtalo de nuevo en unos momentos.' });
    }
};


// DELETE /api/admin/usuarios/:id/sesiones        (todas)
// DELETE /api/admin/usuarios/:id/sesiones/:sid   (una)
const cerrarSesionesUsuario = async (req, res) => {
    try {
        const { id, sid } = req.params;

        if (!mongoose.isValidObjectId(id) || (sid !== undefined && !mongoose.isValidObjectId(sid))) {
            return noEncontrado(res);
        }

        const usuario = await Usuario.findById(id).select('correo nombre').lean();

        if (!usuario) return noEncontrado(res);

        // Nunca cierra la sesión desde la que el admin hace la petición
        const filtro = { usuario: usuario._id, _id: { $ne: req.sesionId } };

        if (sid) filtro._id = { $eq: sid, $ne: req.sesionId };

        const { deletedCount } = await Sesion.deleteMany(filtro);

        await registrarAuditoria(req, {
            accion: 'cerrar_sesion_equipo',
            objetivo: usuario._id,
            objetivoCorreo: usuario.correo,
            detalle: `Cerradas por el administrador: ${deletedCount}`
        });

        return res.status(200).json({
            mensaje: deletedCount === 0
                ? 'No había sesiones que cerrar.'
                : `Se cerró la sesión de ${usuario.nombre} en ${deletedCount} equipo(s).`,
            cerradas: deletedCount
        });
    } catch (error) {
        console.error('Error al cerrar sesiones del usuario:', error);

        return res.status(500).json({ mensaje: 'No pudimos cerrar las sesiones. Inténtalo de nuevo.' });
    }
};


// POST /api/admin/evaluaciones/eliminar   { ids: [] }
// Elimina una o varias evaluaciones del historial en una sola
// operación. Cada eliminación queda registrada en la auditoría.
const MAX_ELIMINAR = 500;

const eliminarEvaluaciones = async (req, res) => {
    try {
        const recibidos = req.body?.ids;

        if (!Array.isArray(recibidos) || recibidos.length === 0) {
            return res.status(400).json({ mensaje: 'Selecciona al menos una evaluación.' });
        }

        if (recibidos.length > MAX_ELIMINAR) {
            return res.status(400).json({ mensaje: `Puedes eliminar hasta ${MAX_ELIMINAR} evaluaciones a la vez.` });
        }

        const ids = [...new Set(recibidos.map(String))].filter((id) => mongoose.isValidObjectId(id));

        if (ids.length === 0) {
            return res.status(404).json({ mensaje: 'No encontramos las evaluaciones seleccionadas.' });
        }

        // Datos para la auditoría (antes de borrar)
        const evaluaciones = await Evaluacion
            .find({ _id: { $in: ids } })
            .select('_id fecha area nodosEvaluados usuario')
            .populate('usuario', 'nombre correo')
            .lean();

        if (evaluaciones.length === 0) {
            return res.status(404).json({ mensaje: 'Las evaluaciones seleccionadas ya no existen.' });
        }

        const { deletedCount } = await Evaluacion.deleteMany({ _id: { $in: evaluaciones.map((e) => e._id) } });

        await Auditoria.insertMany(
            evaluaciones.map((evaluacion) => ({
                accion: 'eliminar_evaluacion',
                actor: req.usuario._id,
                actorCorreo: req.usuario.correo,
                objetivo: evaluacion.usuario?._id,
                objetivoCorreo: evaluacion.usuario?.correo,
                detalle: [
                    `Evaluación ${evaluacion._id}`,
                    evaluacion.usuario?.nombre ? `de ${evaluacion.usuario.nombre}` : '',
                    evaluacion.fecha ? `del ${new Date(evaluacion.fecha).toISOString().slice(0, 10)}` : '',
                    evaluacion.area ? `· Área: ${evaluacion.area}` : '',
                    evaluacion.nodosEvaluados?.length ? `· Líneas: ${evaluacion.nodosEvaluados.map((n) => n.nodo).join(', ')}` : ''
                ].filter(Boolean).join(' ').slice(0, 900),
                ip: String(req.ip || '').replace('::ffff:', '')
            })),
            { ordered: false }
        ).catch((error) => console.error('No se pudo registrar auditoría:', error.message));

        const noEncontradas = ids.length - evaluaciones.length;

        return res.status(200).json({
            mensaje: deletedCount === 1
                ? 'Se eliminó 1 evaluación del historial.'
                : `Se eliminaron ${deletedCount} evaluaciones del historial.`,
            eliminadas: evaluaciones.map((e) => String(e._id)),
            noEncontradas
        });
    } catch (error) {
        console.error('Error al eliminar evaluaciones:', error);

        return res.status(500).json({ mensaje: 'No pudimos eliminar las evaluaciones. Inténtalo de nuevo en unos momentos.' });
    }
};


// GET /api/admin/auditoria?accion=&limite=
const listarAuditoria = async (req, res) => {
    try {
        const filtro = {};
        const accion = texto(req.query.accion, 40);
        const limite = Math.min(500, Math.max(1, Number(req.query.limite) || 200));

        if (accion) filtro.accion = accion;

        const registros = await Auditoria
            .find(filtro)
            .sort({ fecha: -1 })
            .limit(limite)
            .lean();

        return res.status(200).json({ registros });
    } catch (error) {
        console.error('Error al obtener auditoría:', error);

        return res.status(500).json({ mensaje: 'No fue posible obtener la auditoría.' });
    }
};


// PUT /api/admin/niveles   { niveles: [{ numero, planta, objetivo }] }
// Planta y Objetivo únicos para la planta. Valores 1, 2, 3 o null (sin definir).
const guardarNiveles = async (req, res) => {
    try {
        const recibidos = req.body?.niveles;

        if (!Array.isArray(recibidos)) {
            return res.status(400).json({ mensaje: 'No recibimos Planta y Objetivo. Recarga la página e inténtalo de nuevo.' });
        }

        const validos = new Set(criterios.map((criterio) => String(criterio.numero)));
        const normalizar = (valor) =>
            valor === null || valor === undefined || valor === '' ? null : Number(valor);

        const documento =
            (await NivelesPlanta.findOne({ clave: 'planta' })) ||
            new NivelesPlanta({ clave: 'planta', niveles: [] });

        const actuales = new Map(
            documento.niveles.map((nivel) => [String(nivel.numero), {
                numero: String(nivel.numero),
                planta: nivel.planta ?? null,
                objetivo: nivel.objetivo ?? null
            }])
        );

        const cambios = [];

        for (const item of recibidos) {
            const numero = String(item?.numero ?? '');

            if (!validos.has(numero)) {
                return res.status(400).json({ mensaje: `El criterio ${numero} no existe.` });
            }

            const planta = normalizar(item.planta);
            const objetivo = normalizar(item.objetivo);

            for (const [campo, valor] of [['Planta', planta], ['Objetivo', objetivo]]) {
                if (valor !== null && ![1, 2, 3].includes(valor)) {
                    return res.status(400).json({
                        mensaje: `${campo} del criterio ${numero} debe ser 1, 2 o 3.`
                    });
                }
            }

            const anterior = actuales.get(numero) || { numero, planta: null, objetivo: null };

            if (anterior.planta !== planta || anterior.objetivo !== objetivo) {
                cambios.push(
                    `${numero}: ${anterior.planta ?? '—'}/${anterior.objetivo ?? '—'} → ${planta ?? '—'}/${objetivo ?? '—'}`
                );
            }

            actuales.set(numero, { numero, planta, objetivo });
        }

        if (cambios.length === 0) {
            return res.status(200).json({ mensaje: 'Sin cambios.', niveles: [...actuales.values()] });
        }

        // Se guardan en el orden de los criterios configurados
        documento.niveles = criterios
            .map((criterio) => actuales.get(String(criterio.numero)))
            .filter(Boolean)
            .map((nivel) => ({
                numero: nivel.numero,
                ...(nivel.planta !== null ? { planta: nivel.planta } : {}),
                ...(nivel.objetivo !== null ? { objetivo: nivel.objetivo } : {})
            }));
        documento.actualizadoPor = req.usuario._id;
        await documento.save();

        await registrarAuditoria(req, {
            accion: 'actualizar_niveles',
            detalle: `Planta/Objetivo · ${cambios.join(' · ')}`.slice(0, 900)
        });

        return res.status(200).json({
            mensaje: 'Planta y Objetivo guardados. Los evaluadores ya los ven en su formulario.',
            niveles: documento.niveles,
            actualizado: documento.updatedAt
        });
    } catch (error) {
        console.error('Error al guardar niveles:', error);

        return res.status(500).json({ mensaje: 'No fue posible guardar Planta y Objetivo.' });
    }
};


// GET /api/admin/lineas
// Líneas por área + en cuántas evaluaciones se ha usado cada una
const listarLineas = async (req, res) => {
    try {
        const [areas, info, usos] = await Promise.all([
            lineas.obtenerAreas(),
            lineas.obtenerInfo(),
            Evaluacion.aggregate([
                { $unwind: '$nodosEvaluados' },
                {
                    $group: {
                        _id: { area: '$nodosEvaluados.area', nodo: '$nodosEvaluados.nodo' },
                        total: { $sum: 1 }
                    }
                }
            ])
        ]);

        return res.status(200).json({
            areas,
            uso: Object.fromEntries(usos.map((item) => [`${item._id.area}|${item._id.nodo}`, item.total])),
            limites: { maxLineas: lineas.MAX_LINEAS, maxLongitud: lineas.MAX_LONGITUD },
            ...info
        });
    } catch (error) {
        console.error('Error al obtener líneas:', error);

        return res.status(500).json({ mensaje: 'No fue posible obtener las líneas.' });
    }
};


// PUT /api/admin/lineas   { areas: [{ nombre, nodos: [] }] }
const guardarLineas = async (req, res) => {
    try {
        const { areas, error } = lineas.validarAreas(req.body?.areas);

        if (error) {
            return res.status(400).json({ mensaje: error });
        }

        const anteriores = await lineas.obtenerAreas();
        const ubicacion = (lista) =>
            new Map(lista.flatMap((area) => area.nodos.map((nodo) => [nodo, area.nombre])));

        const antes = ubicacion(anteriores);
        const despues = ubicacion(areas);
        const cambios = [];

        for (const [nodo, area] of despues) {
            if (!antes.has(nodo)) cambios.push(`+ ${nodo} (${area})`);
            else if (antes.get(nodo) !== area) cambios.push(`${nodo}: ${antes.get(nodo)} → ${area}`);
        }

        for (const [nodo, area] of antes) {
            if (!despues.has(nodo)) cambios.push(`− ${nodo} (${area})`);
        }

        const ordenCambio = anteriores.some(
            (area, indice) => area.nodos.join('|') !== areas[indice].nodos.join('|')
        );

        if (cambios.length === 0 && !ordenCambio) {
            return res.status(200).json({ mensaje: 'Sin cambios.', areas: anteriores });
        }

        const guardadas = await lineas.guardarAreas(areas, req.usuario._id);

        await registrarAuditoria(req, {
            accion: 'actualizar_lineas',
            detalle: `Líneas · ${cambios.length ? cambios.join(' · ') : 'cambio de orden'}`.slice(0, 900)
        });

        return res.status(200).json({
            mensaje: 'Líneas guardadas. Las evaluaciones nuevas ya las usan; las guardadas conservan sus líneas.',
            areas: guardadas
        });
    } catch (error) {
        console.error('Error al guardar líneas:', error);

        return res.status(500).json({ mensaje: 'No fue posible guardar las líneas.' });
    }
};


// PUT /api/admin/respuestas   { criterios: [{ numero, opciones: [] }] }
const guardarRespuestas = async (req, res) => {
    try {
        const { criterios: lista, error } = validarLista(req.body?.criterios);

        if (error) return res.status(400).json({ mensaje: error });

        await RespuestasPredeterminadas.findOneAndUpdate(
            { clave: 'planta' },
            { criterios: lista, actualizadoPor: req.usuario._id },
            { upsert: true, setDefaultsOnInsert: true }
        );

        const total = lista.reduce((suma, item) => suma + item.opciones.length, 0);

        await registrarAuditoria(req, {
            accion: 'actualizar_respuestas',
            detalle: `${total} respuesta(s) en ${lista.filter((item) => item.opciones.length > 0).length} criterio(s)`
        });

        return res.status(200).json({ mensaje: 'Respuestas predeterminadas guardadas.', ...(await obtenerRespuestas()) });
    } catch (error) {
        console.error('Error al guardar respuestas predeterminadas:', error);

        return res.status(500).json({ mensaje: 'No pudimos guardar las respuestas. Inténtalo de nuevo en unos momentos.' });
    }
};


module.exports = {
    guardarRespuestas,
    listarAreas,
    listarUsuarios,
    crearUsuario,
    actualizarUsuario,
    restablecerPassword,
    eliminarUsuario,
    listarSesionesUsuario,
    cerrarSesionesUsuario,
    eliminarEvaluaciones,
    listarAuditoria,
    guardarNiveles,
    listarLineas,
    guardarLineas
};
