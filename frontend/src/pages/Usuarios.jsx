import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import { useDialogo } from '../components/dialogos';
import SesionesActivas from '../components/SesionesActivas';
import { apiJson } from '../utils/api';
import { formatearFecha } from '../utils/oma';

/*
 * =========================================================
 * ADMINISTRACIÓN DE USUARIOS (solo admin)
 *
 * - Crear usuarios y asignarlos a su área.
 * - Editar nombre, área y rol; activar / desactivar.
 * - Restablecer contraseña (temporal, se muestra una vez).
 * - Ver los resultados de cada usuario.
 * - Consultar la actividad (auditoría).
 * =========================================================
 */

const ETIQUETAS_ACCION = {
    login: 'Inicio de sesión',
    logout: 'Cierre de sesión',
    cerrar_sesion_equipo: 'Sesión cerrada en un equipo',
    cambiar_password: 'Cambio de contraseña',
    crear_usuario: 'Alta de usuario',
    editar_usuario: 'Edición de usuario',
    restablecer_password: 'Restablecimiento de contraseña',
    eliminar_usuario: 'Usuario eliminado',
    eliminar_evaluacion: 'Evaluación eliminada',
    programar_evaluacion: 'Evaluación programada',
    editar_programacion: 'Programación editada',
    eliminar_programacion: 'Programación eliminada',
    crear_evaluacion: 'Evaluación guardada',
    actualizar_niveles: 'Planta y Objetivo actualizados',
    actualizar_lineas: 'Líneas actualizadas',
    actualizar_respuestas: 'Respuestas predeterminadas actualizadas'
};

const ROL_NOMBRE = { admin: 'Administrador', evaluador: 'Evaluador' };


function iniciales(nombre = '') {
    return nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((parte) => parte[0].toUpperCase()).join('') || '?';
}

function estadoUsuario(usuario) {
    if (!usuario.activo) return { clase: 'gris', texto: 'Inactivo' };
    if (usuario.bloqueado) return { clase: 'rojo', texto: 'Bloqueado' };
    if (usuario.tienePassword === false) return { clase: 'ambar', texto: 'Sin contraseña' };
    if (usuario.debeCambiarPassword) return { clase: 'ambar', texto: 'Contraseña temporal' };

    return { clase: 'verde', texto: 'Activo' };
}


// ---------------------------------------------------------
// Ventana genérica (hoja inferior en móvil)
// ---------------------------------------------------------

function Ventana({ titulo, descripcion, icono, children, onCerrar }) {
    useEffect(() => {
        const alPresionar = (evento) => {
            if (evento.key === 'Escape') onCerrar();
        };

        document.addEventListener('keydown', alPresionar);

        return () => document.removeEventListener('keydown', alPresionar);
    }, [onCerrar]);

    return createPortal(
        <div className="modal-overlay hoja-movil">
            <div className="glass-strong validation-modal" role="dialog" aria-modal="true" aria-labelledby="ventana-titulo">
                <div className="validation-header" style={{ marginBottom: 16 }}>
                    {icono && <div className="validation-icon" aria-hidden="true">{icono}</div>}
                    <div>
                        <h2 className="validation-title" id="ventana-titulo">{titulo}</h2>
                        {descripcion && <p className="validation-description">{descripcion}</p>}
                    </div>
                </div>
                {children}
            </div>
        </div>,
        document.body
    );
}


// ---------------------------------------------------------
// Crear / editar usuario
// ---------------------------------------------------------

function FormularioUsuario({ usuario, areas, esPropio, onGuardado, onCerrar }) {
    const editando = Boolean(usuario);

    const [nombre, setNombre] = useState(usuario?.nombre || '');
    const [correo, setCorreo] = useState(usuario?.correo || '');
    const [area, setArea] = useState(usuario?.area || '');
    const [rol, setRol] = useState(usuario?.rol || 'evaluador');
    const [error, setError] = useState('');
    const [guardando, setGuardando] = useState(false);

    const guardar = async (evento) => {
        evento.preventDefault();

        if (nombre.trim().length < 3) return setError('Escribe el nombre completo.');
        if (!editando && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo.trim())) return setError('Escribe un correo válido.');
        if (!area) return setError('Selecciona el área.');

        try {
            setGuardando(true);
            setError('');

            const datos = editando
                ? await apiJson(`/admin/usuarios/${usuario.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ nombre: nombre.trim(), area, ...(esPropio ? {} : { rol }) })
                })
                : await apiJson('/admin/usuarios', {
                    method: 'POST',
                    body: JSON.stringify({ nombre: nombre.trim(), correo: correo.trim().toLowerCase(), area, rol })
                });

            onGuardado(datos);
        } catch (err) {
            setError(err.message);
        } finally {
            setGuardando(false);
        }
    };

    return (
        <Ventana
            titulo={editando ? 'Editar usuario' : 'Nuevo usuario'}
            descripcion={
                editando
                    ? usuario.correo
                    : 'Se generará una contraseña temporal que el usuario deberá cambiar al entrar.'
            }
            icono={editando ? '✏️' : '👤'}
            onCerrar={onCerrar}
        >
            <form onSubmit={guardar} noValidate>
                {error && <div className="aviso aviso-error" role="alert">{error}</div>}

                <div className="campo">
                    <label className="campo-label" htmlFor="u-nombre">Nombre completo</label>
                    <input
                        id="u-nombre"
                        className="campo-input"
                        value={nombre}
                        maxLength={120}
                        autoComplete="off"
                        onChange={(evento) => setNombre(evento.target.value)}
                        autoFocus
                    />
                </div>

                {!editando && (
                    <div className="campo">
                        <label className="campo-label" htmlFor="u-correo">Correo</label>
                        <input
                            id="u-correo"
                            className="campo-input"
                            type="email"
                            inputMode="email"
                            autoCapitalize="none"
                            autoComplete="off"
                            spellCheck={false}
                            maxLength={160}
                            placeholder="nombre@empresa.com"
                            value={correo}
                            onChange={(evento) => setCorreo(evento.target.value)}
                        />
                    </div>
                )}

                <div className="campo">
                    <label className="campo-label" htmlFor="u-area">Área</label>
                    <select
                        id="u-area"
                        className="form-select"
                        value={area}
                        onChange={(evento) => setArea(evento.target.value)}
                    >
                        <option value="">Selecciona el área</option>
                        {areas.map((nombreArea) => (
                            <option key={nombreArea} value={nombreArea}>{nombreArea}</option>
                        ))}
                    </select>
                </div>

                <div className="campo">
                    <span className="campo-label">Rol</span>
                    <div className="segmentado" role="radiogroup" aria-label="Rol">
                        {['evaluador', 'admin'].map((opcion) => (
                            <button
                                key={opcion}
                                type="button"
                                role="radio"
                                aria-checked={rol === opcion}
                                className={rol === opcion ? 'activo' : ''}
                                disabled={esPropio}
                                onClick={() => setRol(opcion)}
                            >
                                {ROL_NOMBRE[opcion]}
                            </button>
                        ))}
                    </div>
                    <div className="campo-ayuda">
                        {esPropio
                            ? 'No puedes cambiar tu propio rol.'
                            : rol === 'admin'
                                ? 'Podrá administrar usuarios y ver los resultados de todos.'
                                : 'Podrá capturar evaluaciones y ver solo las suyas.'}
                    </div>
                </div>

                <div className="validation-actions">
                    <button type="button" className="btn-secondary" onClick={onCerrar} disabled={guardando}>
                        Cancelar
                    </button>
                    <button type="submit" className="btn-primary" disabled={guardando}>
                        {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear usuario'}
                    </button>
                </div>
            </form>
        </Ventana>
    );
}


// ---------------------------------------------------------
// Contraseña temporal (se muestra una sola vez)
// ---------------------------------------------------------

function PasswordTemporal({ datos, onCerrar }) {
    const [copiado, setCopiado] = useState(false);

    const copiar = async () => {
        try {
            await navigator.clipboard.writeText(datos.password);
            setCopiado(true);
        } catch {
            setCopiado(false);
        }
    };

    return (
        <Ventana
            titulo="Contraseña temporal"
            descripcion={`Para ${datos.nombre} (${datos.correo}). Se muestra solo una vez: cópiala y compártela por un medio seguro.`}
            icono="🔑"
            onCerrar={onCerrar}
        >
            <div className="password-temporal">
                <code>{datos.password}</code>
                <button type="button" className="btn-secondary btn-sm" onClick={copiar}>
                    {copiado ? '✓ Copiada' : 'Copiar'}
                </button>
            </div>

            <p className="campo-ayuda">
                Al iniciar sesión, el usuario deberá crear su propia contraseña.
                Si la pierde, puedes restablecerla de nuevo.
            </p>

            <div className="validation-actions">
                <button type="button" className="btn-primary" onClick={onCerrar}>Listo</button>
            </div>
        </Ventana>
    );
}


// ---------------------------------------------------------
// Eliminar usuario (irreversible)
// ---------------------------------------------------------

function ConfirmarEliminacion({ usuario, onEliminado, onCerrar }) {
    const [confirmacion, setConfirmacion] = useState('');
    const [error, setError] = useState('');
    const [eliminando, setEliminando] = useState(false);

    const coincide = confirmacion.trim().toLowerCase() === usuario.correo;

    const eliminar = async (evento) => {
        evento.preventDefault();

        if (!coincide) return;

        try {
            setEliminando(true);
            setError('');

            const datos = await apiJson(
                `/admin/usuarios/${usuario.id}`,
                { method: 'DELETE', body: JSON.stringify({ confirmacion: confirmacion.trim() }) },
                'No fue posible eliminar el usuario.'
            );

            onEliminado(datos?.mensaje || `${usuario.nombre} fue eliminado.`);
        } catch (err) {
            setError(err.message);
        } finally {
            setEliminando(false);
        }
    };

    return (
        <Ventana
            titulo="Eliminar usuario"
            descripcion={`${usuario.nombre} · ${usuario.area}`}
            icono="🗑️"
            onCerrar={onCerrar}
        >
            <form onSubmit={eliminar} noValidate>
                {error && <div className="aviso aviso-error" role="alert">{error}</div>}

                <div className="aviso aviso-error" role="note" style={{ display: 'block' }}>
                    <strong>Esta acción no se puede deshacer.</strong> Se eliminarán el usuario y{' '}
                    <strong>
                        {usuario.evaluaciones} evaluación(es)
                    </strong>{' '}
                    que capturó. Sus resultados dejarán de aparecer en Historial, Resultados y exportaciones.
                    <br />
                    Si solo quieres quitarle el acceso, usa <strong>Desactivar</strong>: conserva su historial.
                </div>

                <div className="campo">
                    <label className="campo-label" htmlFor="confirmar-correo">
                        Para confirmar, escribe su correo: <span style={{ userSelect: 'all' }}>{usuario.correo}</span>
                    </label>
                    <input
                        id="confirmar-correo"
                        className="campo-input"
                        type="email"
                        autoComplete="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        value={confirmacion}
                        disabled={eliminando}
                        onChange={(evento) => setConfirmacion(evento.target.value)}
                        onPaste={(evento) => evento.preventDefault()}
                        autoFocus
                    />
                    <div className="campo-ayuda">Se escribe a mano (no se permite pegar) para evitar borrados accidentales.</div>
                </div>

                <div className="validation-actions">
                    <button type="button" className="btn-secondary" onClick={onCerrar} disabled={eliminando}>
                        Cancelar
                    </button>
                    <button type="submit" className="btn-primary btn-peligro" disabled={!coincide || eliminando}>
                        {eliminando ? 'Eliminando…' : 'Eliminar definitivamente'}
                    </button>
                </div>
            </form>
        </Ventana>
    );
}


// ---------------------------------------------------------
// Actividad (auditoría)
// ---------------------------------------------------------

function Actividad() {
    const [registros, setRegistros] = useState([]);
    const [accion, setAccion] = useState('');
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelado = false;

        apiJson(`/admin/auditoria?limite=200${accion ? `&accion=${encodeURIComponent(accion)}` : ''}`)
            .then((datos) => {
                if (!cancelado) {
                    setRegistros(datos?.registros || []);
                    setError('');
                }
            })
            .catch((err) => { if (!cancelado) setError(err.message); })
            .finally(() => { if (!cancelado) setCargando(false); });

        return () => { cancelado = true; };
    }, [accion]);

    return (
        <>
            <div className="glass barra-acciones">
                <label className="selector-evaluacion">
                    Tipo de actividad
                    <select
                        className="form-select"
                        value={accion}
                        onChange={(evento) => {
                            setCargando(true);
                            setError('');
                            setAccion(evento.target.value);
                        }}
                    >
                        <option value="">Toda la actividad</option>
                        {Object.entries(ETIQUETAS_ACCION).map(([clave, texto]) => (
                            <option key={clave} value={clave}>{texto}</option>
                        ))}
                    </select>
                </label>
                <span className="campo-ayuda">Últimos 200 registros · se conservan 180 días</span>
            </div>

            {cargando && <div className="glass loading-card"><div className="loading-spinner" /><p>Cargando actividad…</p></div>}
            {!cargando && error && <div className="aviso aviso-error">{error}</div>}
            {!cargando && !error && registros.length === 0 && (
                <div className="glass loading-card"><p>Sin actividad registrada.</p></div>
            )}

            {!cargando && !error && registros.length > 0 && (
                <div className="glass lista-actividad">
                    {registros.map((registro) => (
                        <div key={registro._id} className="actividad-fila">
                            <span className={`estado-punto ${registro.resultado === 'fallo' ? 'rojo' : 'verde'}`} aria-hidden="true" />
                            <div className="actividad-texto">
                                <strong>
                                    {ETIQUETAS_ACCION[registro.accion] || registro.accion}
                                    {registro.resultado === 'fallo' ? ' · fallido' : ''}
                                </strong>
                                <span>
                                    {registro.actorCorreo || 'Desconocido'}
                                    {registro.objetivoCorreo && registro.objetivoCorreo !== registro.actorCorreo
                                        ? ` → ${registro.objetivoCorreo}`
                                        : ''}
                                    {registro.detalle ? ` · ${registro.detalle}` : ''}
                                </span>
                            </div>
                            <div className="actividad-meta">
                                <span>{formatearFecha(registro.fecha)}</span>
                                {registro.ip && <span>IP {registro.ip}</span>}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}


// ---------------------------------------------------------
// Página
// ---------------------------------------------------------

function Usuarios({ usuarioActual, onVerResultados }) {
    const { confirmar } = useDialogo();
    const [pestana, setPestana] = useState('usuarios');
    const [usuarios, setUsuarios] = useState([]);
    const [areas, setAreas] = useState([]);

    const [busqueda, setBusqueda] = useState('');
    const [filtroArea, setFiltroArea] = useState('');
    const [filtroRol, setFiltroRol] = useState('');
    const [filtroEstado, setFiltroEstado] = useState('');

    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');
    const [mensaje, setMensaje] = useState('');

    const [editando, setEditando] = useState(null);       // null | 'nuevo' | usuario
    const [eliminando, setEliminando] = useState(null);   // usuario a eliminar
    const [viendoSesiones, setViendoSesiones] = useState(null);
    const [passwordMostrada, setPasswordMostrada] = useState(null);
    const [procesando, setProcesando] = useState('');


    // Cada incremento vuelve a consultar usuarios y áreas
    const [intento, setIntento] = useState(0);
    const recargar = () => setIntento((valor) => valor + 1);

    useEffect(() => {
        let cancelado = false;

        Promise.all([
            apiJson('/admin/usuarios', {}, 'No fue posible obtener los usuarios.'),
            apiJson('/admin/areas', {}, 'No fue posible obtener las áreas.')
        ])
            .then(([datosUsuarios, datosAreas]) => {
                if (cancelado) return;

                setUsuarios(datosUsuarios?.usuarios || []);
                setAreas(datosAreas?.areas || []);
                setError('');
            })
            .catch((err) => {
                if (!cancelado) setError(err.message);
            })
            .finally(() => {
                if (!cancelado) setCargando(false);
            });

        return () => {
            cancelado = true;
        };
    }, [intento]);


    const visibles = useMemo(() => {
        const texto = busqueda.trim().toLowerCase();

        return usuarios.filter((usuario) => {
            if (texto && !`${usuario.nombre} ${usuario.correo}`.toLowerCase().includes(texto)) return false;
            if (filtroArea && usuario.area !== filtroArea) return false;
            if (filtroRol && usuario.rol !== filtroRol) return false;
            if (filtroEstado === 'activo' && !usuario.activo) return false;
            if (filtroEstado === 'inactivo' && usuario.activo) return false;
            if (filtroEstado === 'pendiente' && !(usuario.tienePassword === false || usuario.debeCambiarPassword)) return false;

            return true;
        });
    }, [usuarios, busqueda, filtroArea, filtroRol, filtroEstado]);

    const conteo = {
        total: usuarios.length,
        activos: usuarios.filter((usuario) => usuario.activo).length,
        admins: usuarios.filter((usuario) => usuario.rol === 'admin' && usuario.activo).length,
        sinPassword: usuarios.filter((usuario) => usuario.activo && usuario.tienePassword === false).length
    };


    const restablecer = async (usuario) => {
        const aceptar = await confirmar({
            titulo: usuario.tienePassword === false ? 'Asignar contraseña temporal' : 'Restablecer contraseña',
            mensaje: `Se generará una contraseña temporal para ${usuario.nombre}. ${usuario.tienePassword === false ? '' : 'Su contraseña actual dejará de funcionar y se cerrarán sus sesiones abiertas. '}Deberá crear una nueva al iniciar sesión.`,
            textoConfirmar: 'Generar contraseña'
        });

        if (!aceptar) return;

        try {
            setProcesando(usuario.id);
            setMensaje('');

            const datos = await apiJson(`/admin/usuarios/${usuario.id}/restablecer-password`, { method: 'POST' });

            setPasswordMostrada({ password: datos.passwordTemporal, nombre: usuario.nombre, correo: usuario.correo });
            recargar();
        } catch (err) {
            setError(err.message);
        } finally {
            setProcesando('');
        }
    };

    const alternarActivo = async (usuario) => {
        const activar = !usuario.activo;

        if (!activar) {
            const aceptar = await confirmar({
                titulo: `Desactivar a ${usuario.nombre}`,
                mensaje: 'No podrá iniciar sesión y se cerrarán sus sesiones abiertas. Sus evaluaciones se conservan y puedes reactivarlo cuando quieras.',
                textoConfirmar: 'Desactivar',
                peligro: true
            });

            if (!aceptar) return;
        }

        try {
            setProcesando(usuario.id);
            setMensaje('');

            await apiJson(`/admin/usuarios/${usuario.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ activo: activar })
            });

            setMensaje(`${usuario.nombre} ${activar ? 'fue activado' : 'fue desactivado'}.`);
            recargar();
        } catch (err) {
            setError(err.message);
        } finally {
            setProcesando('');
        }
    };

    const alGuardar = async (datos) => {
        setEditando(null);

        if (datos?.passwordTemporal) {
            setPasswordMostrada({
                password: datos.passwordTemporal,
                nombre: datos.usuario.nombre,
                correo: datos.usuario.correo
            });
        } else {
            setMensaje(datos?.mensaje || 'Usuario actualizado.');
        }

        recargar();
    };


    return (
        <section className="oma-evaluation">
            <div className="page-heading encabezado-con-accion">
                <div>
                    <h1 className="page-title">Usuarios</h1>
                    <p className="page-subtitle">Altas, áreas, permisos y actividad de OMA Digital.</p>
                </div>

                {pestana === 'usuarios' && (
                    <button type="button" className="btn-primary" onClick={() => setEditando('nuevo')}>
                        + Nuevo usuario
                    </button>
                )}
            </div>

            <div className="segmentado pestanas" role="tablist">
                <button type="button" role="tab" aria-selected={pestana === 'usuarios'} className={pestana === 'usuarios' ? 'activo' : ''} onClick={() => setPestana('usuarios')}>
                    Usuarios
                </button>
                <button type="button" role="tab" aria-selected={pestana === 'actividad'} className={pestana === 'actividad' ? 'activo' : ''} onClick={() => setPestana('actividad')}>
                    Actividad
                </button>
            </div>

            {pestana === 'actividad' ? <Actividad /> : (
                <>
                    {mensaje && <div className="aviso aviso-exito" role="status">✓ {mensaje}</div>}
                    {error && <div className="aviso aviso-error" role="alert">{error}</div>}

                    <div className="resumen-grid">
                        <div className="glass resumen-tile">
                            <div className="resumen-tile-label">Usuarios</div>
                            <div className="resumen-tile-valor">{conteo.total}</div>
                            <div className="resumen-tile-nota">{conteo.activos} activos</div>
                        </div>
                        <div className="glass resumen-tile">
                            <div className="resumen-tile-label">Administradores</div>
                            <div className="resumen-tile-valor">{conteo.admins}</div>
                            <div className="resumen-tile-nota">activos</div>
                        </div>
                        <div className="glass resumen-tile">
                            <div className="resumen-tile-label">Sin contraseña</div>
                            <div className="resumen-tile-valor">{conteo.sinPassword}</div>
                            <div className="resumen-tile-nota">Restablece para darles acceso</div>
                        </div>
                        <div className="glass resumen-tile">
                            <div className="resumen-tile-label">Áreas</div>
                            <div className="resumen-tile-valor">{new Set(usuarios.map((usuario) => usuario.area)).size}</div>
                            <div className="resumen-tile-nota">con usuarios asignados</div>
                        </div>
                    </div>

                    <div className="glass filtros-usuarios">
                        <input
                            className="campo-input"
                            type="search"
                            placeholder="Buscar por nombre o correo"
                            aria-label="Buscar usuario"
                            value={busqueda}
                            onChange={(evento) => setBusqueda(evento.target.value)}
                        />
                        <select className="form-select" aria-label="Área" value={filtroArea} onChange={(evento) => setFiltroArea(evento.target.value)}>
                            <option value="">Todas las áreas</option>
                            {areas.map((area) => <option key={area} value={area}>{area}</option>)}
                        </select>
                        <select className="form-select" aria-label="Rol" value={filtroRol} onChange={(evento) => setFiltroRol(evento.target.value)}>
                            <option value="">Todos los roles</option>
                            <option value="admin">Administradores</option>
                            <option value="evaluador">Evaluadores</option>
                        </select>
                        <select className="form-select" aria-label="Estado" value={filtroEstado} onChange={(evento) => setFiltroEstado(evento.target.value)}>
                            <option value="">Todos los estados</option>
                            <option value="activo">Activos</option>
                            <option value="inactivo">Inactivos</option>
                            <option value="pendiente">Sin contraseña / temporal</option>
                        </select>
                    </div>

                    {cargando && <div className="glass loading-card"><div className="loading-spinner" /><p>Cargando usuarios…</p></div>}

                    {!cargando && visibles.length === 0 && (
                        <div className="glass loading-card"><p>No hay usuarios con esos filtros.</p></div>
                    )}

                    {!cargando && visibles.length > 0 && (
                        <div className="lista-usuarios">
                            {visibles.map((usuario) => {
                                const estado = estadoUsuario(usuario);
                                const esPropio = usuario.id === usuarioActual?.id;
                                const ocupado = procesando === usuario.id;

                                return (
                                    <article key={usuario.id} className={`glass usuario-fila ${usuario.activo ? '' : 'inactivo'}`}>
                                        <div className="usuario-identidad">
                                            <div className="avatar">{iniciales(usuario.nombre)}</div>
                                            <div style={{ minWidth: 0 }}>
                                                <div className="usuario-nombre">
                                                    {usuario.nombre}
                                                    {esPropio && <span className="etiqueta">Tú</span>}
                                                </div>
                                                <div className="usuario-correo">{usuario.correo}</div>
                                            </div>
                                        </div>

                                        <div className="usuario-datos">
                                            <span className="etiqueta">{usuario.area}</span>
                                            <span className={`etiqueta ${usuario.rol === 'admin' ? 'azul' : ''}`}>{ROL_NOMBRE[usuario.rol] || usuario.rol}</span>
                                            <span className={`etiqueta estado ${estado.clase}`}>
                                                <span className={`estado-punto ${estado.clase}`} aria-hidden="true" />
                                                {estado.texto}
                                            </span>
                                        </div>

                                        <div className="usuario-meta">
                                            <span>{usuario.evaluaciones} evaluación(es)</span>
                                            <span>
                                                {usuario.sesionesActivas
                                                    ? `Sesión abierta en ${usuario.sesionesActivas} equipo(s)`
                                                    : 'Sin sesiones abiertas'}
                                            </span>
                                            <span>
                                                {usuario.ultimoAcceso
                                                    ? `Último acceso: ${formatearFecha(usuario.ultimoAcceso)}`
                                                    : 'Nunca ha iniciado sesión'}
                                            </span>
                                        </div>

                                        <div className="usuario-acciones">
                                            <button type="button" className="btn-plain btn-sm" disabled={usuario.evaluaciones === 0} onClick={() => onVerResultados(usuario.id)}>
                                                Ver resultados
                                            </button>
                                            <button type="button" className="btn-plain btn-sm" onClick={() => setEditando(usuario)}>
                                                Editar
                                            </button>
                                            <button type="button" className="btn-plain btn-sm" disabled={!usuario.sesionesActivas} onClick={() => setViendoSesiones(usuario)}>
                                                Sesiones
                                            </button>
                                            {!esPropio && (
                                                <>
                                                    <button type="button" className="btn-plain btn-sm" disabled={ocupado || !usuario.activo} onClick={() => restablecer(usuario)}>
                                                        {usuario.tienePassword === false ? 'Asignar contraseña' : 'Restablecer contraseña'}
                                                    </button>
                                                    <button type="button" className={`btn-plain btn-sm ${usuario.activo ? 'peligro' : ''}`} disabled={ocupado} onClick={() => alternarActivo(usuario)}>
                                                        {usuario.activo ? 'Desactivar' : 'Activar'}
                                                    </button>
                                                    <button type="button" className="btn-plain btn-sm peligro" disabled={ocupado} onClick={() => setEliminando(usuario)}>
                                                        Eliminar
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            {editando && (
                <FormularioUsuario
                    usuario={editando === 'nuevo' ? null : editando}
                    areas={areas}
                    esPropio={editando !== 'nuevo' && editando.id === usuarioActual?.id}
                    onGuardado={alGuardar}
                    onCerrar={() => setEditando(null)}
                />
            )}

            {eliminando && (
                <ConfirmarEliminacion
                    usuario={eliminando}
                    onCerrar={() => setEliminando(null)}
                    onEliminado={(texto) => {
                        setEliminando(null);
                        setError('');
                        setMensaje(texto);
                        recargar();
                    }}
                />
            )}

            {viendoSesiones && (
                <SesionesActivas
                    usuario={viendoSesiones}
                    onCerrar={() => {
                        setViendoSesiones(null);
                        recargar();
                    }}
                />
            )}

            {passwordMostrada && (
                <PasswordTemporal datos={passwordMostrada} onCerrar={() => setPasswordMostrada(null)} />
            )}
        </section>
    );
}

export default Usuarios;
