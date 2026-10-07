import { useEffect, useMemo, useState } from 'react';

import { apiJson } from '../utils/api';
import { formatearFecha } from '../utils/oma';

/*
 * =========================================================
 * RESPUESTAS PREDETERMINADAS — solo administrador
 *
 * Por cada criterio, la lista de respuestas que el evaluado
 * suele dar. El evaluador las marca en el formulario de
 * evaluación. Los cambios se aplican al presionar "Guardar".
 * =========================================================
 */

const MAX_TEXTO = 140;
const MAX_OPCIONES = 30;
const limpiar = (texto) => String(texto ?? '').replace(/\s+/g, ' ').trim();

const copiar = (criterios) =>
    Object.fromEntries(criterios.map((criterio) => [criterio.numero, [...criterio.opciones]]));


function TarjetaCriterio({ criterio, opciones, deshabilitado, onCambiar }) {
    const [nueva, setNueva] = useState('');
    const [error, setError] = useState('');

    const agregar = () => {
        const texto = limpiar(nueva);

        if (!texto) return;

        if (texto.length > MAX_TEXTO) {
            setError(`Máximo ${MAX_TEXTO} caracteres.`);
            return;
        }

        if (opciones.some((opcion) => opcion.toLocaleLowerCase('es') === texto.toLocaleLowerCase('es'))) {
            setError('Esa respuesta ya está en la lista.');
            return;
        }

        if (opciones.length >= MAX_OPCIONES) {
            setError(`Máximo ${MAX_OPCIONES} respuestas por criterio.`);
            return;
        }

        onCambiar([...opciones, texto]);
        setNueva('');
        setError('');
    };

    return (
        <article className="glass tarjeta-respuestas">
            <header className="tarjeta-respuestas-encabezado">
                <h2>
                    <span className="tarjeta-respuestas-numero">{criterio.numero}</span> {criterio.nombre}
                </h2>
                <span className="etiqueta">{opciones.length}</span>
            </header>

            {opciones.length === 0 ? (
                <p className="campo-ayuda">Sin respuestas. En la evaluación solo se podrá escribir un comentario.</p>
            ) : (
                <ul className="respuestas-chips">
                    {opciones.map((opcion) => (
                        <li key={opcion} className="respuesta-chip">
                            <span>{opcion}</span>
                            <button
                                type="button"
                                className="respuesta-chip-quitar"
                                aria-label={`Quitar "${opcion}"`}
                                title="Quitar"
                                disabled={deshabilitado}
                                onClick={() => onCambiar(opciones.filter((item) => item !== opcion))}
                            >
                                ×
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            <div className="respuestas-agregar">
                <input
                    type="text"
                    className="campo-input"
                    placeholder="Nueva respuesta, p. ej. «Desconoce el estándar»"
                    value={nueva}
                    maxLength={MAX_TEXTO + 10}
                    disabled={deshabilitado}
                    aria-label={`Nueva respuesta para ${criterio.numero}`}
                    onChange={(evento) => { setNueva(evento.target.value); setError(''); }}
                    onKeyDown={(evento) => {
                        if (evento.key === 'Enter') {
                            evento.preventDefault();
                            agregar();
                        }
                    }}
                />
                <button type="button" className="btn-secondary" disabled={deshabilitado || !limpiar(nueva)} onClick={agregar}>
                    Agregar
                </button>
            </div>
            {error && <span className="campo-error">{error}</span>}
        </article>
    );
}


function Respuestas() {
    const [criterios, setCriterios] = useState([]);
    const [edicion, setEdicion] = useState({});
    const [info, setInfo] = useState(null);

    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');
    const [errorCarga, setErrorCarga] = useState('');
    const [mensaje, setMensaje] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [intento, setIntento] = useState(0);

    useEffect(() => {
        let cancelado = false;

        apiJson('/evaluaciones/respuestas', {}, 'No pudimos cargar las respuestas predeterminadas.')
            .then((datos) => {
                if (cancelado) return;
                const lista = datos?.criterios || [];
                setCriterios(lista);
                setEdicion(copiar(lista));
                setInfo({ actualizado: datos?.actualizado, por: datos?.actualizadoPor });
                setErrorCarga('');
            })
            .catch((err) => {
                if (!cancelado) setErrorCarga(err.message);
            })
            .finally(() => {
                if (!cancelado) setCargando(false);
            });

        return () => {
            cancelado = true;
        };
    }, [intento]);

    const hayCambios = useMemo(
        () => criterios.some((criterio) => JSON.stringify(criterio.opciones) !== JSON.stringify(edicion[criterio.numero] || [])),
        [criterios, edicion]
    );

    const total = Object.values(edicion).reduce((suma, lista) => suma + lista.length, 0);

    const guardar = async () => {
        try {
            setGuardando(true);
            setError('');
            setMensaje('');

            const datos = await apiJson(
                '/admin/respuestas',
                {
                    method: 'PUT',
                    body: JSON.stringify({
                        criterios: criterios.map((criterio) => ({ numero: criterio.numero, opciones: edicion[criterio.numero] || [] }))
                    })
                },
                'No pudimos guardar las respuestas.'
            );

            const lista = datos?.criterios || [];
            setCriterios(lista);
            setEdicion(copiar(lista));
            setInfo({ actualizado: datos?.actualizado, por: datos?.actualizadoPor });
            setMensaje(datos?.mensaje || 'Respuestas guardadas.');
        } catch (err) {
            setError(err.message);
        } finally {
            setGuardando(false);
        }
    };

    if (cargando) {
        return (
            <section className="oma-evaluation">
                <div className="page-heading"><h1 className="page-title">Respuestas predeterminadas</h1></div>
                <div className="glass loading-card"><div className="loading-spinner" /><p>Cargando respuestas…</p></div>
            </section>
        );
    }

    if (errorCarga) {
        return (
            <section className="oma-evaluation">
                <div className="page-heading"><h1 className="page-title">Respuestas predeterminadas</h1></div>
                <div className="glass error-card">
                    <div className="error-icon">!</div>
                    <div>
                        <strong>No pudimos cargar las respuestas</strong>
                        <p>{errorCarga}</p>
                        <button type="button" className="btn-primary" style={{ marginTop: 12 }} onClick={() => { setCargando(true); setIntento((v) => v + 1); }}>
                            Reintentar
                        </button>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="oma-evaluation">
            <div className="page-heading">
                <h1 className="page-title">Respuestas predeterminadas</h1>
                <p className="page-subtitle">
                    Define por criterio lo que el evaluado suele responder. El evaluador las marcará en el apartado
                    «Respuestas del evaluado» al hacer la evaluación.
                </p>
            </div>

            {mensaje && <div className="aviso aviso-exito" role="status">✓ {mensaje}</div>}
            {error && <div className="aviso aviso-error" role="alert">{error}</div>}

            <div className="glass barra-acciones">
                <div>
                    <strong>{total} respuesta(s)</strong>
                    <span className="campo-ayuda" style={{ marginLeft: 8 }}>
                        en {Object.values(edicion).filter((lista) => lista.length > 0).length} de {criterios.length} criterios
                    </span>
                    {info?.actualizado && (
                        <div className="campo-ayuda">
                            Última actualización: {formatearFecha(info.actualizado)}{info.por ? ` · ${info.por}` : ''}
                        </div>
                    )}
                </div>

                <div className="barra-acciones-grupo">
                    <button type="button" className="btn-secondary" disabled={!hayCambios || guardando} onClick={() => { setEdicion(copiar(criterios)); setError(''); }}>
                        Descartar
                    </button>
                    <button type="button" className="btn-primary" disabled={!hayCambios || guardando} onClick={guardar}>
                        {guardando ? 'Guardando…' : 'Guardar cambios'}
                    </button>
                </div>
            </div>

            <div className="grid-respuestas">
                {criterios.map((criterio) => (
                    <TarjetaCriterio
                        key={criterio.numero}
                        criterio={criterio}
                        opciones={edicion[criterio.numero] || []}
                        deshabilitado={guardando}
                        onCambiar={(opciones) => {
                            setMensaje('');
                            setEdicion((actual) => ({ ...actual, [criterio.numero]: opciones }));
                        }}
                    />
                ))}
            </div>
        </section>
    );
}

export default Respuestas;
