import { useEffect, useMemo, useState } from 'react';

import FiltroSupervision from '../components/FiltroSupervision';
import MatrizOMA from '../components/MatrizOMA';
import { useDialogo } from '../components/dialogos';
import { apiJson } from '../utils/api';
import {
    COLORES_NIVEL,
    NIVELES,
    areasDeEvaluacion,
    calcularResultados,
    colorDeValor,
    construirMatriz,
    evaluadorDe,
    formatearFecha,
    formatearPromedio,
    listaEvaluadores,
    normalizarAreas
} from '../utils/oma';

/*
 * =========================================================
 * RESULTADOS
 *
 * Muestra una evaluación como la hoja del Excel
 * (matriz + fila de promedios) y un resumen simple:
 * promedio por área y brecha Planta → Objetivo.
 * =========================================================
 */


function Tooltip({ datos }) {
    if (!datos) return null;

    return (
        <div
            className="tooltip-grafica"
            style={{
                left: Math.min(datos.x + 14, window.innerWidth - 280),
                top: datos.y + 14
            }}
        >
            {datos.contenido}
        </div>
    );
}


function Indicador({ etiqueta, valor, color, nota }) {
    return (
        <div className="glass resumen-tile">
            <div className="resumen-tile-label">{etiqueta}</div>
            <div className="resumen-tile-valor">
                {color && <i style={{ background: color }} aria-hidden="true" />}
                {valor}
            </div>
            {nota && <div className="resumen-tile-nota">{nota}</div>}
        </div>
    );
}


function GraficaAreas({ areas, promedioArea, onTooltip, filtrado }) {
    return (
        <div className="glass grafica-card">
            <div className="grafica-encabezado">
                <div>
                    <h2 className="grafica-titulo">Promedio por área</h2>
                    <p className="grafica-subtitulo">
                        Promedio de los nodos del área
                        {filtrado ? ' en los criterios filtrados' : ''} (escala 1 a 3).
                    </p>
                </div>
            </div>

            {areas.map((area) => {
                const valor = promedioArea[area.nombre];
                const ancho = valor ? Math.min(100, (valor / 3) * 100) : 0;

                return (
                    <div
                        key={area.nombre}
                        className="barra-fila"
                        onMouseMove={(evento) =>
                            onTooltip({
                                x: evento.clientX,
                                y: evento.clientY,
                                contenido: (
                                    <>
                                        <strong>{area.nombre}</strong>
                                        <br />
                                        Nodos: {area.nodos.join(', ')}
                                        <br />
                                        Promedio: {formatearPromedio(valor)}
                                    </>
                                )
                            })
                        }
                        onMouseLeave={() => onTooltip(null)}
                    >
                        <span>{area.nombre}</span>
                        <div className="barra-pista">
                            <div
                                className="barra-relleno"
                                style={{ width: `${ancho}%`, background: colorDeValor(valor) }}
                            />
                        </div>
                        <span className="barra-valor">{formatearPromedio(valor)}</span>
                    </div>
                );
            })}

            <div className="escala-ejes">
                <span />
                <div className="marcas">
                    {[0, 1, 2, 3].map((marca) => (
                        <span key={marca} style={{ left: `${(marca / 3) * 100}%` }}>
                            {marca}
                        </span>
                    ))}
                </div>
                <span />
            </div>
        </div>
    );
}


// ---------------------------------------------------------
// Brecha Planta → Objetivo
// ---------------------------------------------------------

function estadoBrecha(brecha) {
    if (brecha === null) return { clase: 'libre', icono: '·', texto: 'Sin datos' };
    if (brecha <= 0) {
        return brecha < 0
            ? { clase: 'arriba', icono: '▲', texto: 'Arriba del objetivo' }
            : { clase: 'ok', icono: '✓', texto: 'En objetivo' };
    }

    return brecha === 1
        ? { clase: 'falta1', icono: '!', texto: 'Falta 1 nivel' }
        : { clase: 'falta2', icono: '!!', texto: `Faltan ${brecha} niveles` };
}


function GraficaBrecha({ criterios, filas }) {
    const [orden, setOrden] = useState('brecha');

    const datos = criterios.map((criterio, indice) => {
        const planta = Number(filas[criterio.numero]?.planta) || null;
        const objetivo = Number(filas[criterio.numero]?.objetivo) || null;

        return {
            ...criterio,
            indice,
            planta,
            objetivo,
            brecha: planta && objetivo ? objetivo - planta : null
        };
    });

    const ordenados =
        orden === 'brecha'
            ? [...datos].sort(
                (a, b) => (b.brecha ?? -9) - (a.brecha ?? -9) || a.indice - b.indice
            )
            : datos;

    const conteo = {
        ok: datos.filter((dato) => dato.brecha !== null && dato.brecha <= 0).length,
        falta1: datos.filter((dato) => dato.brecha === 1).length,
        falta2: datos.filter((dato) => dato.brecha >= 2).length
    };

    return (
        <div className="glass grafica-card">
            <div className="grafica-encabezado">
                <div>
                    <h2 className="grafica-titulo">Brecha: Planta → Objetivo</h2>
                    <p className="grafica-subtitulo">
                        Cuántos niveles le faltan a la planta para llegar a su objetivo en cada criterio.
                    </p>
                </div>

                <div className="segmentado" role="group" aria-label="Ordenar">
                    <button
                        type="button"
                        className={orden === 'brecha' ? 'activo' : ''}
                        onClick={() => setOrden('brecha')}
                    >
                        Mayor brecha
                    </button>
                    <button
                        type="button"
                        className={orden === 'criterio' ? 'activo' : ''}
                        onClick={() => setOrden('criterio')}
                    >
                        Por criterio
                    </button>
                </div>
            </div>

            <div className="brecha-resumen">
                <div className="brecha-resumen-item">
                    <div className="brecha-resumen-valor">{conteo.ok}</div>
                    <div className="brecha-resumen-label">✓ En objetivo</div>
                </div>
                <div className="brecha-resumen-item">
                    <div className="brecha-resumen-valor">{conteo.falta1}</div>
                    <div className="brecha-resumen-label">! Les falta 1 nivel</div>
                </div>
                <div className="brecha-resumen-item">
                    <div className="brecha-resumen-valor">{conteo.falta2}</div>
                    <div className="brecha-resumen-label">!! Les faltan 2 niveles</div>
                </div>
            </div>

            <div className="brecha-leyenda">
                <span>
                    <i className="brecha-casilla planta" style={{ width: 16, height: 14 }} />
                    Nivel actual (Planta)
                </span>
                <span>
                    <i className="brecha-casilla falta" style={{ width: 16, height: 14 }} />
                    Lo que falta para el objetivo
                </span>
                <span>
                    <i className="brecha-casilla libre meta" style={{ width: 16, height: 14 }} />
                    Nivel objetivo (contorno)
                </span>
            </div>

            <div className="brecha-lista">
                {ordenados.map((dato) => {
                    const estado = estadoBrecha(dato.brecha);

                    return (
                        <div key={dato.numero} className="brecha-fila">
                            <div className="brecha-criterio">
                                <span className="matriz-criterio-numero">{dato.numero}</span>
                                <span className="brecha-criterio-nombre" title={dato.nombre}>
                                    {dato.nombre}
                                </span>
                            </div>

                            <div
                                className="brecha-escala"
                                role="img"
                                aria-label={`Planta ${dato.planta ?? 'sin dato'}, objetivo ${dato.objetivo ?? 'sin dato'}`}
                            >
                                {[1, 2, 3].map((nivel) => {
                                    let clase = 'libre';

                                    if (dato.planta && nivel <= dato.planta) {
                                        clase = 'planta';
                                    } else if (dato.objetivo && nivel <= dato.objetivo) {
                                        clase = 'falta';
                                    }

                                    return (
                                        <span
                                            key={nivel}
                                            className={`brecha-casilla ${clase} ${nivel === dato.objetivo ? 'meta' : ''}`}
                                        >
                                            {nivel}
                                        </span>
                                    );
                                })}
                            </div>

                            <span className={`brecha-estado ${estado.clase}`}>
                                <span aria-hidden="true">{estado.icono}</span>
                                {estado.texto}
                                {dato.planta && dato.objetivo && (
                                    <b>· {dato.planta} → {dato.objetivo}</b>
                                )}
                            </span>
                        </div>
                    );
                })}
            </div>

            <details className="grafica-tabla">
                <summary>Ver como tabla</summary>
                <table>
                    <thead>
                        <tr>
                            <th>Criterio</th>
                            <th>Planta</th>
                            <th>Objetivo</th>
                            <th>Faltan</th>
                        </tr>
                    </thead>
                    <tbody>
                        {datos.map((dato) => (
                            <tr key={dato.numero}>
                                <td>{dato.numero} {dato.nombre}</td>
                                <td>{dato.planta ?? '—'}</td>
                                <td>{dato.objetivo ?? '—'}</td>
                                <td>{dato.brecha === null ? '—' : Math.max(0, dato.brecha)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </details>
        </div>
    );
}


// ---------------------------------------------------------
// Filtro por criterio (selección múltiple)
// ---------------------------------------------------------

function FiltroCriterios({ criterios, seleccion, onCambiar }) {
    const todos = seleccion.length === 0;

    // Actualización funcional: dos toques seguidos no se pisan
    const alternar = (numero) =>
        onCambiar((actual) =>
            actual.includes(numero)
                ? actual.filter((item) => item !== numero)
                : [...actual, numero]
        );

    const elegidos = criterios.filter((criterio) => seleccion.includes(criterio.numero));

    return (
        <div className="glass filtro-criterios">
            <div className="filtro-criterios-encabezado">
                <span className="filtro-criterios-titulo">Filtrar por criterio</span>

                {!todos && (
                    <button type="button" className="btn-plain btn-sm" onClick={() => onCambiar([])}>
                        Quitar filtro
                    </button>
                )}
            </div>

            <div className="filtro-chips" role="group" aria-label="Criterios">
                <button
                    type="button"
                    className={`filtro-chip ${todos ? 'activo' : ''}`}
                    aria-pressed={todos}
                    onClick={() => onCambiar([])}
                >
                    Todos
                </button>

                {criterios.map((criterio) => {
                    const activo = seleccion.includes(criterio.numero);

                    return (
                        <button
                            key={criterio.numero}
                            type="button"
                            className={`filtro-chip ${activo ? 'activo' : ''}`}
                            aria-pressed={activo}
                            title={`${criterio.numero} ${criterio.nombre}`}
                            onClick={() => alternar(criterio.numero)}
                        >
                            {criterio.numero}
                        </button>
                    );
                })}
            </div>

            <div className="filtro-criterios-resumen">
                {todos
                    ? `Mostrando los ${criterios.length} criterios.`
                    : `Mostrando ${elegidos.length} de ${criterios.length}: ${elegidos
                        .map((criterio) => `${criterio.numero} ${criterio.nombre}`)
                        .join(' · ')}`}
            </div>
        </div>
    );
}


function Resultados({ usuario, evaluacionId = null, usuarioFiltro = '', onCambiarUsuarioFiltro }) {
    const esAdmin = usuario?.rol === 'admin';
    const [areaFiltro, setAreaFiltro] = useState('');
    const { avisar } = useDialogo();

    const [evaluaciones, setEvaluaciones] = useState([]);
    const [areas, setAreas] = useState([]);
    const [criteriosConfig, setCriteriosConfig] = useState([]);
    const [seleccionadaId, setSeleccionadaId] = useState(evaluacionId);

    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');
    const [intento, setIntento] = useState(0);
    const [exportando, setExportando] = useState('');
    const [tooltip, setTooltip] = useState(null);
    const [seleccion, setSeleccion] = useState([]);


    useEffect(() => {
        let cancelado = false;

        const cargar = async () => {
            try {
                setCargando(true);
                setError('');

                const [datosEvaluaciones, datosConfig] = await Promise.all([
                    apiJson('/evaluaciones', {}, 'No fue posible obtener las evaluaciones.'),
                    apiJson('/evaluaciones/config', {}, 'No fue posible obtener la configuración.')
                ]);

                if (cancelado) return;

                const lista = (Array.isArray(datosEvaluaciones) ? datosEvaluaciones : [])
                    .filter((evaluacion) => evaluacion?._id);

                setEvaluaciones(lista);
                setAreas(normalizarAreas(datosConfig?.areas));
                setCriteriosConfig(
                    Array.isArray(datosConfig?.criterios) ? datosConfig.criterios : []
                );
                setSeleccionadaId((actual) =>
                    lista.some((evaluacion) => evaluacion._id === actual)
                        ? actual
                        : lista[0]?._id ?? null
                );
            } catch (err) {
                if (!cancelado) setError(err.message);
            } finally {
                if (!cancelado) setCargando(false);
            }
        };

        cargar();

        return () => {
            cancelado = true;
        };
    }, [intento]);


    // Admin: evaluaciones del evaluador / área elegidos
    const evaluadores = useMemo(() => listaEvaluadores(evaluaciones), [evaluaciones]);

    const disponibles = useMemo(
        () =>
            evaluaciones.filter((item) => {
                const evaluador = evaluadorDe(item);

                if (usuarioFiltro && evaluador.id !== usuarioFiltro) return false;
                if (areaFiltro && evaluador.area !== areaFiltro) return false;

                return true;
            }),
        [evaluaciones, usuarioFiltro, areaFiltro]
    );

    const evaluacion =
        disponibles.find((item) => item._id === seleccionadaId) || disponibles[0] || null;

    const evaluador = evaluacion ? evaluadorDe(evaluacion) : null;

    // Las líneas (nodos) con que se hizo esta evaluación
    const areasEval = useMemo(() => areasDeEvaluacion(evaluacion, areas), [evaluacion, areas]);

    const { criterios, filas } = useMemo(
        () => construirMatriz(evaluacion, criteriosConfig, areasEval),
        [evaluacion, criteriosConfig, areasEval]
    );
    const totalLineas = areas.reduce((suma, area) => suma + area.nodos.length, 0);
    const lineasEval = areasEval.reduce((suma, area) => suma + area.nodos.length, 0);

    // Criterios visibles según el filtro (vacío = todos)
    const visibles = useMemo(
        () =>
            seleccion.length === 0
                ? criterios
                : criterios.filter((criterio) => seleccion.includes(criterio.numero)),
        [criterios, seleccion]
    );

    const resultados = useMemo(
        () => calcularResultados(visibles.map((criterio) => filas[criterio.numero]), areasEval),
        [visibles, filas, areasEval]
    );

    const enObjetivo = visibles.filter((criterio) => {
        const fila = filas[criterio.numero];
        return fila?.planta && fila?.objetivo && fila.planta >= fila.objetivo;
    }).length;


    const exportar = async (tipo) => {
        try {
            setExportando(tipo);

            if (tipo === 'excel') {
                // ExcelJS es pesado: se carga solo al exportar
                const { exportarEvaluacionExcel } = await import('../utils/exportExcel');

                await exportarEvaluacionExcel({ evaluacion, criteriosConfig, areas });
            } else {
                // Proyecto de Power BI (.zip): se carga solo al exportar
                const { exportarPowerBI } = await import('../utils/exportPowerBI');

                await exportarPowerBI({ evaluaciones: disponibles, criteriosConfig, areas });

                await avisar({
                    titulo: 'Proyecto de Power BI descargado',
                    mensaje: [
                        '1. Extrae el archivo .zip descargado.',
                        '2. Abre "OMA.pbip" con Power BI Desktop.',
                        '',
                        `La gráfica de pastel "Valoraciones por nivel" aparece lista, con los datos de ${disponibles.length} evaluación(es).`
                    ].join('\n'),
                    tipo: 'exito'
                });
            }
        } catch (err) {
            console.error('Error al exportar:', err);
            await avisar({
                titulo: tipo === 'excel' ? 'No pudimos generar el Excel' : 'No pudimos generar el archivo para Power BI',
                mensaje: err.message || 'Inténtalo de nuevo en unos momentos.',
                tipo: 'error'
            });
        } finally {
            setExportando('');
        }
    };


    if (cargando) {
        return (
            <section className="oma-evaluation">
                <div className="page-heading">
                    <h1 className="page-title">Resultados</h1>
                </div>
                <div className="glass loading-card">
                    <div className="loading-spinner" />
                    <p>Cargando resultados...</p>
                </div>
            </section>
        );
    }

    if (error) {
        return (
            <section className="oma-evaluation">
                <div className="page-heading">
                    <h1 className="page-title">Resultados</h1>
                </div>
                <div className="glass error-card">
                    <div className="error-icon">!</div>
                    <div>
                        <strong>No se pudieron cargar los resultados</strong>
                        <p>{error}</p>
                        <button
                            type="button"
                            className="btn-primary"
                            style={{ marginTop: '12px' }}
                            onClick={() => setIntento((valor) => valor + 1)}
                        >
                            Reintentar
                        </button>
                    </div>
                </div>
            </section>
        );
    }

    if (evaluaciones.length === 0) {
        return (
            <section className="oma-evaluation">
                <div className="page-heading">
                    <h1 className="page-title">Resultados</h1>
                </div>
                <div className="glass loading-card">
                    <strong>Aún no hay evaluaciones guardadas.</strong>
                    <p>Cuando guardes una evaluación, aquí verás su matriz y su resumen.</p>
                </div>
            </section>
        );
    }

    return (
        <section className="oma-evaluation">
            <div className="page-heading">
                <h1 className="page-title">Resultados</h1>
                <p className="page-subtitle">
                    {evaluacion ? formatearFecha(evaluacion.fecha, 'full') : 'Sin evaluaciones para estos filtros'}
                    {esAdmin && evaluador ? ` · ${evaluador.nombre}` : ''}
                    {evaluacion?.area ? ` · ${evaluacion.area}` : ''}
                </p>
            </div>

            {esAdmin && (
                <FiltroSupervision
                    evaluadores={evaluadores}
                    usuarioFiltro={usuarioFiltro}
                    onCambiarUsuario={(id) => onCambiarUsuarioFiltro?.(id)}
                    areaFiltro={areaFiltro}
                    onCambiarArea={(area) => {
                        setAreaFiltro(area);
                        onCambiarUsuarioFiltro?.('');
                    }}
                />
            )}

            <div className="glass barra-acciones">
                <label className="selector-evaluacion">
                    Evaluación
                    <select
                        className="form-select"
                        value={evaluacion?._id || ''}
                        disabled={disponibles.length === 0}
                        onChange={(evento) => setSeleccionadaId(evento.target.value)}
                    >
                        {disponibles.map((item) => (
                            <option key={item._id} value={item._id}>
                                {formatearFecha(item.fecha)}
                                {esAdmin ? ` — ${evaluadorDe(item).nombre}` : ''}
                                {item.area ? ` — ${item.area}` : ''}
                            </option>
                        ))}
                    </select>
                </label>

                <div className="barra-acciones-grupo">
                    <button
                        type="button"
                        className="btn-primary"
                        disabled={!evaluacion || Boolean(exportando)}
                        onClick={() => exportar('excel')}
                    >
                        {exportando === 'excel' ? 'Generando…' : 'Exportar Excel'}
                    </button>

                    <button
                        type="button"
                        className="btn-secondary"
                        disabled={Boolean(exportando) || disponibles.length === 0}
                        onClick={() => exportar('powerbi')}
                        title={
                            esAdmin
                                ? 'Descarga un proyecto de Power BI con la gráfica de pastel lista (evaluaciones filtradas por evaluador / área)'
                                : 'Descarga un proyecto de Power BI con la gráfica de pastel lista'
                        }
                    >
                        {exportando === 'powerbi'
                            ? 'Generando…'
                            : `Power BI (${disponibles.length})`}
                    </button>
                </div>
            </div>

            <FiltroCriterios
                criterios={criterios}
                seleccion={seleccion}
                onCambiar={setSeleccion}
            />

            <div className="resumen-grid">
                <Indicador
                    etiqueta="Promedio general"
                    valor={formatearPromedio(resultados.promedioGeneral)}
                    color={colorDeValor(resultados.promedioGeneral)}
                    nota="Promedio de los nodos"
                />
                <Indicador
                    etiqueta="Promedio Planta"
                    valor={formatearPromedio(resultados.promedioPlanta)}
                    color={colorDeValor(resultados.promedioPlanta)}
                    nota="Nivel actual"
                />
                <Indicador
                    etiqueta="Promedio Objetivo"
                    valor={formatearPromedio(resultados.promedioObjetivo)}
                    color={colorDeValor(resultados.promedioObjetivo)}
                    nota="Nivel meta"
                />
                <Indicador
                    etiqueta="Criterios en objetivo"
                    valor={`${enObjetivo} / ${visibles.length}`}
                    nota="Planta igual o mayor al objetivo"
                />
            </div>

            {lineasEval > 0 && lineasEval < totalLineas && (
                <div className="aviso aviso-info" role="status">
                    Evaluación de {lineasEval} de {totalLineas} líneas:{' '}
                    {areasEval.map((area) => `${area.nombre} (${area.nodos.join(', ')})`).join(' · ')}
                </div>
            )}

            <MatrizOMA
                areas={areasEval}
                criterios={visibles}
                filas={filas}
                respuestas={evaluacion?.respuestas?.length
                    ? { opciones: [], valores: Object.fromEntries(evaluacion.respuestas.map((item) => [item.numero, item])) }
                    : null}
            />

            <div className="matriz-leyenda">
                {NIVELES.map((nivel) => (
                    <span key={nivel.valor}>
                        <i style={{ background: COLORES_NIVEL[nivel.valor] }} />
                        {nivel.valor} = {nivel.nombre}
                    </span>
                ))}
                <span>Promedio: menor a 2 naranja · de 2 a 2.99 amarillo · 3 verde</span>
            </div>

            <div className="graficas-grid">
                <GraficaAreas
                    areas={areasEval}
                    promedioArea={resultados.promedioArea}
                    onTooltip={setTooltip}
                    filtrado={seleccion.length > 0}
                />
                <GraficaBrecha criterios={visibles} filas={filas} />
            </div>


            <Tooltip datos={tooltip} />
        </section>
    );
}

export default Resultados;
