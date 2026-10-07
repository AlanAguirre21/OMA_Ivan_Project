import { useEffect, useMemo, useState } from 'react';

import FiltroSupervision from '../components/FiltroSupervision';
import { useDialogo } from '../components/dialogos';
import { apiJson } from '../utils/api';
import {
    colorDeValor,
    evaluadorDe,
    formatearFecha,
    formatearPromedio,
    listaEvaluadores
} from '../utils/oma';

/*
 * =========================================================
 * HISTORIAL
 *
 * Lista de evaluaciones guardadas. Cada una se abre
 * en Resultados (matriz + resumen). El administrador puede
 * eliminar evaluaciones, una por una o varias a la vez.
 * =========================================================
 */

// Promedio general = promedio de los promedios de cada criterio
function promedioGeneral(evaluacion) {
    const promedios = (Array.isArray(evaluacion?.criterios) ? evaluacion.criterios : [])
        .map((criterio) => Number(criterio?.resultado?.promedio))
        .filter((valor) => !Number.isNaN(valor) && valor > 0);

    if (promedios.length === 0) return null;

    return promedios.reduce((total, valor) => total + valor, 0) / promedios.length;
}


function Historial({ usuario, usuarioFiltro = '', onCambiarUsuarioFiltro, onVerEvaluacion }) {
    const esAdmin = usuario?.rol === 'admin';
    const [areaFiltro, setAreaFiltro] = useState('');
    const { confirmar } = useDialogo();

    // Admin: evaluaciones seleccionadas para eliminar
    const [seleccion, setSeleccion] = useState(() => new Set());
    const [eliminando, setEliminando] = useState(false);
    const [mensaje, setMensaje] = useState(null);

    const [evaluaciones, setEvaluaciones] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');
    const [intento, setIntento] = useState(0);

    useEffect(() => {
        let cancelado = false;

        const cargar = async () => {
            try {
                setCargando(true);
                setError('');

                const datos = await apiJson(
                    '/evaluaciones',
                    {},
                    'No fue posible obtener las evaluaciones.'
                );

                if (!cancelado) {
                    setEvaluaciones(
                        (Array.isArray(datos) ? datos : []).filter((item) => item?._id)
                    );
                }
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


    // Admin: filtros por evaluador y área
    const evaluadores = useMemo(() => listaEvaluadores(evaluaciones), [evaluaciones]);

    const visibles = useMemo(
        () =>
            evaluaciones.filter((evaluacion) => {
                const evaluador = evaluadorDe(evaluacion);

                if (usuarioFiltro && evaluador.id !== usuarioFiltro) return false;
                if (areaFiltro && evaluador.area !== areaFiltro) return false;

                return true;
            }),
        [evaluaciones, usuarioFiltro, areaFiltro]
    );

    // Solo cuentan las seleccionadas que siguen visibles con los filtros
    const seleccionVisible = visibles.filter((evaluacion) => seleccion.has(evaluacion._id));
    const todasSeleccionadas = visibles.length > 0 && seleccionVisible.length === visibles.length;

    const alternarSeleccion = (id) =>
        setSeleccion((actual) => {
            const nueva = new Set(actual);
            if (nueva.has(id)) nueva.delete(id); else nueva.add(id);
            return nueva;
        });

    const alternarTodas = () =>
        setSeleccion((actual) => {
            const nueva = new Set(actual);
            visibles.forEach((evaluacion) => {
                if (todasSeleccionadas) nueva.delete(evaluacion._id); else nueva.add(evaluacion._id);
            });
            return nueva;
        });

    const eliminar = async (lista) => {
        if (lista.length === 0) return;

        const unica = lista.length === 1 ? lista[0] : null;
        const evaluadoresAfectados = [...new Set(lista.map((evaluacion) => evaluadorDe(evaluacion).nombre))];

        const aceptar = await confirmar({
            titulo: unica ? 'Eliminar evaluación' : `Eliminar ${lista.length} evaluaciones`,
            mensaje: [
                unica
                    ? `Evaluación del ${formatearFecha(unica.fecha)} de ${evaluadorDe(unica).nombre}.`
                    : `De: ${evaluadoresAfectados.slice(0, 5).join(', ')}${evaluadoresAfectados.length > 5 ? ` y ${evaluadoresAfectados.length - 5} más` : ''}.`,
                '',
                'Dejarán de aparecer en Historial, Resultados y exportaciones. Esta acción no se puede deshacer; queda registrada en la actividad.'
            ].join('\n'),
            textoConfirmar: unica ? 'Eliminar' : `Eliminar ${lista.length}`,
            peligro: true
        });

        if (!aceptar) return;

        try {
            setEliminando(true);
            setMensaje(null);

            const datos = await apiJson(
                '/admin/evaluaciones/eliminar',
                { method: 'POST', body: JSON.stringify({ ids: lista.map((evaluacion) => evaluacion._id) }) },
                'No pudimos eliminar las evaluaciones.'
            );

            // Se quitan de la lista sin volver a cargar todo
            const eliminadas = new Set(datos?.eliminadas || []);
            setEvaluaciones((actual) => actual.filter((evaluacion) => !eliminadas.has(evaluacion._id)));
            setSeleccion((actual) => new Set([...actual].filter((id) => !eliminadas.has(id))));
            setMensaje({ tipo: 'exito', texto: datos?.mensaje || 'Evaluaciones eliminadas.' });
        } catch (err) {
            setMensaje({ tipo: 'error', texto: err.message });
        } finally {
            setEliminando(false);
        }
    };


    return (
        <section className="oma-evaluation">
            <div className="page-heading">
                <h1 className="page-title">Historial</h1>
                <p className="page-subtitle">
                    {cargando || error
                        ? 'Evaluaciones guardadas.'
                        : esAdmin
                            ? `${visibles.length} de ${evaluaciones.length} evaluación(es) de todos los usuarios.`
                            : `${evaluaciones.length} evaluación(es) guardada(s).`}
                </p>
            </div>

            {esAdmin && !cargando && !error && evaluaciones.length > 0 && (
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

            {mensaje && (
                <div className={`aviso ${mensaje.tipo === 'error' ? 'aviso-error' : 'aviso-exito'}`} role={mensaje.tipo === 'error' ? 'alert' : 'status'}>
                    {mensaje.tipo === 'exito' ? '✓ ' : ''}{mensaje.texto}
                </div>
            )}

            {esAdmin && !cargando && !error && visibles.length > 0 && (
                <div className="glass barra-seleccion">
                    <label className="casilla">
                        <input
                            type="checkbox"
                            checked={todasSeleccionadas}
                            ref={(elemento) => {
                                if (elemento) elemento.indeterminate = seleccionVisible.length > 0 && !todasSeleccionadas;
                            }}
                            disabled={eliminando}
                            onChange={alternarTodas}
                        />
                        <span>
                            {seleccionVisible.length > 0
                                ? `${seleccionVisible.length} de ${visibles.length} seleccionada(s)`
                                : `Seleccionar las ${visibles.length} visibles`}
                        </span>
                    </label>

                    <div className="barra-acciones-grupo">
                        {seleccionVisible.length > 0 && (
                            <button type="button" className="btn-plain btn-sm" disabled={eliminando} onClick={() => setSeleccion(new Set())}>
                                Quitar selección
                            </button>
                        )}
                        <button
                            type="button"
                            className="btn-primary btn-peligro btn-sm"
                            disabled={eliminando || seleccionVisible.length === 0}
                            onClick={() => eliminar(seleccionVisible)}
                        >
                            {eliminando ? 'Eliminando…' : `Eliminar seleccionadas${seleccionVisible.length ? ` (${seleccionVisible.length})` : ''}`}
                        </button>
                    </div>
                </div>
            )}

            {cargando && (
                <div className="glass loading-card">
                    <div className="loading-spinner" />
                    <p>Cargando evaluaciones...</p>
                </div>
            )}

            {!cargando && error && (
                <div className="glass error-card">
                    <div className="error-icon">!</div>
                    <div>
                        <strong>No se pudo cargar el historial</strong>
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
            )}

            {!cargando && !error && evaluaciones.length === 0 && (
                <div className="glass loading-card">
                    <strong>No hay evaluaciones registradas.</strong>
                    <p>Cuando guardes una evaluación aparecerá aquí.</p>
                </div>
            )}

            {!cargando && !error && evaluaciones.length > 0 && visibles.length === 0 && (
                <div className="glass loading-card">
                    <p>No hay evaluaciones con esos filtros.</p>
                </div>
            )}

            {!cargando && !error && visibles.length > 0 && (
                <div className="lista-evaluaciones">
                    {visibles.map((evaluacion) => {
                        const evaluador = evaluadorDe(evaluacion);
                        const promedio = promedioGeneral(evaluacion);
                        const totalCriterios = Array.isArray(evaluacion.criterios)
                            ? evaluacion.criterios.length
                            : 0;

                        return (
                            <article
                                key={evaluacion._id}
                                className={`glass evaluacion-item ${esAdmin ? 'con-seleccion' : ''} ${seleccion.has(evaluacion._id) ? 'seleccionada' : ''}`}
                            >
                                {esAdmin && (
                                    <label className="casilla" title="Seleccionar">
                                        <input
                                            type="checkbox"
                                            checked={seleccion.has(evaluacion._id)}
                                            disabled={eliminando}
                                            onChange={() => alternarSeleccion(evaluacion._id)}
                                            aria-label={`Seleccionar evaluación del ${formatearFecha(evaluacion.fecha)} de ${evaluador.nombre}`}
                                        />
                                    </label>
                                )}

                                <span
                                    className={`chip decimal fuerte ${promedio === null ? 'vacio' : ''}`}
                                    style={promedio === null ? undefined : { background: colorDeValor(promedio) }}
                                    title="Promedio general"
                                >
                                    {formatearPromedio(promedio)}
                                </span>

                                <div>
                                    <div className="evaluacion-item-fecha">
                                        {formatearFecha(evaluacion.fecha)}
                                    </div>
                                    <div className="evaluacion-item-meta">
                                        {esAdmin ? `${evaluador.nombre} · ` : ''}
                                        {evaluacion.area ? `Área: ${evaluacion.area} · ` : ''}
                                        {totalCriterios} criterios
                                        {Array.isArray(evaluacion.nodosEvaluados) && evaluacion.nodosEvaluados.length > 0
                                            ? ` · ${evaluacion.nodosEvaluados.length} línea(s): ${evaluacion.nodosEvaluados.map((item) => item.nodo).join(', ')}`
                                            : ' · todas las líneas'}
                                    </div>
                                </div>

                                <div className="evaluacion-item-acciones">
                                    <button
                                        type="button"
                                        className="btn-primary"
                                        onClick={() => onVerEvaluacion(evaluacion._id)}
                                    >
                                        Ver resultados
                                    </button>

                                    {esAdmin && (
                                        <button
                                            type="button"
                                            className="btn-plain btn-icon peligro"
                                            title="Eliminar evaluación"
                                            aria-label={`Eliminar evaluación del ${formatearFecha(evaluacion.fecha)} de ${evaluador.nombre}`}
                                            disabled={eliminando}
                                            onClick={() => eliminar([evaluacion])}
                                        >
                                            🗑
                                        </button>
                                    )}
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
        </section>
    );
}

export default Historial;
