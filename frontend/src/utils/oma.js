/*
 * =========================================================
 * LÓGICA COMPARTIDA OMA EN PISO
 *
 * Replica la hoja "OMA EN PISO" del Excel:
 * - Filas: criterios.
 * - Columnas: Planta, Objetivo y un nodo por columna.
 * - Promedio de fila = promedio de sus 12 nodos.
 * - Fila final = promedio de cada columna; el promedio
 *   general es el promedio de los promedios de fila.
 * =========================================================
 */

export const NIVELES = [
    { valor: 1, nombre: 'Naranja' },
    { valor: 2, nombre: 'Amarillo' },
    { valor: 3, nombre: 'Verde' }
];

// Mismos colores que el Excel original
export const COLORES_NIVEL = {
    1: '#FFC000',
    2: '#FFFF00',
    3: '#92D050'
};

export const COLOR_SIN_DATO = '#E5E7EB';


/*
 * Nivel de un valor (entero o promedio):
 * < 2 -> 1 (naranja), < 3 -> 2 (amarillo), 3 -> 3 (verde)
 */
export function nivelDeValor(valor) {
    if (valor === null || valor === undefined || valor === '') {
        return null;
    }

    const numero = Number(valor);

    if (Number.isNaN(numero) || numero < 1) {
        return null;
    }

    if (numero < 2) return 1;
    if (numero < 3) return 2;

    return 3;
}


export function colorDeValor(valor) {
    return COLORES_NIVEL[nivelDeValor(valor)] || COLOR_SIN_DATO;
}


export function formatearPromedio(valor) {
    return typeof valor === 'number' && !Number.isNaN(valor)
        ? valor.toFixed(2)
        : '—';
}


/*
 * Áreas: acepta { CTT1: ['B1', 'B2'] } o
 * [{ nombre: 'CTT1', nodos: [...] }] y devuelve
 * siempre [{ nombre, nodos }].
 */
export function normalizarAreas(datosAreas) {
    if (Array.isArray(datosAreas)) {
        return datosAreas
            .filter((area) => area?.nombre)
            .map((area) => ({
                nombre: String(area.nombre),
                nodos: Array.isArray(area.nodos) ? area.nodos : []
            }));
    }

    if (datosAreas && typeof datosAreas === 'object') {
        return Object.entries(datosAreas).map(([nombre, nodos]) => ({
            nombre,
            nodos: Array.isArray(nodos) ? nodos : []
        }));
    }

    return [];
}


export function contarNodos(areas) {
    return areas.reduce((total, area) => total + area.nodos.length, 0);
}


// MongoDB guarda "W7.2" como "W7_2"
export function obtenerClaveNodo(nodo) {
    return String(nodo).replace(/[.$]/g, '_');
}


// Lee el valor de un nodo en formato guardado o en formato original
export function leerValorNodo(datosArea, nodo) {
    if (!datosArea || typeof datosArea !== 'object') {
        return null;
    }

    // Formatos guardados: "W7_2" (actual), "W7.2" (literal) y
    // { W7: { 2: valor } } (evaluaciones antiguas, donde MongoDB
    // convirtió el punto en un objeto anidado).
    const partes = String(nodo).split('.');
    const anidado = partes.length === 2 ? datosArea[partes[0]]?.[partes[1]] : undefined;

    const valor =
        datosArea[obtenerClaveNodo(nodo)] ??
        (typeof datosArea[nodo] === 'object' ? undefined : datosArea[nodo]) ??
        anidado;

    if (valor === null || valor === undefined || typeof valor === 'object') {
        return null;
    }

    const numero = Number(valor);

    return Number.isNaN(numero) ? null : numero;
}


function promedio(valores) {
    const validos = valores.filter(
        (valor) => typeof valor === 'number' && !Number.isNaN(valor)
    );

    if (validos.length === 0) {
        return null;
    }

    const suma = validos.reduce((total, valor) => total + valor, 0);

    // Sin redondear: se redondea solo al mostrar,
    // igual que el Excel.
    return suma / validos.length;
}


/*
 * Convierte un criterio guardado en MongoDB a una fila
 * de la matriz: { numero, nombre, planta, objetivo,
 * valores: { [area]: { [nodo]: valor } } }
 */
export function filaDesdeCriterio(criterio, areas) {
    const valores = {};

    areas.forEach((area) => {
        valores[area.nombre] = {};

        area.nodos.forEach((nodo) => {
            valores[area.nombre][nodo] = leerValorNodo(
                criterio?.evaluaciones?.[area.nombre],
                nodo
            );
        });
    });

    return {
        numero: String(criterio?.numero ?? ''),
        nombre: criterio?.nombre ?? '',
        planta: criterio?.nivelPlanta ?? null,
        objetivo: criterio?.nivelObjetivo ?? null,
        valores
    };
}


/*
 * Calcula los resultados de la matriz:
 * - promedioFila[numero]
 * - promedioNodo[area][nodo] (fila final del Excel)
 * - promedioArea[area]
 * - promedioPlanta, promedioObjetivo, promedioGeneral
 */
export function calcularResultados(filas, areas) {
    const promedioFila = {};
    const promedioNodo = {};
    const promedioArea = {};

    filas.forEach((fila) => {
        const valoresFila = areas.flatMap((area) =>
            area.nodos.map((nodo) => fila.valores?.[area.nombre]?.[nodo])
        );

        const completos = valoresFila.every(
            (valor) => valor !== null && valor !== undefined
        );

        // Como en el Excel: el promedio solo existe
        // cuando los 12 nodos tienen valor.
        promedioFila[fila.numero] = completos ? promedio(valoresFila) : null;
    });

    areas.forEach((area) => {
        promedioNodo[area.nombre] = {};

        area.nodos.forEach((nodo) => {
            promedioNodo[area.nombre][nodo] = promedio(
                filas.map((fila) => fila.valores?.[area.nombre]?.[nodo])
            );
        });

        promedioArea[area.nombre] = promedio(
            filas.flatMap((fila) =>
                area.nodos.map((nodo) => fila.valores?.[area.nombre]?.[nodo])
            )
        );
    });

    return {
        promedioFila,
        promedioNodo,
        promedioArea,
        promedioPlanta: promedio(filas.map((fila) => fila.planta)),
        promedioObjetivo: promedio(filas.map((fila) => fila.objetivo)),
        promedioGeneral: promedio(Object.values(promedioFila))
    };
}


/*
 * Celdas pendientes de una matriz en captura.
 * Devuelve [{ numero, campo, area?, nodo? }]
 */
export function obtenerPendientes(filas, areas, { incluirNiveles = true } = {}) {
    const pendientes = [];

    filas.forEach((fila) => {
        if (incluirNiveles && !fila.planta) {
            pendientes.push({ numero: fila.numero, campo: 'planta' });
        }

        if (incluirNiveles && !fila.objetivo) {
            pendientes.push({ numero: fila.numero, campo: 'objetivo' });
        }

        areas.forEach((area) => {
            area.nodos.forEach((nodo) => {
                if (!fila.valores?.[area.nombre]?.[nodo]) {
                    pendientes.push({
                        numero: fila.numero,
                        campo: 'nodo',
                        area: area.nombre,
                        nodo
                    });
                }
            });
        });
    });

    return pendientes;
}


/*
 * =========================================================
 * LÍNEAS (NODOS) ELEGIDAS
 *
 * Una selección es una lista de claves "AREA|NODO".
 * =========================================================
 */

export const claveNodoSeleccion = (area, nodo) => `${area}|${nodo}`;

export const todasLasClaves = (areas) =>
    areas.flatMap((area) => area.nodos.map((nodo) => claveNodoSeleccion(area.nombre, nodo)));

// Áreas reducidas a los nodos elegidos (se omiten áreas vacías)
export function filtrarAreas(areas, seleccion) {
    const elegidas = new Set(seleccion);

    return areas
        .map((area) => ({
            nombre: area.nombre,
            nodos: area.nodos.filter((nodo) => elegidas.has(claveNodoSeleccion(area.nombre, nodo)))
        }))
        .filter((area) => area.nodos.length > 0);
}

// Áreas/nodos con que se hizo una evaluación guardada. Se arman
// desde la propia evaluación (no desde la configuración vigente),
// así renombrar, mover o quitar líneas no altera el historial.
// El orden de las áreas sigue la configuración actual.
export function areasDeEvaluacion(evaluacion, areas) {
    const nodos = Array.isArray(evaluacion?.nodosEvaluados) ? evaluacion.nodosEvaluados : [];

    if (nodos.length === 0) return areas;

    const porArea = new Map();

    nodos.forEach((item) => {
        if (!item?.area || !item?.nodo) return;
        if (!porArea.has(item.area)) porArea.set(item.area, []);
        if (!porArea.get(item.area).includes(item.nodo)) porArea.get(item.area).push(item.nodo);
    });

    const orden = areas.map((area) => area.nombre);

    return [...porArea.entries()]
        .sort(([a], [b]) => {
            const ia = orden.indexOf(a);
            const ib = orden.indexOf(b);
            return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
        })
        .map(([nombre, lista]) => ({ nombre, nodos: lista }));
}


export function formatearFecha(fecha, estilo = 'medium') {
    if (!fecha) return 'Sin fecha';

    const valor = new Date(fecha);

    return Number.isNaN(valor.getTime())
        ? 'Sin fecha'
        : valor.toLocaleString('es-MX', { dateStyle: estilo, timeStyle: 'short' });
}


/*
 * Matriz de una evaluación guardada: { criterios, filas }.
 * Respeta el orden de la configuración y conserva al
 * final los criterios antiguos que ya no estén configurados.
 */
export function construirMatriz(evaluacion, criteriosConfig, areas) {
    const guardados = Array.isArray(evaluacion?.criterios)
        ? evaluacion.criterios.filter((criterio) => criterio && typeof criterio === 'object')
        : [];

    const porNumero = new Map(
        guardados.map((criterio) => [String(criterio.numero), criterio])
    );

    const configPorNumero = new Map(
        (criteriosConfig || []).map((criterio) => [String(criterio.numero), criterio])
    );

    const numeros = [
        ...[...configPorNumero.keys()].filter((numero) => porNumero.has(numero)),
        ...[...porNumero.keys()].filter((numero) => !configPorNumero.has(numero))
    ];

    const criterios = numeros.map((numero) => ({
        numero,
        nombre: configPorNumero.get(numero)?.nombre || porNumero.get(numero)?.nombre || '',
        queEvaluar: configPorNumero.get(numero)?.queEvaluar || ''
    }));

    const filas = Object.fromEntries(
        numeros.map((numero) => [numero, filaDesdeCriterio(porNumero.get(numero), areas)])
    );

    return { criterios, filas };
}


/*
 * Evaluador de una evaluación. El backend lo adjunta
 * (populate) como objeto; si no, solo viene su id.
 */
export function evaluadorDe(evaluacion) {
    const usuario = evaluacion?.usuario;

    if (usuario && typeof usuario === 'object') {
        return {
            id: String(usuario._id ?? usuario.id ?? ''),
            nombre: usuario.nombre || 'Usuario',
            correo: usuario.correo || '',
            area: usuario.area || evaluacion.area || ''
        };
    }

    return {
        id: String(usuario ?? ''),
        nombre: 'Usuario',
        correo: '',
        area: evaluacion?.area || ''
    };
}


// Lista única de evaluadores presentes en las evaluaciones
export function listaEvaluadores(evaluaciones) {
    const mapa = new Map();

    evaluaciones.forEach((evaluacion) => {
        const evaluador = evaluadorDe(evaluacion);

        if (evaluador.id && !mapa.has(evaluador.id)) {
            mapa.set(evaluador.id, evaluador);
        }
    });

    return [...mapa.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}
