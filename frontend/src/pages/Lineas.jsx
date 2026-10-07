import { useEffect, useMemo, useState } from 'react';

import { useDialogo } from '../components/dialogos';
import { apiJson } from '../utils/api';
import { formatearFecha } from '../utils/oma';

/*
 * =========================================================
 * LÍNEAS DE TRABAJO (NODOS) — solo administrador
 *
 * Renombrar, agregar, ordenar, mover de área o quitar
 * líneas. Los cambios se aplican al presionar "Guardar".
 * Las evaluaciones guardadas conservan sus líneas tal
 * como se capturaron.
 * =========================================================
 */

const NOMBRE_VALIDO = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9][A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 .\-/&()#]*$/;
const limpiar = (texto) => String(texto ?? '').trim().replace(/\s+/g, ' ');
const claveAlmacen = (nodo) => String(nodo).replace(/[.$]/g, '_').toLowerCase();

let contador = 0;
const nuevoId = () => `l${++contador}`;

// { AREA: [{ id, nombre, original, areaOriginal }] }
const aEdicion = (areas) =>
    Object.fromEntries(
        areas.map((area) => [
            area.nombre,
            area.nodos.map((nodo) => ({ id: nuevoId(), nombre: nodo, original: nodo, areaOriginal: area.nombre }))
        ])
    );


// Errores por id de línea (mismas reglas que el servidor)
function validar(edicion, maxLongitud) {
    const errores = {};
    const vistos = new Map();

    Object.entries(edicion).forEach(([area, lista]) => {
        const claves = new Map();

        lista.forEach((item) => {
            const nombre = limpiar(item.nombre);

            if (!nombre) {
                errores[item.id] = 'Escribe un nombre.';
                return;
            }

            if (nombre.length > maxLongitud) {
                errores[item.id] = `Máximo ${maxLongitud} caracteres.`;
                return;
            }

            if (!NOMBRE_VALIDO.test(nombre)) {
                errores[item.id] = 'Usa letras, números, espacio y . - / & ( ) #';
                return;
            }

            const minusculas = nombre.toLowerCase();

            if (vistos.has(minusculas)) {
                errores[item.id] = `Repetida (también en ${vistos.get(minusculas).area}).`;
                errores[vistos.get(minusculas).id] = errores[vistos.get(minusculas).id] || `Repetida (también en ${area}).`;
                return;
            }

            const clave = claveAlmacen(nombre);

            if (claves.has(clave)) {
                errores[item.id] = `Se confunde con "${claves.get(clave)}".`;
                return;
            }

            vistos.set(minusculas, { area, id: item.id });
            claves.set(clave, nombre);
        });
    });

    return errores;
}


function TarjetaArea({ area, lista, areas, uso, errores, onCambiar, onMover, onQuitar, onOrdenar, onAgregar, deshabilitado }) {
    const [nueva, setNueva] = useState('');

    const agregar = () => {
        const nombre = limpiar(nueva);
        if (!nombre) return;
        onAgregar(area, nombre);
        setNueva('');
    };

    return (
        <article className="glass tarjeta-area-lineas">
            <header className="tarjeta-area-encabezado">
                <h2>{area}</h2>
                <span className="etiqueta">{lista.length} línea(s)</span>
            </header>

            {lista.length === 0 && (
                <p className="campo-ayuda">Sin líneas. Esta área no aparecerá en la evaluación.</p>
            )}

            <ul className="lista-lineas">
                {lista.map((item, indice) => {
                    const usos = uso[`${item.areaOriginal}|${item.original}`] || 0;
                    const renombrada = item.original && limpiar(item.nombre) !== item.original;
                    const movida = item.areaOriginal && item.areaOriginal !== area;
                    const esNueva = !item.original;

                    return (
                        <li key={item.id} className={`linea-fila ${errores[item.id] ? 'con-error' : ''}`}>
                            <div className="linea-orden">
                                <button type="button" aria-label={`Subir ${item.nombre}`} disabled={deshabilitado || indice === 0} onClick={() => onOrdenar(area, indice, -1)}>↑</button>
                                <button type="button" aria-label={`Bajar ${item.nombre}`} disabled={deshabilitado || indice === lista.length - 1} onClick={() => onOrdenar(area, indice, 1)}>↓</button>
                            </div>

                            <div className="linea-campo">
                                <input
                                    className="campo-input"
                                    value={item.nombre}
                                    maxLength={40}
                                    aria-label={`Nombre de la línea ${indice + 1} de ${area}`}
                                    aria-invalid={Boolean(errores[item.id])}
                                    disabled={deshabilitado}
                                    onChange={(evento) => onCambiar(area, item.id, evento.target.value)}
                                />
                                <div className="linea-notas">
                                    {errores[item.id] && <span className="campo-error">{errores[item.id]}</span>}
                                    {!errores[item.id] && esNueva && <span className="etiqueta azul">Nueva</span>}
                                    {!errores[item.id] && renombrada && <span className="etiqueta">Antes: {item.original}</span>}
                                    {!errores[item.id] && movida && <span className="etiqueta">Desde {item.areaOriginal}</span>}
                                    {usos > 0 && <span className="linea-uso">Usada en {usos} evaluación(es)</span>}
                                </div>
                            </div>

                            <select
                                className="form-select linea-mover"
                                value={area}
                                aria-label={`Área de ${item.nombre}`}
                                disabled={deshabilitado}
                                onChange={(evento) => onMover(area, item.id, evento.target.value)}
                            >
                                {areas.map((destino) => (
                                    <option key={destino} value={destino}>{destino}</option>
                                ))}
                            </select>

                            <button
                                type="button"
                                className="btn-plain btn-icon peligro linea-quitar"
                                aria-label={`Quitar ${item.nombre}`}
                                title="Quitar línea"
                                disabled={deshabilitado}
                                onClick={() => onQuitar(area, item, usos)}
                            >
                                ×
                            </button>
                        </li>
                    );
                })}
            </ul>

            <div className="linea-agregar">
                <input
                    className="campo-input"
                    placeholder={`Nueva línea en ${area}`}
                    aria-label={`Nueva línea en ${area}`}
                    maxLength={40}
                    value={nueva}
                    disabled={deshabilitado}
                    onChange={(evento) => setNueva(evento.target.value)}
                    onKeyDown={(evento) => {
                        if (evento.key === 'Enter') {
                            evento.preventDefault();
                            agregar();
                        }
                    }}
                />
                <button type="button" className="btn-secondary" disabled={deshabilitado || !limpiar(nueva)} onClick={agregar}>
                    + Agregar
                </button>
            </div>
        </article>
    );
}


function Lineas() {
    const { confirmar } = useDialogo();
    const [original, setOriginal] = useState([]);
    const [edicion, setEdicion] = useState({});
    const [uso, setUso] = useState({});
    const [info, setInfo] = useState(null);
    const [limites, setLimites] = useState({ maxLineas: 80, maxLongitud: 24 });

    const [cargando, setCargando] = useState(true);
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');
    const [mensaje, setMensaje] = useState('');
    const [intento, setIntento] = useState(0);

    useEffect(() => {
        let cancelado = false;

        apiJson('/admin/lineas', {}, 'No fue posible obtener las líneas.')
            .then((datos) => {
                if (cancelado) return;

                setOriginal(datos.areas || []);
                setEdicion(aEdicion(datos.areas || []));
                setUso(datos.uso || {});
                setInfo({ actualizado: datos.actualizado, por: datos.actualizadoPor });
                if (datos.limites) setLimites(datos.limites);
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


    const areas = original.map((area) => area.nombre);
    const errores = useMemo(() => validar(edicion, limites.maxLongitud), [edicion, limites.maxLongitud]);
    const total = Object.values(edicion).reduce((suma, lista) => suma + lista.length, 0);

    const propuesta = areas.map((area) => ({
        nombre: area,
        nodos: (edicion[area] || []).map((item) => limpiar(item.nombre))
    }));

    const hayCambios = JSON.stringify(propuesta) !== JSON.stringify(original);
    const hayErrores = Object.keys(errores).length > 0;

    // Avisar antes de cerrar la pestaña con cambios sin guardar
    useEffect(() => {
        if (!hayCambios) return undefined;

        const avisar = (evento) => {
            evento.preventDefault();
            evento.returnValue = '';
        };

        window.addEventListener('beforeunload', avisar);

        return () => window.removeEventListener('beforeunload', avisar);
    }, [hayCambios]);


    const actualizar = (cambio) => {
        setEdicion((actual) => cambio(structuredClone(actual)));
        setMensaje('');
    };

    const onCambiar = (area, id, nombre) =>
        actualizar((copia) => {
            const item = copia[area].find((linea) => linea.id === id);
            if (item) item.nombre = nombre;
            return copia;
        });

    const onMover = (area, id, destino) =>
        actualizar((copia) => {
            const indice = copia[area].findIndex((linea) => linea.id === id);
            if (indice === -1 || destino === area) return copia;
            const [item] = copia[area].splice(indice, 1);
            copia[destino].push(item);
            return copia;
        });

    const onOrdenar = (area, indice, direccion) =>
        actualizar((copia) => {
            const lista = copia[area];
            const destino = indice + direccion;
            if (destino < 0 || destino >= lista.length) return copia;
            [lista[indice], lista[destino]] = [lista[destino], lista[indice]];
            return copia;
        });

    const onQuitar = async (area, item, usos) => {
        const aceptar = await confirmar({
            titulo: `Quitar la línea ${item.nombre}`,
            mensaje: usos > 0
                ? `Se usó en ${usos} evaluación(es); esas evaluaciones la conservan. Ya no aparecerá en evaluaciones nuevas.\n\nEl cambio se aplica al presionar "Guardar cambios".`
                : 'El cambio se aplica al presionar "Guardar cambios".',
            textoConfirmar: 'Quitar',
            peligro: true
        });

        if (!aceptar) return;

        actualizar((copia) => {
            copia[area] = copia[area].filter((linea) => linea.id !== item.id);
            return copia;
        });
    };

    const onAgregar = (area, nombre) =>
        actualizar((copia) => {
            copia[area].push({ id: nuevoId(), nombre, original: null, areaOriginal: null });
            return copia;
        });

    const descartar = () => {
        setEdicion(aEdicion(original));
        setMensaje('');
    };

    const guardar = async () => {
        if (hayErrores) {
            setError('Corrige las líneas marcadas en rojo antes de guardar.');
            return;
        }

        if (total === 0) {
            setError('Debe existir al menos una línea.');
            return;
        }

        try {
            setGuardando(true);
            setError('');

            const datos = await apiJson(
                '/admin/lineas',
                { method: 'PUT', body: JSON.stringify({ areas: propuesta }) },
                'No fue posible guardar las líneas.'
            );

            setMensaje(datos?.mensaje || 'Líneas guardadas.');
            setIntento((valor) => valor + 1);
        } catch (err) {
            setError(err.message);
        } finally {
            setGuardando(false);
        }
    };


    if (cargando) {
        return (
            <section className="oma-evaluation">
                <div className="page-heading"><h1 className="page-title">Líneas</h1></div>
                <div className="glass loading-card"><div className="loading-spinner" /><p>Cargando líneas…</p></div>
            </section>
        );
    }

    if (error && original.length === 0) {
        return (
            <section className="oma-evaluation">
                <div className="page-heading"><h1 className="page-title">Líneas</h1></div>
                <div className="glass error-card">
                    <div className="error-icon">!</div>
                    <div>
                        <strong>No se pudieron cargar las líneas</strong>
                        <p>{error}</p>
                        <button
                            type="button"
                            className="btn-primary"
                            style={{ marginTop: 12 }}
                            onClick={() => {
                                setCargando(true);
                                setIntento((valor) => valor + 1);
                            }}
                        >
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
                <h1 className="page-title">Líneas de trabajo</h1>
                <p className="page-subtitle">
                    Renombra, agrega, ordena o mueve las líneas (nodos) de cada área.
                    Las evaluaciones ya guardadas conservan sus líneas tal como se capturaron.
                </p>
            </div>

            {mensaje && <div className="aviso aviso-exito" role="status">✓ {mensaje}</div>}
            {error && <div className="aviso aviso-error" role="alert">{error}</div>}

            <div className="glass barra-acciones">
                <div>
                    <strong>{total} línea(s)</strong>
                    <span className="campo-ayuda" style={{ marginLeft: 8 }}>
                        en {areas.length} áreas · máximo {limites.maxLineas}
                    </span>
                    <div className="campo-ayuda">
                        {hayCambios
                            ? hayErrores
                                ? `Hay ${Object.keys(errores).length} línea(s) con errores.`
                                : 'Tienes cambios sin guardar.'
                            : info?.actualizado
                                ? `Última actualización: ${formatearFecha(info.actualizado)}${info.por ? ` por ${info.por}` : ''}.`
                                : 'Líneas originales del Excel.'}
                    </div>
                </div>

                <div className="barra-acciones-grupo">
                    <button type="button" className="btn-secondary" disabled={!hayCambios || guardando} onClick={descartar}>
                        Descartar
                    </button>
                    <button type="button" className="btn-primary" disabled={!hayCambios || hayErrores || guardando} onClick={guardar}>
                        {guardando ? 'Guardando…' : 'Guardar cambios'}
                    </button>
                </div>
            </div>

            <div className="grid-areas-lineas">
                {areas.map((area) => (
                    <TarjetaArea
                        key={area}
                        area={area}
                        lista={edicion[area] || []}
                        areas={areas}
                        uso={uso}
                        errores={errores}
                        onCambiar={onCambiar}
                        onMover={onMover}
                        onQuitar={onQuitar}
                        onOrdenar={onOrdenar}
                        onAgregar={onAgregar}
                        deshabilitado={guardando}
                    />
                ))}
            </div>
        </section>
    );
}

export default Lineas;
