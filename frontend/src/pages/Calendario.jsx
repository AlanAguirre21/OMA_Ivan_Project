import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import { useDialogo } from '../components/dialogos';
import { apiJson } from '../utils/api';
import {
    DIAS_SEMANA,
    ESTADOS,
    MESES,
    diasDeCuadricula,
    estadoProgramacion,
    fechaLarga,
    hoyTexto
} from '../utils/calendario';
import { normalizarAreas } from '../utils/oma';
import { CONSULTA_MOVIL, useMediaQuery } from '../utils/useMediaQuery';

/*
 * =========================================================
 * CALENDARIO DE EVALUACIONES POR LÍNEA
 *
 * Todos lo consultan; el administrador programa, edita y
 * elimina. Se exporta a Excel el mes que se está viendo.
 * =========================================================
 */

const lineasTexto = (programacion) => programacion.lineas.map((linea) => linea.nodo).join(', ');


// ---------------------------------------------------------
// Ventana para programar / editar (admin) o ver detalle
// ---------------------------------------------------------

function VentanaProgramacion({ programacion, fechaInicial, areas, esAdmin, onGuardado, onCerrar }) {
    const { confirmar } = useDialogo();
    const editando = Boolean(programacion);

    const [fecha, setFecha] = useState(programacion?.fecha || fechaInicial || hoyTexto());
    const [lineas, setLineas] = useState(() =>
        new Set((programacion?.lineas || []).map((linea) => `${linea.area}|${linea.nodo}`))
    );
    const [nota, setNota] = useState(programacion?.nota || '');
    const [repetir, setRepetir] = useState(0);
    const [error, setError] = useState('');
    const [guardando, setGuardando] = useState(false);

    useEffect(() => {
        const alPresionar = (evento) => {
            if (evento.key === 'Escape') onCerrar();
        };

        document.addEventListener('keydown', alPresionar);

        return () => document.removeEventListener('keydown', alPresionar);
    }, [onCerrar]);

    const alternar = (clave) =>
        setLineas((actual) => {
            const nuevo = new Set(actual);
            if (nuevo.has(clave)) nuevo.delete(clave); else nuevo.add(clave);
            return nuevo;
        });

    const guardar = async (evento) => {
        evento.preventDefault();

        if (!fecha) return setError('Indica la fecha.');
        if (lineas.size === 0) return setError('Elige al menos una línea.');

        try {
            setGuardando(true);
            setError('');

            const cuerpo = {
                fecha,
                nota: nota.trim(),
                lineas: [...lineas].map((clave) => {
                    const [area, ...resto] = clave.split('|');
                    return { area, nodo: resto.join('|') };
                })
            };

            const datos = editando
                ? await apiJson(`/admin/calendario/${programacion.id}`, { method: 'PATCH', body: JSON.stringify(cuerpo) })
                : await apiJson('/admin/calendario', { method: 'POST', body: JSON.stringify({ ...cuerpo, repetirSemanas: repetir }) });

            onGuardado(datos?.mensaje || 'Calendario actualizado.', fecha);
        } catch (err) {
            setError(err.message);
        } finally {
            setGuardando(false);
        }
    };

    const eliminar = async (soloEsta) => {
        const aceptar = await confirmar({
            titulo: soloEsta ? 'Eliminar esta programación' : 'Eliminar esta y las siguientes',
            mensaje: soloEsta
                ? `Se quitará del calendario la evaluación del ${fechaLarga(programacion.fecha)}.`
                : 'Se quitarán esta programación y las siguientes de la misma repetición semanal.',
            textoConfirmar: 'Eliminar',
            peligro: true
        });

        if (!aceptar) return;

        try {
            setGuardando(true);
            const datos = await apiJson(
                `/admin/calendario/${programacion.id}${soloEsta ? '' : '?serie=1'}`,
                { method: 'DELETE' }
            );
            onGuardado(datos?.mensaje || 'Programación eliminada.', programacion.fecha);
        } catch (err) {
            setError(err.message);
            setGuardando(false);
        }
    };

    // Vista de solo lectura (evaluadores)
    if (!esAdmin) {
        const estado = estadoProgramacion(programacion);

        return createPortal(
            <div className="modal-overlay hoja-movil" onMouseDown={(evento) => evento.target === evento.currentTarget && onCerrar()}>
                <div className="glass-strong validation-modal" role="dialog" aria-modal="true" aria-labelledby="prog-titulo">
                    <div className="validation-header">
                        <div className="validation-icon" aria-hidden="true">📅</div>
                        <div>
                            <h2 className="validation-title" id="prog-titulo">Evaluación programada</h2>
                            <p className="validation-description">{fechaLarga(programacion.fecha)}</p>
                        </div>
                    </div>

                    <div className="detalle-programacion">
                        <span className={`estado-prog ${estado.clave}`}>{estado.texto}</span>
                        <ul>
                            {programacion.lineas.map((linea) => (
                                <li key={`${linea.area}|${linea.nodo}`}>
                                    <span aria-hidden="true">{linea.realizada ? '✓' : '○'}</span>
                                    <strong>{linea.nodo}</strong> · {linea.area}
                                    {linea.realizada && <span className="campo-ayuda"> — ya la evaluaste</span>}
                                </li>
                            ))}
                        </ul>
                        {programacion.nota && <p className="campo-ayuda">{programacion.nota}</p>}
                    </div>

                    <div className="validation-actions">
                        <button type="button" className="btn-primary" onClick={onCerrar}>Entendido</button>
                    </div>
                </div>
            </div>,
            document.body
        );
    }

    return createPortal(
        <div className="modal-overlay hoja-movil">
            <div className="glass-strong validation-modal ventana-programar" role="dialog" aria-modal="true" aria-labelledby="prog-titulo">
                <div className="validation-header" style={{ marginBottom: 14 }}>
                    <div className="validation-icon" aria-hidden="true">📅</div>
                    <div>
                        <h2 className="validation-title" id="prog-titulo">
                            {editando ? 'Editar programación' : 'Programar evaluación'}
                        </h2>
                        <p className="validation-description">Elige la fecha y las líneas que se evaluarán ese día.</p>
                    </div>
                </div>

                <form onSubmit={guardar} noValidate>
                    {error && <div className="aviso aviso-error" role="alert">{error}</div>}

                    <div className="fila-campos">
                        <div className="campo">
                            <label className="campo-label" htmlFor="prog-fecha">Fecha</label>
                            <input
                                id="prog-fecha"
                                className="campo-input"
                                type="date"
                                value={fecha}
                                disabled={guardando}
                                onChange={(evento) => setFecha(evento.target.value)}
                            />
                        </div>

                        {!editando && (
                            <div className="campo">
                                <label className="campo-label" htmlFor="prog-repetir">Repetir cada semana</label>
                                <select
                                    id="prog-repetir"
                                    className="form-select"
                                    value={repetir}
                                    disabled={guardando}
                                    onChange={(evento) => setRepetir(Number(evento.target.value))}
                                >
                                    <option value={0}>No repetir</option>
                                    {[1, 2, 3, 4, 8, 12, 26, 52].map((n) => (
                                        <option key={n} value={n}>{n} semana(s) más</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    <div className="campo">
                        <span className="campo-label">Líneas ({lineas.size})</span>
                        <div className="selector-lineas-areas">
                            {areas.filter((area) => area.nodos.length > 0).map((area) => (
                                <div key={area.nombre} className="selector-lineas-grupo">
                                    <span className="selector-lineas-area" style={{ cursor: 'default' }}>{area.nombre}</span>
                                    <div className="filtro-chips">
                                        {area.nodos.map((nodo) => {
                                            const clave = `${area.nombre}|${nodo}`;
                                            const activo = lineas.has(clave);

                                            return (
                                                <button
                                                    key={clave}
                                                    type="button"
                                                    className={`filtro-chip ${activo ? 'activo' : ''}`}
                                                    aria-pressed={activo}
                                                    disabled={guardando}
                                                    onClick={() => alternar(clave)}
                                                >
                                                    {activo ? '✓ ' : ''}{nodo}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="campo">
                        <label className="campo-label" htmlFor="prog-nota">Nota (opcional)</label>
                        <input
                            id="prog-nota"
                            className="campo-input"
                            maxLength={300}
                            placeholder="Ej. Turno matutino, auditoría con gerencia…"
                            value={nota}
                            disabled={guardando}
                            onChange={(evento) => setNota(evento.target.value)}
                        />
                    </div>

                    <div className="validation-actions">
                        {editando && (
                            <>
                                <button type="button" className="btn-plain peligro" disabled={guardando} onClick={() => eliminar(true)}>
                                    Eliminar
                                </button>
                                {programacion.serie && (
                                    <button type="button" className="btn-plain peligro" disabled={guardando} onClick={() => eliminar(false)}>
                                        Eliminar esta y las siguientes
                                    </button>
                                )}
                            </>
                        )}
                        <span style={{ flex: 1 }} />
                        <button type="button" className="btn-secondary" onClick={onCerrar} disabled={guardando}>Cancelar</button>
                        <button type="submit" className="btn-primary" disabled={guardando}>
                            {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Programar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}


// ---------------------------------------------------------
// Página
// ---------------------------------------------------------

function Calendario({ usuario }) {
    const esAdmin = usuario?.rol === 'admin';
    const esMovil = useMediaQuery(CONSULTA_MOVIL);
    const { avisar } = useDialogo();

    const hoy = hoyTexto();
    const [mes, setMes] = useState(() => ({ anio: new Date().getFullYear(), mes: new Date().getMonth() }));
    const [programaciones, setProgramaciones] = useState([]);
    const [areas, setAreas] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');
    const [mensaje, setMensaje] = useState('');
    const [intento, setIntento] = useState(0);
    const [ventana, setVentana] = useState(null);   // { programacion } | { fecha }
    const [visibleDesde, setVisibleDesde] = useState(null);
    const [exportando, setExportando] = useState(false);

    const dias = useMemo(() => diasDeCuadricula(mes.anio, mes.mes), [mes]);

    useEffect(() => {
        let cancelado = false;

        Promise.all([
            apiJson(`/calendario?desde=${dias[0]}&hasta=${dias[dias.length - 1]}`, {}, 'No pudimos cargar el calendario.'),
            apiJson('/evaluaciones/config', {}, 'No pudimos cargar las líneas.')
        ])
            .then(([datos, config]) => {
                if (cancelado) return;
                setProgramaciones(datos?.programaciones || []);
                setVisibleDesde(datos?.visibleDesde || null);
                setAreas(normalizarAreas(config?.areas));
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
    }, [dias, intento]);

    const porDia = useMemo(() => {
        const mapa = new Map();
        programaciones.forEach((item) => {
            if (!mapa.has(item.fecha)) mapa.set(item.fecha, []);
            mapa.get(item.fecha).push(item);
        });
        return mapa;
    }, [programaciones]);

    const prefijoMes = `${mes.anio}-${String(mes.mes + 1).padStart(2, '0')}`;
    const delMes = programaciones.filter((item) => item.fecha.startsWith(prefijoMes));

    const resumen = ESTADOS.map((estado) => ({
        ...estado,
        total: delMes.filter((item) => estadoProgramacion(item, hoy).clave === estado.clave).length
    }));

    const moverMes = (delta) => {
        setCargando(true);
        setMes((actual) => {
            const fecha = new Date(actual.anio, actual.mes + delta, 1);
            return { anio: fecha.getFullYear(), mes: fecha.getMonth() };
        });
    };

    const irHoy = () => {
        const ahora = new Date();
        if (ahora.getFullYear() === mes.anio && ahora.getMonth() === mes.mes) return;
        setCargando(true);
        setMes({ anio: ahora.getFullYear(), mes: ahora.getMonth() });
    };

    const alGuardar = (texto) => {
        setVentana(null);
        setMensaje(texto);
        setIntento((valor) => valor + 1);
    };

    const exportar = async () => {
        try {
            setExportando(true);
            const { exportarCalendarioExcel } = await import('../utils/exportCalendario');
            await exportarCalendarioExcel({ anio: mes.anio, mes: mes.mes, programaciones: delMes });
        } catch (err) {
            await avisar({ titulo: 'No pudimos generar el Excel', mensaje: err.message || 'Inténtalo de nuevo en unos momentos.', tipo: 'error' });
        } finally {
            setExportando(false);
        }
    };

    const etiqueta = (item) => {
        const estado = estadoProgramacion(item, hoy);

        return (
            <button
                key={item.id}
                type="button"
                className={`prog-etiqueta ${estado.clave}`}
                title={`${lineasTexto(item)}${item.nota ? ` · ${item.nota}` : ''} · ${estado.texto}`}
                onClick={(evento) => {
                    evento.stopPropagation();
                    setVentana({ programacion: item });
                }}
            >
                {lineasTexto(item)}
            </button>
        );
    };

    return (
        <section className="oma-evaluation">
            <div className="page-heading encabezado-con-accion">
                <div>
                    <h1 className="page-title">Calendario</h1>
                    <p className="page-subtitle">
                        {esAdmin
                            ? 'Programa qué líneas se evalúan cada día. Haz clic en un día para agregar.'
                            : 'Estas son las líneas que te toca evaluar. El día programado aparecerán en Evaluación.'}
                    </p>
                    {!esAdmin && visibleDesde && visibleDesde > dias[0] && (
                        <p className="campo-ayuda">Se muestran las fechas a partir de tu alta en el sistema ({visibleDesde.split('-').reverse().join('/')}).</p>
                    )}
                </div>

                <div className="barra-acciones-grupo">
                    <button type="button" className="btn-secondary" disabled={exportando || cargando} onClick={exportar}>
                        {exportando ? 'Generando…' : 'Exportar Excel'}
                    </button>
                    {esAdmin && (
                        <button type="button" className="btn-primary" onClick={() => setVentana({ fecha: hoy >= dias[0] && hoy <= dias[dias.length - 1] ? hoy : `${prefijoMes}-01` })}>
                            + Programar
                        </button>
                    )}
                </div>
            </div>

            {mensaje && <div className="aviso aviso-exito" role="status">✓ {mensaje}</div>}
            {error && (
                <div className="aviso aviso-error" role="alert">
                    <span>{error}</span>
                    <button type="button" className="btn-secondary btn-sm" onClick={() => { setCargando(true); setIntento((valor) => valor + 1); }}>
                        Reintentar
                    </button>
                </div>
            )}

            <div className="glass barra-calendario">
                <div className="barra-acciones-grupo">
                    <button type="button" className="btn-secondary btn-icon" aria-label="Mes anterior" onClick={() => moverMes(-1)}>‹</button>
                    <h2 className="mes-titulo">{MESES[mes.mes]} {mes.anio}</h2>
                    <button type="button" className="btn-secondary btn-icon" aria-label="Mes siguiente" onClick={() => moverMes(1)}>›</button>
                    <button type="button" className="btn-plain btn-sm" onClick={irHoy}>Hoy</button>
                </div>

                <div className="leyenda-estados">
                    {resumen.map((estado) => (
                        <span key={estado.clave}>
                            <i className={`estado-punto-prog ${estado.clave}`} aria-hidden="true" />
                            {estado.texto}: <strong>{estado.total}</strong>
                        </span>
                    ))}
                </div>
            </div>

            {cargando && <div className="glass loading-card"><div className="loading-spinner" /><p>Cargando calendario…</p></div>}

            {!cargando && !esMovil && (
                <div className="glass calendario-mes" role="grid" aria-label={`${MESES[mes.mes]} ${mes.anio}`}>
                    {DIAS_SEMANA.map((dia) => (
                        <div key={dia} className="calendario-cabecera" role="columnheader">{dia.slice(0, 3)}</div>
                    ))}

                    {dias.map((dia) => {
                        const fuera = !dia.startsWith(prefijoMes);
                        const lista = porDia.get(dia) || [];

                        return (
                            <div
                                key={dia}
                                role="gridcell"
                                className={`calendario-dia ${fuera ? 'fuera' : ''} ${dia === hoy ? 'hoy' : ''} ${esAdmin ? 'editable' : ''}`}
                                onClick={esAdmin ? () => setVentana({ fecha: dia }) : undefined}
                                onKeyDown={esAdmin ? (evento) => { if (evento.key === 'Enter') setVentana({ fecha: dia }); } : undefined}
                                tabIndex={esAdmin ? 0 : undefined}
                                aria-label={`${fechaLarga(dia)}: ${lista.length ? `${lista.length} programación(es)` : 'sin programación'}`}
                            >
                                <span className="calendario-numero">{Number(dia.slice(8))}</span>
                                <div className="calendario-etiquetas">
                                    {lista.map(etiqueta)}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {!cargando && esMovil && (
                <div className="agenda">
                    {delMes.length === 0 && (
                        <div className="glass loading-card"><p>No hay evaluaciones programadas este mes.</p></div>
                    )}

                    {[...new Set(delMes.map((item) => item.fecha))].map((dia) => (
                        <div key={dia} className={`glass agenda-dia ${dia === hoy ? 'hoy' : ''}`}>
                            <div className="agenda-fecha">{fechaLarga(dia)}</div>
                            {(porDia.get(dia) || []).map((item) => {
                                const estado = estadoProgramacion(item, hoy);

                                return (
                                    <button key={item.id} type="button" className="agenda-item" onClick={() => setVentana({ programacion: item })}>
                                        <span className={`estado-punto-prog ${estado.clave}`} aria-hidden="true" />
                                        <span className="agenda-lineas">
                                            <strong>{lineasTexto(item)}</strong>
                                            {item.nota && <span className="campo-ayuda">{item.nota}</span>}
                                        </span>
                                        <span className={`estado-prog ${estado.clave}`}>{estado.texto}</span>
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </div>
            )}

            {ventana && (
                <VentanaProgramacion
                    programacion={ventana.programacion}
                    fechaInicial={ventana.fecha}
                    areas={areas}
                    esAdmin={esAdmin}
                    onGuardado={alGuardar}
                    onCerrar={() => setVentana(null)}
                />
            )}
        </section>
    );
}

export default Calendario;
