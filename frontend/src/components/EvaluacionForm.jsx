import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import AvisoFlotante from './AvisoFlotante';
import MatrizOMA from './MatrizOMA';
import { useDialogo } from './dialogos';
import { apiJson } from '../utils/api';
import {
    COLORES_NIVEL,
    NIVELES,
    claveNodoSeleccion,
    filtrarAreas,
    formatearFecha,
    normalizarAreas,
    obtenerPendientes,
    todasLasClaves
} from '../utils/oma';
import {
    cargarBorrador,
    eliminarBorrador,
    guardarBorrador,
    obtenerFechaBorrador
} from '../utils/borradorEvaluacion';

/*
 * =========================================================
 * CAPTURA DE EVALUACIÓN OMA EN PISO
 *
 * 1. El evaluador elige las líneas (nodos) que va a evaluar,
 *    entre las que el calendario programó para hoy (el
 *    administrador puede evaluar cualquier línea).
 * 2. Califica esas líneas en los 13 criterios.
 * 3. Planta y Objetivo los define el administrador para
 *    toda la planta: el evaluador los ve ya cargados y
 *    bloqueados; el admin puede editarlos y guardarlos.
 *
 * El avance se guarda automáticamente en el navegador.
 * =========================================================
 */

const obtenerIdBorrador = (usuario) => usuario?.id || 'local';

const claveSeleccionGuardada = (usuario) =>
    `oma_digital_lineas_v1_${encodeURIComponent(String(usuario?.id || 'local'))}`;

function leerSeleccionGuardada(usuario) {
    try {
        const datos = JSON.parse(localStorage.getItem(claveSeleccionGuardada(usuario)) || '[]');
        return Array.isArray(datos) ? datos.map(String) : [];
    } catch {
        return [];
    }
}

function escribirSeleccionGuardada(usuario, seleccion) {
    try {
        localStorage.setItem(claveSeleccionGuardada(usuario), JSON.stringify(seleccion));
    } catch {
        // Sin almacenamiento: no se recuerda
    }
}


const valorValido = (valor) =>
    [1, 2, 3].includes(Number(valor)) ? Number(valor) : null;


function crearFilas(criterios, areas, niveles) {
    return Object.fromEntries(
        criterios.map((criterio) => {
            const valores = {};

            areas.forEach((area) => {
                valores[area.nombre] = {};
                area.nodos.forEach((nodo) => {
                    valores[area.nombre][nodo] = null;
                });
            });

            const nivel = niveles[criterio.numero] || {};

            return [
                criterio.numero,
                {
                    numero: criterio.numero,
                    planta: valorValido(nivel.planta),
                    objetivo: valorValido(nivel.objetivo),
                    valores
                }
            ];
        })
    );
}

// Map numero -> { planta, objetivo } desde la respuesta del servidor
const mapaNiveles = (lista) =>
    Object.fromEntries(
        (Array.isArray(lista) ? lista : []).map((nivel) => [
            String(nivel.numero),
            { planta: valorValido(nivel.planta), objetivo: valorValido(nivel.objetivo) }
        ])
    );


/*
 * Borrador: { filas, seleccion }. También acepta los
 * formatos anteriores (solo filas). Planta y Objetivo
 * nunca se toman del borrador: siempre los del servidor.
 */
function leerContenidoBorrador(borrador) {
    const datos = borrador?.evaluaciones;

    if (!datos || typeof datos !== 'object') return { filas: {}, seleccion: null };

    if (datos.filas && typeof datos.filas === 'object') {
        return { filas: datos.filas, seleccion: Array.isArray(datos.seleccion) ? datos.seleccion : null };
    }

    return { filas: datos, seleccion: null };
}

function borradorTieneValores(borrador) {
    const { filas } = leerContenidoBorrador(borrador);

    return Object.values(filas).some((fila) =>
        Object.values(fila?.valores ?? fila?.nodos ?? {}).some((area) =>
            Object.values(area || {}).some((valor) => valorValido(valor) !== null)
        )
    );
}

function integrarBorrador(filasBase, borrador, areas) {
    const { filas: guardadas } = leerContenidoBorrador(borrador);
    const filas = structuredClone(filasBase);

    Object.keys(filas).forEach((numero) => {
        const guardada = guardadas?.[numero];

        if (!guardada || typeof guardada !== 'object') return;

        const valores = guardada.valores ?? guardada.nodos ?? {};

        areas.forEach((area) => {
            area.nodos.forEach((nodo) => {
                filas[numero].valores[area.nombre][nodo] = valorValido(valores?.[area.nombre]?.[nodo]);
            });
        });
    });

    return filas;
}


// ---------------------------------------------------------
// Selector de líneas (nodos)
// ---------------------------------------------------------

function SelectorLineas({ areas, seleccion, onCambiar, deshabilitado, programadas = null }) {
    const elegidas = new Set(seleccion);
    const total = areas.reduce((suma, area) => suma + area.nodos.length, 0);

    const alternar = (clave) =>
        onCambiar((actual) =>
            actual.includes(clave) ? actual.filter((item) => item !== clave) : [...actual, clave]
        );

    const alternarArea = (area) => {
        const claves = area.nodos.map((nodo) => claveNodoSeleccion(area.nombre, nodo));
        const todas = claves.every((clave) => elegidas.has(clave));

        onCambiar((actual) =>
            todas
                ? actual.filter((clave) => !claves.includes(clave))
                : [...new Set([...actual, ...claves])]
        );
    };

    return (
        <div className="glass selector-lineas">
            <div className="filtro-criterios-encabezado">
                <div>
                    <span className="filtro-criterios-titulo">
                        {programadas ? 'Líneas programadas para hoy' : 'Líneas a evaluar'}
                    </span>
                    <div className="selector-lineas-conteo">
                        {seleccion.length === 0
                            ? programadas
                                ? 'Según el Calendario, hoy puedes evaluar estas líneas. Elige las que vas a evaluar.'
                                : 'Elige las líneas (nodos) que vas a evaluar.'
                            : `${seleccion.length} de ${total} línea(s) seleccionada(s)`}
                    </div>
                </div>

                <div className="barra-acciones-grupo">
                    <button type="button" className="btn-plain btn-sm" disabled={deshabilitado} onClick={() => onCambiar(todasLasClaves(areas))}>
                        Todas
                    </button>
                    <button type="button" className="btn-plain btn-sm" disabled={deshabilitado || seleccion.length === 0} onClick={() => onCambiar([])}>
                        Ninguna
                    </button>
                </div>
            </div>

            <div className="selector-lineas-areas">
                {areas.map((area) => {
                    const claves = area.nodos.map((nodo) => claveNodoSeleccion(area.nombre, nodo));
                    const todas = claves.every((clave) => elegidas.has(clave));

                    return (
                        <div key={area.nombre} className="selector-lineas-grupo">
                            <button
                                type="button"
                                className={`selector-lineas-area ${todas ? 'activo' : ''}`}
                                aria-pressed={todas}
                                disabled={deshabilitado}
                                onClick={() => alternarArea(area)}
                                title={todas ? `Quitar todas las líneas de ${area.nombre}` : `Elegir todas las líneas de ${area.nombre}`}
                            >
                                {area.nombre}
                            </button>

                            <div className="filtro-chips">
                                {area.nodos.map((nodo) => {
                                    const clave = claveNodoSeleccion(area.nombre, nodo);
                                    const activo = elegidas.has(clave);
                                    const hecha = programadas?.get(clave)?.realizada;

                                    return (
                                        <button
                                            key={clave}
                                            type="button"
                                            className={`filtro-chip ${activo ? 'activo' : ''}`}
                                            aria-pressed={activo}
                                            disabled={deshabilitado}
                                            onClick={() => alternar(clave)}
                                            title={hecha ? 'Ya la evaluaste hoy' : undefined}
                                        >
                                            {activo ? '✓ ' : ''}{nodo}
                                            {hecha && <span className="chip-hecha"> · evaluada</span>}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}


// ---------------------------------------------------------
// Formulario
// ---------------------------------------------------------

function EvaluacionForm({ usuario }) {
    const esAdmin = usuario?.rol === 'admin';
    const idBorrador = obtenerIdBorrador(usuario);
    const { confirmar } = useDialogo();

    const [areas, setAreas] = useState([]);
    const [criterios, setCriterios] = useState([]);
    const [filas, setFilas] = useState({});
    const [seleccion, setSeleccion] = useState(() => leerSeleccionGuardada(usuario));

    // Planta / Objetivo guardados en el servidor
    const [nivelesServidor, setNivelesServidor] = useState({});
    const [infoNiveles, setInfoNiveles] = useState(null);
    const [guardandoNiveles, setGuardandoNiveles] = useState(false);

    const [cargando, setCargando] = useState(true);
    const [errorCarga, setErrorCarga] = useState('');
    const [intentoCarga, setIntentoCarga] = useState(0);

    const [guardando, setGuardando] = useState(false);
    const [mensaje, setMensaje] = useState(null);
    const [resaltarPendientes, setResaltarPendientes] = useState(false);

    // Respuestas del evaluado (opcional) y lista predeterminada
    const [respuestas, setRespuestas] = useState({});
    const [listaRespuestas, setListaRespuestas] = useState([]);

    // Evaluador: líneas que el calendario programó para hoy
    const [programacionHoy, setProgramacionHoy] = useState(null);

    const [borradorPendiente, setBorradorPendiente] = useState(null);
    const [modificado, setModificado] = useState(false);
    const [ultimoGuardado, setUltimoGuardado] = useState(null);
    const [avisoGuardado, setAvisoGuardado] = useState(false);


    // -----------------------------------------------------
    // Configuración + Planta/Objetivo
    // -----------------------------------------------------

    useEffect(() => {
        let cancelado = false;

        const cargar = async () => {
            try {
                // Si Planta/Objetivo no se pueden leer, el formulario se
                // muestra igual (sin niveles) con un aviso, en lugar de
                // dejar la página vacía.
                const [datos, datosNiveles, datosHoy, datosRespuestas] = await Promise.all([
                    apiJson('/evaluaciones/config', {}, 'No se pudo obtener la configuración de la evaluación.'),
                    apiJson('/evaluaciones/niveles', {}, 'No se pudo obtener Planta y Objetivo.')
                        .catch((error) => {
                            console.error('Planta y Objetivo no disponibles:', error);
                            return { niveles: [], error: error.message };
                        }),
                    esAdmin
                        ? null
                        : apiJson('/calendario/hoy', {}, 'No pudimos consultar las líneas programadas para hoy.'),
                    apiJson('/evaluaciones/respuestas').catch(() => ({ criterios: [] }))
                ]);

                const todasLasAreas = normalizarAreas(datos?.areas);

                // El evaluador solo ve las líneas programadas hoy
                const programadas = esAdmin
                    ? null
                    : new Map((datosHoy?.lineas || []).map((linea) => [claveNodoSeleccion(linea.area, linea.nodo), linea]));

                const areasConfig = programadas
                    ? todasLasAreas
                        .map((area) => ({
                            ...area,
                            nodos: area.nodos.filter((nodo) => programadas.has(claveNodoSeleccion(area.nombre, nodo)))
                        }))
                        .filter((area) => area.nodos.length > 0)
                    : todasLasAreas;
                const criteriosConfig = (
                    Array.isArray(datos?.criterios) ? datos.criterios : []
                ).filter((criterio) => criterio?.numero !== undefined);

                if (todasLasAreas.length === 0 || criteriosConfig.length === 0) {
                    throw new Error(
                        'La evaluación aún no tiene criterios ni líneas configurados. Contacta al administrador.'
                    );
                }

                if (cancelado) return;

                const niveles = mapaNiveles(datosNiveles?.niveles);
                const validas = new Set(todasLasClaves(areasConfig));

                setAreas(areasConfig);
                setProgramacionHoy(programadas ? { fecha: datosHoy?.hoy, lineas: programadas } : null);
                setListaRespuestas(datosRespuestas?.criterios || []);
                setCriterios(criteriosConfig);
                setNivelesServidor(niveles);
                setInfoNiveles({ actualizado: datosNiveles?.actualizado, por: datosNiveles?.actualizadoPor, error: datosNiveles?.error || '' });
                setFilas(crearFilas(criteriosConfig, areasConfig, niveles));
                setSeleccion((actual) => actual.filter((clave) => validas.has(clave)));
                setErrorCarga('');

                const borrador = cargarBorrador(idBorrador);

                if (borrador && borradorTieneValores(borrador)) {
                    setBorradorPendiente(borrador);
                }
            } catch (error) {
                if (!cancelado) setErrorCarga(error.message);
            } finally {
                if (!cancelado) setCargando(false);
            }
        };

        cargar();

        return () => {
            cancelado = true;
        };
    }, [intentoCarga, idBorrador, esAdmin]);


    // Recordar la última selección de líneas de este usuario
    useEffect(() => {
        if (!cargando) escribirSeleccionGuardada(usuario, seleccion);
    }, [seleccion, cargando, usuario]);


    // -----------------------------------------------------
    // Autoguardado (no corre mientras se decide el borrador)
    // -----------------------------------------------------

    useEffect(() => {
        if (!modificado || borradorPendiente) return undefined;

        const temporizador = setTimeout(() => {
            const guardado = guardarBorrador({ filas, seleccion, respuestas }, idBorrador);

            if (guardado) {
                setUltimoGuardado(obtenerFechaBorrador(guardado));
                setModificado(false);
                setAvisoGuardado(true);
            }
        }, 600);

        return () => clearTimeout(temporizador);
    }, [filas, seleccion, respuestas, modificado, borradorPendiente, idBorrador]);

    useEffect(() => {
        if (!avisoGuardado || modificado) return undefined;

        const temporizador = setTimeout(() => setAvisoGuardado(false), 2600);

        return () => clearTimeout(temporizador);
    }, [avisoGuardado, ultimoGuardado, modificado]);


    // -----------------------------------------------------
    // Derivados
    // -----------------------------------------------------

    const areasElegidas = useMemo(() => filtrarAreas(areas, seleccion), [areas, seleccion]);

    const filasLista = useMemo(
        () => criterios.map((criterio) => filas[criterio.numero]).filter(Boolean),
        [criterios, filas]
    );

    // Celdas de nodos pendientes (solo las líneas elegidas)
    const pendientes = useMemo(
        () => obtenerPendientes(filasLista, areasElegidas, { incluirNiveles: false }),
        [filasLista, areasElegidas]
    );

    // Criterios sin Planta u Objetivo (según lo que hay en pantalla)
    const nivelesFaltantes = useMemo(
        () => filasLista.filter((fila) => !fila.planta || !fila.objetivo).map((fila) => fila.numero),
        [filasLista]
    );

    // Admin: cambios de Planta/Objetivo sin guardar en el servidor
    const cambiosNiveles = useMemo(
        () =>
            filasLista.filter((fila) => {
                const servidor = nivelesServidor[fila.numero] || {};
                return (servidor.planta ?? null) !== fila.planta || (servidor.objetivo ?? null) !== fila.objetivo;
            }),
        [filasLista, nivelesServidor]
    );

    const totalCampos = criterios.length * seleccion.length;

    const progreso = totalCampos > 0
        ? Math.round(((totalCampos - pendientes.length) / totalCampos) * 100)
        : 0;


    // -----------------------------------------------------
    // Acciones
    // -----------------------------------------------------

    const cambiarCelda = (numero, campo, valor, area, nodo) => {
        // Solo el administrador modifica Planta y Objetivo
        if (campo !== 'nodo' && !esAdmin) return;

        setFilas((actual) => {
            const fila = actual[numero];

            if (!fila) return actual;

            if (campo === 'nodo') {
                return {
                    ...actual,
                    [numero]: {
                        ...fila,
                        valores: {
                            ...fila.valores,
                            [area]: { ...fila.valores[area], [nodo]: valor }
                        }
                    }
                };
            }

            return { ...actual, [numero]: { ...fila, [campo]: valor } };
        });

        if (campo === 'nodo') setModificado(true);
        setMensaje(null);
    };

    const cambiarSeleccion = (actualizar) => {
        setSeleccion((actual) => (typeof actualizar === 'function' ? actualizar(actual) : actualizar));
        setModificado(true);
        setMensaje(null);
    };

    const restaurarBorrador = () => {
        setFilas((actual) => integrarBorrador(actual, borradorPendiente, areas));

        const { seleccion: seleccionBorrador } = leerContenidoBorrador(borradorPendiente);

        if (seleccionBorrador) {
            const validas = new Set(todasLasClaves(areas));
            setSeleccion(seleccionBorrador.filter((clave) => validas.has(clave)));
        }

        const respuestasBorrador = borradorPendiente?.evaluaciones?.respuestas;
        if (respuestasBorrador && typeof respuestasBorrador === 'object') setRespuestas(respuestasBorrador);

        setUltimoGuardado(obtenerFechaBorrador(borradorPendiente));
        setBorradorPendiente(null);
    };

    const descartarBorrador = () => {
        eliminarBorrador(idBorrador);
        setBorradorPendiente(null);
        setUltimoGuardado(null);
    };

    const limpiarMatriz = async () => {
        const aceptar = await confirmar({
            titulo: 'Limpiar valoraciones',
            mensaje: 'Se borrarán las valoraciones que capturaste en tus líneas. Planta, Objetivo y las líneas seleccionadas no cambian.',
            textoConfirmar: 'Limpiar',
            peligro: true
        });

        if (!aceptar) return;

        setFilas(crearFilas(criterios, areas, nivelesServidor));
        eliminarBorrador(idBorrador);
        setUltimoGuardado(null);
        setModificado(false);
        setResaltarPendientes(false);
        setMensaje(null);
    };

    const irAlPrimerPendiente = () => {
        const primero = pendientes[0];

        if (!primero) return;

        const id = `${primero.numero}|${primero.campo}|${primero.area || ''}|${primero.nodo || ''}`;
        const elemento = [...document.querySelectorAll('[data-campo]')].find(
            (nodo) => nodo.dataset.campo === id
        );

        elemento?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        (elemento?.matches('button') ? elemento : elemento?.querySelector('button'))
            ?.focus({ preventScroll: true });
    };


    // Admin: guarda Planta / Objetivo para toda la planta
    const guardarNiveles = async ({ silencioso = false } = {}) => {
        try {
            setGuardandoNiveles(true);

            const datos = await apiJson(
                '/admin/niveles',
                {
                    method: 'PUT',
                    body: JSON.stringify({
                        niveles: filasLista.map((fila) => ({
                            numero: fila.numero,
                            planta: fila.planta,
                            objetivo: fila.objetivo
                        }))
                    })
                },
                'No fue posible guardar Planta y Objetivo.'
            );

            setNivelesServidor(mapaNiveles(datos?.niveles));
            setInfoNiveles({ actualizado: datos?.actualizado || new Date().toISOString(), por: usuario?.nombre });

            if (!silencioso) {
                setMensaje({ tipo: 'exito', texto: datos?.mensaje || 'Planta y Objetivo guardados.' });
            }

            return true;
        } catch (error) {
            setMensaje({ tipo: 'error', texto: error.message });
            return false;
        } finally {
            setGuardandoNiveles(false);
        }
    };


    const guardarEvaluacion = async () => {
        if (seleccion.length === 0) {
            setMensaje({ tipo: 'error', texto: 'Elige al menos una línea (nodo) para evaluar.' });
            return;
        }

        if (nivelesFaltantes.length > 0) {
            setResaltarPendientes(true);
            setMensaje({
                tipo: 'error',
                texto: esAdmin
                    ? `Define Planta y Objetivo de los criterios: ${nivelesFaltantes.join(', ')}.`
                    : `El administrador aún no define Planta y Objetivo de: ${nivelesFaltantes.join(', ')}. Podrás guardar cuando lo haga.`
            });
            return;
        }

        if (pendientes.length > 0) {
            setResaltarPendientes(true);
            setMensaje({
                tipo: 'error',
                texto: `Faltan ${pendientes.length} celda(s) de tus líneas por capturar. Están marcadas en rojo.`
            });
            return;
        }

        try {
            setGuardando(true);
            setMensaje(null);

            // El admin guarda primero los cambios de Planta/Objetivo
            if (esAdmin && cambiosNiveles.length > 0) {
                const ok = await guardarNiveles({ silencioso: true });
                if (!ok) return;
            }

            const resultado = await apiJson(
                '/evaluaciones',
                {
                    method: 'POST',
                    body: JSON.stringify({
                        nodos: areasElegidas.flatMap((area) =>
                            area.nodos.map((nodo) => ({ area: area.nombre, nodo }))
                        ),
                        criterios: criterios.map((criterio) => {
                            const fila = filas[criterio.numero];
                            const evaluaciones = {};

                            areasElegidas.forEach((area) => {
                                evaluaciones[area.nombre] = {};
                                area.nodos.forEach((nodo) => {
                                    evaluaciones[area.nombre][nodo] = fila.valores?.[area.nombre]?.[nodo];
                                });
                            });

                            return { numero: criterio.numero, evaluaciones };
                        }),
                        respuestas: Object.entries(respuestas)
                            .map(([numero, item]) => ({ numero, opciones: item.opciones || [], comentario: String(item.comentario || '').trim() }))
                            .filter((item) => item.opciones.length > 0 || item.comentario)
                    })
                },
                'No se pudo guardar la evaluación.'
            );

            eliminarBorrador(idBorrador);

            // Las líneas guardadas quedan como evaluadas hoy
            if (programacionHoy) {
                setProgramacionHoy((actual) => {
                    const lineas = new Map(actual.lineas);
                    seleccion.forEach((clave) => {
                        if (lineas.has(clave)) lineas.set(clave, { ...lineas.get(clave), realizada: true });
                    });
                    return { ...actual, lineas };
                });
            }

            setFilas(crearFilas(criterios, areas, nivelesServidor));
            setRespuestas({});
            setUltimoGuardado(null);
            setModificado(false);
            setResaltarPendientes(false);
            setMensaje({
                tipo: 'exito',
                texto: `${resultado?.mensaje || 'Evaluación guardada correctamente.'} Líneas: ${seleccion.length}. Puedes consultarla en Historial o Resultados.`
            });

            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (error) {
            setMensaje({ tipo: 'error', texto: error.message });
        } finally {
            setGuardando(false);
        }
    };


    // -----------------------------------------------------
    // Render
    // -----------------------------------------------------

    if (cargando) {
        return (
            <div className="oma-evaluation">
                <div className="glass loading-card">
                    <div className="loading-spinner" />
                    <p>Cargando configuración de evaluación...</p>
                </div>
            </div>
        );
    }

    if (errorCarga) {
        return (
            <div className="oma-evaluation">
                <div className="glass error-card">
                    <div className="error-icon">!</div>
                    <div>
                        <strong>No se pudo cargar la evaluación</strong>
                        <p>{errorCarga}</p>
                        <button
                            type="button"
                            className="btn-primary"
                            style={{ marginTop: '12px' }}
                            onClick={() => {
                                setCargando(true);
                                setIntentoCarga((valor) => valor + 1);
                            }}
                        >
                            Reintentar
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const bloqueado = Boolean(borradorPendiente) || guardando;

    // Evaluador sin líneas programadas hoy
    if (programacionHoy && areas.length === 0) {
        return (
            <div className="oma-evaluation">
                <div className="page-heading">
                    <h1 className="page-title">Shop Floor OMA</h1>
                    <p className="page-subtitle">Evalúas las líneas que el administrador programa en el Calendario.</p>
                </div>

                <div className="glass sin-programacion">
                    <div className="sin-programacion-icono" aria-hidden="true">📅</div>
                    <div>
                        <strong>Hoy no tienes líneas programadas para evaluar</strong>
                        <p>
                            Consulta la sección <b>Calendario</b> para ver las próximas fechas.
                            Cuando el administrador programe una evaluación para hoy, aparecerá aquí.
                        </p>
                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => {
                                setCargando(true);
                                setIntentoCarga((valor) => valor + 1);
                            }}
                        >
                            Volver a consultar
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="oma-evaluation">
            <div className="page-heading">
                <h1 className="page-title">Shop Floor OMA</h1>
                <p className="page-subtitle">
                    {esAdmin
                        ? 'Define Planta y Objetivo para toda la planta y evalúa las líneas que elijas (1 Naranja · 2 Amarillo · 3 Verde).'
                        : 'Califica las líneas programadas para hoy en cada criterio (1 Naranja · 2 Amarillo · 3 Verde). Planta y Objetivo los define el administrador.'}
                </p>
            </div>

            {mensaje && (
                <div
                    className={`aviso ${mensaje.tipo === 'error' ? 'aviso-error' : 'aviso-exito'}`}
                    role={mensaje.tipo === 'error' ? 'alert' : 'status'}
                >
                    <span>{mensaje.tipo === 'exito' ? '✓ ' : ''}{mensaje.texto}</span>

                    {mensaje.tipo === 'error' && pendientes.length > 0 && nivelesFaltantes.length === 0 && (
                        <button type="button" className="btn-secondary btn-sm" onClick={irAlPrimerPendiente}>
                            Ir al primer pendiente
                        </button>
                    )}
                </div>
            )}

            {infoNiveles?.error && (
                <div className="aviso aviso-error" role="alert">
                    <span>No pudimos cargar Planta y Objetivo. {infoNiveles.error}</span>
                    <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={() => {
                            setCargando(true);
                            setIntentoCarga((valor) => valor + 1);
                        }}
                    >
                        Reintentar
                    </button>
                </div>
            )}

            {!esAdmin && !infoNiveles?.error && nivelesFaltantes.length > 0 && !mensaje && (
                <div className="aviso aviso-info" role="status">
                    El administrador aún no define Planta y Objetivo de {nivelesFaltantes.length} criterio(s).
                    Puedes capturar tus líneas, pero podrás guardar cuando estén definidos.
                </div>
            )}

            {esAdmin && (
                <div className="glass panel-niveles">
                    <div>
                        <span className="filtro-criterios-titulo">Planta y Objetivo · Administrador</span>
                        <div className="selector-lineas-conteo">
                            {cambiosNiveles.length > 0
                                ? `${cambiosNiveles.length} criterio(s) con cambios sin guardar.`
                                : nivelesFaltantes.length > 0
                                    ? `Faltan ${nivelesFaltantes.length} criterio(s) por definir. Haz clic en las columnas Planta y Objetivo.`
                                    : 'Definidos para toda la planta. Los evaluadores los ven bloqueados en su formulario.'}
                            {infoNiveles?.actualizado && cambiosNiveles.length === 0
                                ? ` Última actualización: ${formatearFecha(infoNiveles.actualizado)}${infoNiveles.por ? ` por ${infoNiveles.por}` : ''}.`
                                : ''}
                        </div>
                    </div>

                    <div className="barra-acciones-grupo">
                        {cambiosNiveles.length > 0 && (
                            <button
                                type="button"
                                className="btn-plain btn-sm"
                                disabled={guardandoNiveles}
                                onClick={() =>
                                    setFilas((actual) =>
                                        Object.fromEntries(
                                            Object.entries(actual).map(([numero, fila]) => [
                                                numero,
                                                {
                                                    ...fila,
                                                    planta: nivelesServidor[numero]?.planta ?? null,
                                                    objetivo: nivelesServidor[numero]?.objetivo ?? null
                                                }
                                            ])
                                        )
                                    )
                                }
                            >
                                Deshacer
                            </button>
                        )}
                        <button
                            type="button"
                            className="btn-secondary"
                            disabled={guardandoNiveles || cambiosNiveles.length === 0}
                            onClick={() => guardarNiveles()}
                        >
                            {guardandoNiveles ? 'Guardando…' : 'Guardar Planta y Objetivo'}
                        </button>
                    </div>
                </div>
            )}

            <SelectorLineas
                areas={areas}
                seleccion={seleccion}
                onCambiar={cambiarSeleccion}
                deshabilitado={bloqueado}
                programadas={programacionHoy?.lineas || null}
            />

            <div className="glass barra-acciones">
                <div className="barra-progreso">
                    <div className="barra-progreso-texto">
                        <span>
                            {seleccion.length === 0
                                ? 'Sin líneas seleccionadas'
                                : `${totalCampos - pendientes.length} de ${totalCampos} celdas · ${seleccion.length} línea(s)`}
                        </span>
                        <strong>{progreso}%</strong>
                    </div>

                    <div className="progress-track">
                        <div className="progress-bar" style={{ width: `${progreso}%` }} />
                    </div>

                    <div className="barra-progreso-nota">
                        {ultimoGuardado
                            ? `Borrador guardado a las ${new Date(ultimoGuardado).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`
                            : 'El avance se guarda automáticamente en este navegador.'}
                    </div>
                </div>

                <div className="barra-acciones-grupo">
                    <button type="button" className="btn-secondary" onClick={limpiarMatriz} disabled={guardando}>
                        Limpiar
                    </button>

                    <button
                        type="button"
                        className="btn-primary btn-lg"
                        onClick={guardarEvaluacion}
                        disabled={bloqueado || seleccion.length === 0}
                    >
                        {guardando ? 'Guardando…' : 'Guardar evaluación'}
                    </button>
                </div>
            </div>

            {seleccion.length === 0 && (
                <div className="aviso aviso-info" role="status">
                    Elige arriba al menos una línea para empezar a evaluar.
                    {esAdmin ? ' Mientras tanto puedes definir Planta y Objetivo en la matriz.' : ''}
                </div>
            )}

            <MatrizOMA
                areas={areasElegidas}
                criterios={criterios}
                filas={filas}
                editable={!bloqueado}
                nivelesEditables={esAdmin}
                resaltarPendientes={resaltarPendientes}
                onCambiar={cambiarCelda}
                respuestas={listaRespuestas.length > 0 && seleccion.length > 0 ? { opciones: listaRespuestas, valores: respuestas } : null}
                onCambiarRespuesta={(numero, valor) => {
                    setRespuestas((actual) => ({ ...actual, [numero]: valor }));
                    setModificado(true);
                }}
            />

            <div className="matriz-leyenda">
                {NIVELES.map((nivel) => (
                    <span key={nivel.valor}>
                        <i style={{ background: COLORES_NIVEL[nivel.valor] }} />
                        {nivel.valor} = {nivel.nombre}
                    </span>
                ))}
                <span>Promedio: menor a 2 naranja · de 2 a 2.99 amarillo · 3 verde</span>
                {!esAdmin && <span>🔒 Planta y Objetivo: definidos por el administrador</span>}
            </div>

            {borradorPendiente && createPortal(
                <div className="modal-overlay hoja-movil">
                    <div className="glass-strong validation-modal" role="dialog" aria-modal="true">
                        <div className="validation-header">
                            <div className="validation-icon">💾</div>
                            <div>
                                <h2 className="validation-title">Borrador encontrado</h2>
                                <p className="validation-description">
                                    Hay una evaluación sin enviar guardada en este navegador
                                    {obtenerFechaBorrador(borradorPendiente)
                                        ? ` (${new Date(obtenerFechaBorrador(borradorPendiente)).toLocaleString('es-MX')})`
                                        : ''}
                                    . ¿Quieres continuar con ella?
                                </p>
                            </div>
                        </div>

                        <div className="validation-actions">
                            <button type="button" className="btn-primary" onClick={restaurarBorrador}>
                                Continuar con borrador
                            </button>
                            <button type="button" className="btn-secondary" onClick={descartarBorrador}>
                                Empezar desde cero
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            <AvisoFlotante
                visible={avisoGuardado && Boolean(ultimoGuardado)}
                titulo="Borrador guardado"
                detalle={
                    ultimoGuardado
                        ? `En este navegador · ${new Date(ultimoGuardado).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`
                        : ''
                }
            />
        </div>
    );
}

export default EvaluacionForm;
