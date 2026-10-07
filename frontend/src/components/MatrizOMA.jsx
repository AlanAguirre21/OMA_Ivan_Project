import { Fragment, useEffect, useState } from 'react';

import {
    NIVELES,
    calcularResultados,
    colorDeValor,
    formatearPromedio
} from '../utils/oma';
import { CONSULTA_MOVIL, useMediaQuery } from '../utils/useMediaQuery';

/*
 * =========================================================
 * MATRIZ OMA EN PISO
 *
 * Réplica de la hoja del Excel. Sirve para capturar
 * (editable) y para consultar (solo lectura).
 *
 * - Escritorio: tabla. Todas las celdas (Planta, Objetivo,
 *   nodos) son el mismo "chip". Teclado: 1 / 2 / 3,
 *   Supr para borrar y flechas para moverse.
 * - Móvil: una tarjeta por criterio; cada campo es el
 *   mismo control segmentado 1 · 2 · 3 (un toque).
 * - Opcional: columna "Respuesta del evaluado" con una
 *   lista desplegable de respuestas predeterminadas.
 * =========================================================
 */

const OTRA = '__otra__';
const VACIA = { opciones: [], comentario: '', otra: false };

const idCampo = (numero, campo, area = '', nodo = '') =>
    `${numero}|${campo}|${area}|${nodo}`;

const tieneValor = (valor) => valor !== null && valor !== undefined;


// ---------------------------------------------------------
// Chip de solo lectura (promedios y valores en consulta)
// ---------------------------------------------------------

function Chip({ valor, decimal = false, fuerte = false, bloqueado = false }) {
    return (
        <span
            title={bloqueado ? 'Definido por el administrador' : undefined}
            className={`chip ${decimal ? 'decimal' : ''} ${fuerte ? 'fuerte' : ''} ${bloqueado ? 'bloqueado' : ''} ${tieneValor(valor) ? '' : 'vacio'}`}
            style={tieneValor(valor) ? { background: colorDeValor(valor) } : undefined}
        >
            {decimal ? formatearPromedio(valor) : tieneValor(valor) ? valor : '—'}
        </span>
    );
}


// ---------------------------------------------------------
// Respuesta del evaluado: lista desplegable + "Otra"
// ---------------------------------------------------------

function ControlRespuesta({ numero, opciones = [], valor, editable, onCambiar }) {
    const actual = valor || VACIA;
    const elegida = actual.opciones?.[0] || '';

    if (!editable) {
        const texto = [...(actual.opciones || []), actual.comentario].filter(Boolean).join(' · ');

        return texto
            ? <span className="respuesta-lectura">{texto}</span>
            : <span className="respuesta-lectura vacia">—</span>;
    }

    const muestraOtra = actual.otra || (!elegida && Boolean(actual.comentario));
    const seleccion = elegida && opciones.includes(elegida) ? elegida : muestraOtra ? OTRA : '';

    return (
        <div className="respuesta-control">
            <select
                className="form-select respuesta-select"
                aria-label={`Respuesta del evaluado en ${numero}`}
                value={seleccion}
                onChange={(evento) => {
                    const nuevo = evento.target.value;

                    if (nuevo === OTRA) onCambiar({ opciones: [], comentario: actual.comentario || '', otra: true });
                    else if (!nuevo) onCambiar(VACIA);
                    else onCambiar({ opciones: [nuevo], comentario: '', otra: false });
                }}
            >
                <option value="">Sin respuesta</option>
                {opciones.map((opcion) => (
                    <option key={opcion} value={opcion}>{opcion}</option>
                ))}
                <option value={OTRA}>Otra respuesta…</option>
            </select>

            {seleccion === OTRA && (
                <input
                    type="text"
                    className="campo-input respuesta-otra"
                    placeholder="Escribe lo que respondió"
                    maxLength={600}
                    aria-label={`Otra respuesta en ${numero}`}
                    value={actual.comentario || ''}
                    onChange={(evento) => onCambiar({ opciones: [], comentario: evento.target.value, otra: true })}
                />
            )}
        </div>
    );
}


// ---------------------------------------------------------
// Celda editable de la tabla (escritorio)
// ---------------------------------------------------------

function CeldaTabla({
    id,
    valor,
    editable,
    bloqueado = false,
    pendiente,
    fila,
    columna,
    abierta,
    abrirArriba,
    etiqueta,
    onAbrir,
    onCerrar,
    onCambiar
}) {
    if (!editable) {
        return (
            <td className="matriz-celda">
                <Chip valor={valor} bloqueado={bloqueado} />
            </td>
        );
    }

    const manejarTecla = (evento) => {
        if (['1', '2', '3'].includes(evento.key)) {
            evento.preventDefault();
            onCambiar(Number(evento.key));
            return;
        }

        if (evento.key === 'Delete' || evento.key === 'Backspace') {
            evento.preventDefault();
            onCambiar(null);
            return;
        }

        if (evento.key === 'Escape') {
            onCerrar();
            return;
        }

        const movimiento = {
            ArrowUp: [-1, 0],
            ArrowDown: [1, 0],
            ArrowLeft: [0, -1],
            ArrowRight: [0, 1]
        }[evento.key];

        if (movimiento) {
            evento.preventDefault();
            onCerrar();
            document
                .querySelector(`[data-celda="${fila + movimiento[0]}-${columna + movimiento[1]}"]`)
                ?.focus();
        }
    };

    return (
        <td className="matriz-celda">
            <button
                type="button"
                data-celda={`${fila}-${columna}`}
                data-campo={id}
                className={`chip editable ${tieneValor(valor) ? '' : 'vacio'} ${pendiente ? 'pendiente' : ''}`}
                style={tieneValor(valor) ? { background: colorDeValor(valor) } : undefined}
                aria-label={`${etiqueta}: ${tieneValor(valor) ? valor : 'sin valor'}`}
                aria-haspopup="true"
                aria-expanded={abierta}
                onClick={() => (abierta ? onCerrar() : onAbrir())}
                onKeyDown={manejarTecla}
            >
                {tieneValor(valor) ? valor : ''}
            </button>

            {abierta && (
                <div className={`matriz-selector ${abrirArriba ? 'arriba' : ''}`} role="menu">
                    {NIVELES.map((nivel) => (
                        <button
                            key={nivel.valor}
                            type="button"
                            role="menuitem"
                            title={nivel.nombre}
                            className={`chip editable ${valor === nivel.valor ? 'activo' : ''}`}
                            style={{ background: colorDeValor(nivel.valor) }}
                            onClick={() => {
                                onCambiar(nivel.valor);
                                onCerrar();
                            }}
                        >
                            {nivel.valor}
                        </button>
                    ))}

                    <button
                        type="button"
                        role="menuitem"
                        title="Borrar"
                        className="chip editable vacio"
                        onClick={() => {
                            onCambiar(null);
                            onCerrar();
                        }}
                    >
                        ×
                    </button>
                </div>
            )}
        </td>
    );
}


// ---------------------------------------------------------
// Control segmentado 1 · 2 · 3 (móvil)
// ---------------------------------------------------------

function SelectorNivel({ id, etiqueta, valor, editable, bloqueado = false, pendiente, onCambiar }) {
    return (
        <div className={`campo-nivel ${pendiente ? 'pendiente' : ''}`}>
            <span className="campo-nivel-etiqueta">{etiqueta}</span>

            {editable ? (
                <div className="nivel-seg" role="radiogroup" aria-label={etiqueta} data-campo={id}>
                    {NIVELES.map((nivel) => {
                        const activo = valor === nivel.valor;

                        return (
                            <button
                                key={nivel.valor}
                                type="button"
                                role="radio"
                                aria-checked={activo}
                                title={nivel.nombre}
                                className={activo ? 'activo' : ''}
                                style={activo ? { background: colorDeValor(nivel.valor) } : undefined}
                                onClick={() => onCambiar(activo ? null : nivel.valor)}
                            >
                                {nivel.valor}
                            </button>
                        );
                    })}
                </div>
            ) : (
                <Chip valor={valor} bloqueado={bloqueado} />
            )}
        </div>
    );
}


function TarjetasMovil({
    areas,
    criterios,
    filasOrdenadas,
    resultados,
    editable,
    nivelesEditables,
    resaltarPendientes,
    onCambiar,
    respuestas,
    onCambiarRespuesta
}) {
    const [abiertos, setAbiertos] = useState({});

    const pendiente = (valor) => resaltarPendientes && !tieneValor(valor);

    return (
        <div className="matriz-tarjetas">
            {criterios.map((criterio, indice) => {
                const fila = filasOrdenadas[indice];
                const queEvaluar = String(criterio.queEvaluar || '').trim();

                const selector = (campo, etiqueta, valor, area, nodo) => {
                    const esNivel = campo !== 'nodo';
                    const editableCampo = editable && (!esNivel || nivelesEditables);

                    return (
                    <SelectorNivel
                        key={idCampo(criterio.numero, campo, area, nodo)}
                        id={idCampo(criterio.numero, campo, area, nodo)}
                        etiqueta={etiqueta}
                        valor={valor}
                        editable={editableCampo}
                        bloqueado={editable && esNivel && !nivelesEditables}
                        pendiente={editableCampo && pendiente(valor)}
                        onCambiar={(nuevo) => onCambiar?.(criterio.numero, campo, nuevo, area, nodo)}
                    />
                    );
                };

                return (
                    <article key={criterio.numero} className="glass tarjeta-criterio">
                        <header className="tarjeta-criterio-encabezado">
                            <div>
                                <span className="matriz-criterio-numero">{criterio.numero}</span>{' '}
                                <strong>{criterio.nombre}</strong>
                            </div>
                            <Chip valor={resultados.promedioFila[criterio.numero]} decimal fuerte />
                        </header>

                        {queEvaluar && (
                            <>
                                <button
                                    type="button"
                                    className="btn-plain btn-sm tarjeta-info"
                                    aria-expanded={Boolean(abiertos[criterio.numero])}
                                    onClick={() =>
                                        setAbiertos((actual) => ({
                                            ...actual,
                                            [criterio.numero]: !actual[criterio.numero]
                                        }))
                                    }
                                >
                                    {abiertos[criterio.numero] ? 'Ocultar' : '¿Qué evaluar?'}
                                </button>

                                {abiertos[criterio.numero] && (
                                    <p className="tarjeta-que-evaluar">{queEvaluar}</p>
                                )}
                            </>
                        )}

                        <div className="tarjeta-grupo">
                            <div className="tarjeta-grupo-titulo">Niveles</div>
                            <div className="tarjeta-campos">
                                {selector('planta', 'Planta', fila.planta)}
                                {selector('objetivo', 'Objetivo', fila.objetivo)}
                            </div>
                        </div>

                        {areas.map((area) => (
                            <div key={area.nombre} className="tarjeta-grupo">
                                <div className="tarjeta-grupo-titulo">{area.nombre}</div>
                                <div className="tarjeta-campos">
                                    {area.nodos.map((nodo) =>
                                        selector(
                                            'nodo',
                                            nodo,
                                            fila.valores?.[area.nombre]?.[nodo] ?? null,
                                            area.nombre,
                                            nodo
                                        )
                                    )}
                                </div>
                            </div>
                        ))}

                        {respuestas && (
                            <div className="tarjeta-grupo">
                                <div className="tarjeta-grupo-titulo">Respuesta del evaluado</div>
                                <ControlRespuesta
                                    numero={criterio.numero}
                                    opciones={respuestas.opciones.get(String(criterio.numero))}
                                    valor={respuestas.valores[criterio.numero]}
                                    editable={editable}
                                    onCambiar={(valor) => onCambiarRespuesta?.(criterio.numero, valor)}
                                />
                            </div>
                        )}
                    </article>
                );
            })}

            <article className="glass tarjeta-criterio">
                <header className="tarjeta-criterio-encabezado">
                    <strong>Promedios</strong>
                    <Chip valor={resultados.promedioGeneral} decimal fuerte />
                </header>

                <div className="tarjeta-grupo">
                    <div className="tarjeta-campos">
                        <div className="campo-nivel">
                            <span className="campo-nivel-etiqueta">Planta</span>
                            <Chip valor={resultados.promedioPlanta} decimal />
                        </div>
                        <div className="campo-nivel">
                            <span className="campo-nivel-etiqueta">Objetivo</span>
                            <Chip valor={resultados.promedioObjetivo} decimal />
                        </div>
                    </div>
                </div>

                {areas.map((area) => (
                    <div key={area.nombre} className="tarjeta-grupo">
                        <div className="tarjeta-grupo-titulo">{area.nombre}</div>
                        <div className="tarjeta-campos">
                            {area.nodos.map((nodo) => (
                                <div key={nodo} className="campo-nivel">
                                    <span className="campo-nivel-etiqueta">{nodo}</span>
                                    <Chip valor={resultados.promedioNodo[area.nombre]?.[nodo]} decimal />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </article>
        </div>
    );
}


// ---------------------------------------------------------
// Tabla (escritorio)
// ---------------------------------------------------------

function TablaEscritorio({
    areas,
    criterios,
    filasOrdenadas,
    resultados,
    editable,
    nivelesEditables,
    resaltarPendientes,
    onCambiar,
    respuestas,
    onCambiarRespuesta
}) {
    const [celdaAbierta, setCeldaAbierta] = useState(null);
    const [expandidos, setExpandidos] = useState({});

    // Cerrar el selector al hacer clic fuera
    useEffect(() => {
        if (!celdaAbierta) return undefined;

        const cerrar = (evento) => {
            if (!evento.target.closest?.('.matriz-celda')) {
                setCeldaAbierta(null);
            }
        };

        document.addEventListener('mousedown', cerrar);

        return () => document.removeEventListener('mousedown', cerrar);
    }, [celdaAbierta]);

    const totalColumnas =
        4 + (respuestas ? 1 : 0) + areas.reduce((total, area) => total + area.nodos.length, 0);

    return (
        <div className="matriz-contenedor glass">
            <table className="matriz-oma">
                <thead>
                    <tr>
                        <th rowSpan={2} className="col-nivel">Planta</th>
                        <th rowSpan={2} className="col-nivel">Objetivo</th>
                        <th rowSpan={2} className="col-criterio">Criterio</th>

                        {areas.map((area) => (
                            <th key={area.nombre} colSpan={area.nodos.length} className="col-area">
                                {area.nombre}
                            </th>
                        ))}

                        <th rowSpan={2} className="col-promedio">Promedio</th>
                        {respuestas && <th rowSpan={2} className="col-respuesta">Respuesta del evaluado</th>}
                    </tr>

                    <tr>
                        {areas.map((area) =>
                            area.nodos.map((nodo, indice) => (
                                <th
                                    key={`${area.nombre}-${nodo}`}
                                    className={`col-nodo ${indice === 0 ? 'inicio-area' : ''}`}
                                >
                                    {nodo}
                                </th>
                            ))
                        )}
                    </tr>
                </thead>

                <tbody>
                    {criterios.map((criterio, indiceFila) => {
                        const fila = filasOrdenadas[indiceFila];
                        let columna = 0;

                        const celda = (campo, valor, etiqueta, area, nodo) => {
                            const id = idCampo(criterio.numero, campo, area, nodo);
                            const numeroColumna = columna++;
                            const esNivel = campo !== 'nodo';
                            const editableCampo = editable && (!esNivel || nivelesEditables);

                            return (
                                <CeldaTabla
                                    key={id}
                                    id={id}
                                    valor={valor}
                                    editable={editableCampo}
                                    bloqueado={editable && esNivel && !nivelesEditables}
                                    pendiente={editableCampo && resaltarPendientes && !tieneValor(valor)}
                                    fila={indiceFila}
                                    columna={numeroColumna}
                                    abrirArriba={indiceFila >= criterios.length - 2}
                                    etiqueta={`${criterio.numero} ${etiqueta}`}
                                    abierta={celdaAbierta === id}
                                    onAbrir={() => setCeldaAbierta(id)}
                                    onCerrar={() => setCeldaAbierta(null)}
                                    onCambiar={(nuevo) =>
                                        onCambiar?.(criterio.numero, campo, nuevo, area, nodo)
                                    }
                                />
                            );
                        };

                        const queEvaluar = String(criterio.queEvaluar || '').trim();

                        return (
                            <Fragment key={criterio.numero}>
                                <tr>
                                    {celda('planta', fila.planta, 'Nivel Planta')}
                                    {celda('objetivo', fila.objetivo, 'Nivel Objetivo')}

                                    <td className="matriz-criterio">
                                        <span className="matriz-criterio-numero">{criterio.numero}</span>{' '}
                                        {criterio.nombre}

                                        {queEvaluar && (
                                            <button
                                                type="button"
                                                className="matriz-info"
                                                aria-expanded={Boolean(expandidos[criterio.numero])}
                                                onClick={() =>
                                                    setExpandidos((actual) => ({
                                                        ...actual,
                                                        [criterio.numero]: !actual[criterio.numero]
                                                    }))
                                                }
                                            >
                                                {expandidos[criterio.numero] ? 'Ocultar' : '¿Qué evaluar?'}
                                            </button>
                                        )}
                                    </td>

                                    {areas.map((area) =>
                                        area.nodos.map((nodo) =>
                                            celda(
                                                'nodo',
                                                fila.valores?.[area.nombre]?.[nodo] ?? null,
                                                `${area.nombre} ${nodo}`,
                                                area.nombre,
                                                nodo
                                            )
                                        )
                                    )}

                                    <td className="matriz-celda">
                                        <Chip valor={resultados.promedioFila[criterio.numero]} decimal fuerte />
                                    </td>

                                    {respuestas && (
                                        <td className="matriz-respuesta">
                                            <ControlRespuesta
                                                numero={criterio.numero}
                                                opciones={respuestas.opciones.get(String(criterio.numero))}
                                                valor={respuestas.valores[criterio.numero]}
                                                editable={editable}
                                                onCambiar={(valor) => onCambiarRespuesta?.(criterio.numero, valor)}
                                            />
                                        </td>
                                    )}
                                </tr>

                                {queEvaluar && expandidos[criterio.numero] && (
                                    <tr className="matriz-detalle">
                                        <td colSpan={totalColumnas}>
                                            <strong>¿Qué evaluar?</strong> {queEvaluar}
                                        </td>
                                    </tr>
                                )}
                            </Fragment>
                        );
                    })}
                </tbody>

                <tfoot>
                    <tr>
                        <td className="matriz-celda">
                            <Chip valor={resultados.promedioPlanta} decimal />
                        </td>
                        <td className="matriz-celda">
                            <Chip valor={resultados.promedioObjetivo} decimal />
                        </td>

                        <td className="matriz-criterio total">Promedio</td>

                        {areas.map((area) =>
                            area.nodos.map((nodo) => (
                                <td key={`${area.nombre}-${nodo}`} className="matriz-celda">
                                    <Chip valor={resultados.promedioNodo[area.nombre]?.[nodo]} decimal />
                                </td>
                            ))
                        )}

                        <td className="matriz-celda">
                            <Chip valor={resultados.promedioGeneral} decimal fuerte />
                        </td>
                        {respuestas && <td className="matriz-respuesta" />}
                    </tr>
                </tfoot>
            </table>
        </div>
    );
}


function MatrizOMA({
    areas,
    criterios,
    filas,
    editable = false,
    // false: Planta/Objetivo de solo lectura (los define el admin)
    nivelesEditables = true,
    resaltarPendientes = false,
    onCambiar,
    // Opcional: { opciones: [{ numero, opciones }], valores: { numero: {...} } }
    respuestas = null,
    onCambiarRespuesta
}) {
    const esMovil = useMediaQuery(CONSULTA_MOVIL);

    const filasOrdenadas = criterios.map(
        (criterio) =>
            filas[criterio.numero] || {
                numero: criterio.numero,
                planta: null,
                objetivo: null,
                valores: {}
            }
    );

    const props = {
        areas,
        criterios,
        filasOrdenadas,
        resultados: calcularResultados(filasOrdenadas, areas),
        editable,
        nivelesEditables,
        resaltarPendientes,
        onCambiar,
        respuestas: respuestas
            ? {
                opciones: new Map((respuestas.opciones || []).map((item) => [String(item.numero), item.opciones || []])),
                valores: respuestas.valores || {}
            }
            : null,
        onCambiarRespuesta
    };

    return esMovil ? <TarjetasMovil {...props} /> : <TablaEscritorio {...props} />;
}

export default MatrizOMA;
