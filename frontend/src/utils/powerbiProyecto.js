/*
 * =========================================================
 * PROYECTO DE POWER BI (.pbip) CON GRÁFICA DE PASTEL
 *
 * Genera los archivos de un proyecto de Power BI Desktop
 * (formato PBIP: modelo semántico en TMDL + informe PBIR)
 * con:
 *   - Tabla "Valoraciones": una fila por calificación de
 *     línea (evaluación × criterio × línea).
 *   - Página "Valoraciones por nivel" con una gráfica de
 *     pastel ya configurada (1 Naranja, 2 Amarillo, 3 Verde).
 *
 * Los datos van incrustados en la consulta (comprimidos),
 * así el proyecto se abre en cualquier equipo sin depender
 * de rutas de archivos.
 *
 * No depende del navegador: recibe una función que
 * comprime texto (deflate sin encabezado) y devuelve base64.
 * =========================================================
 */

// Nombres cortos: Windows limita las rutas a 260 caracteres
export const NOMBRE_PROYECTO = 'OMA';
const TABLA = 'Valoraciones';

export const NIVELES_POWERBI = [
    { valor: 1, nombre: '1 · Naranja', color: '#FFC000' },
    { valor: 2, nombre: '2 · Amarillo', color: '#FFFF00' },
    { valor: 3, nombre: '3 · Verde', color: '#92D050' }
];

// Tema "OMA Digital": fondo blanco, texto oscuro y colores de OMA
const TEMA = {
    name: 'OMA Digital',
    dataColors: ['#FFC000', '#FFFF00', '#92D050', '#2A78D6', '#4A3AA7', '#1BAF7A', '#EB6834', '#E87BA4'],
    background: '#FFFFFF',
    foreground: '#1D1D1F',
    tableAccent: '#002060',
    good: '#92D050',
    neutral: '#FFFF00',
    bad: '#FFC000',
    textClasses: {
        title: { fontFace: 'Segoe UI Semibold', fontSize: 14, color: '#1D1D1F' },
        label: { fontFace: 'Segoe UI', fontSize: 11, color: '#1D1D1F' },
        callout: { fontFace: 'Segoe UI Semibold', fontSize: 28, color: '#1D1D1F' },
        header: { fontFace: 'Segoe UI Semibold', fontSize: 12, color: '#1D1D1F' }
    },
    visualStyles: {
        page: {
            '*': {
                background: [{ color: { solid: { color: '#FFFFFF' } }, transparency: 0 }],
                outspace: [{ color: { solid: { color: '#F2F2F7' } }, transparency: 0 }]
            }
        },
        '*': {
            '*': {
                background: [{ show: true, color: { solid: { color: '#FFFFFF' } }, transparency: 0 }],
                border: [{ show: true, color: { solid: { color: '#E5E5EA' } }, radius: 12 }],
                title: [{ fontColor: { solid: { color: '#1D1D1F' } } }]
            }
        }
    }
};

// Columnas de la tabla (orden de los datos incrustados)
const COLUMNAS = [
    { nombre: 'Evaluación', tipo: 'string', m: 'type text' },
    { nombre: 'Fecha', tipo: 'dateTime', m: 'type datetime', formato: 'General Date' },
    { nombre: 'Evaluador', tipo: 'string', m: 'type text' },
    { nombre: 'Correo evaluador', tipo: 'string', m: 'type text' },
    { nombre: 'Área evaluador', tipo: 'string', m: 'type text' },
    { nombre: 'Criterio', tipo: 'string', m: 'type text' },
    { nombre: 'Nombre criterio', tipo: 'string', m: 'type text' },
    { nombre: 'Área', tipo: 'string', m: 'type text' },
    { nombre: 'Línea', tipo: 'string', m: 'type text' },
    { nombre: 'Nivel Planta', tipo: 'int64', m: 'Int64.Type', formato: '0' },
    { nombre: 'Nivel Objetivo', tipo: 'int64', m: 'Int64.Type', formato: '0' },
    { nombre: 'Valor', tipo: 'int64', m: 'Int64.Type', formato: '0' },
    { nombre: 'Nivel', tipo: 'string', m: 'type text', ordenarPor: 'Valor' }
];


// Identificador estable (formato GUID) a partir de un texto
function guid(texto) {
    let h1 = 0x811c9dc5;
    let h2 = 0x01000193;
    const hex = [];

    for (let ronda = 0; ronda < 4; ronda++) {
        for (const caracter of `${ronda}:${texto}`) {
            h1 = Math.imul(h1 ^ caracter.charCodeAt(0), 16777619) >>> 0;
            h2 = Math.imul(h2 + caracter.charCodeAt(0), 2246822519) >>> 0;
        }

        hex.push(((h1 ^ h2) >>> 0).toString(16).padStart(8, '0'));
    }

    const s = hex.join('');

    return `${s.slice(0, 8)}-${s.slice(8, 12)}-4${s.slice(13, 16)}-a${s.slice(17, 20)}-${s.slice(20, 32)}`;
}

// Nombre válido en TMDL: entre comillas simples si tiene espacios o acentos
const nombreTmdl = (nombre) => (/^[A-Za-z_][A-Za-z0-9_]*$/.test(nombre) ? nombre : `'${nombre.replace(/'/g, "''")}'`);

// Texto como literal de M ("..." con comillas duplicadas)
const literalM = (texto) => `"${String(texto).replace(/"/g, '""')}"`;

// Literal de texto en las expresiones del informe: 'texto'
const literal = (texto) => ({ expr: { Literal: { Value: `'${String(texto).replace(/'/g, "''")}'` } } });
const literalRaw = (valor) => ({ expr: { Literal: { Value: String(valor) } } });

const columna = (propiedad) => ({ Column: { Expression: { SourceRef: { Entity: TABLA } }, Property: propiedad } });
const medida = (propiedad) => ({ Measure: { Expression: { SourceRef: { Entity: TABLA } }, Property: propiedad } });


/*
 * Filas para la tabla Valoraciones a partir de las filas
 * de exportación ([evaluacion, fecha, evaluador, ...]).
 */
export function filasDesdeExportacion(registros) {
    return registros
        .filter((registro) => [1, 2, 3].includes(Number(registro.valor)))
        .map((registro) => [
            String(registro.evaluacion),
            registro.fecha || null,
            registro.evaluador || '',
            registro.correo || '',
            registro.areaEvaluador || '',
            registro.criterio || '',
            registro.nombreCriterio || '',
            registro.area || '',
            registro.linea || '',
            Number(registro.planta) || null,
            Number(registro.objetivo) || null,
            Number(registro.valor),
            NIVELES_POWERBI.find((nivel) => nivel.valor === Number(registro.valor)).nombre
        ]);
}


// ---------------------------------------------------------
// Modelo semántico (TMDL)
// ---------------------------------------------------------

function tmdlTabla(datosBase64, filasDax = null) {
    const t = '\t';
    const lineas = [`table ${TABLA}`, `${t}lineageTag: ${guid('tabla')}`, ''];

    lineas.push(
        `${t}measure 'Total valoraciones' = COUNTROWS(${TABLA})`,
        `${t}${t}formatString: #,0`,
        `${t}${t}lineageTag: ${guid('medida-total')}`,
        '',
        `${t}measure '% del total' = DIVIDE(COUNTROWS(${TABLA}), CALCULATE(COUNTROWS(${TABLA}), ALL(${TABLA})))`,
        `${t}${t}formatString: 0.0%;-0.0%;0.0%`,
        `${t}${t}lineageTag: ${guid('medida-porcentaje')}`,
        '',
        `${t}measure 'Promedio' = AVERAGE(${TABLA}[Valor])`,
        `${t}${t}formatString: 0.00`,
        `${t}${t}lineageTag: ${guid('medida-promedio')}`,
        '',
        ...NIVELES_POWERBI.flatMap((nivel) => [
            `${t}measure '% ${nivel.nombre.split(' · ')[1]}' = DIVIDE(CALCULATE(COUNTROWS(${TABLA}), ${TABLA}[Valor] = ${nivel.valor}), COUNTROWS(${TABLA}))`,
            `${t}${t}formatString: 0.0%;-0.0%;0.0%`,
            `${t}${t}lineageTag: ${guid(`medida-pct-${nivel.valor}`)}`,
            ''
        ])
    );

    COLUMNAS.forEach((col) => {
        lineas.push(`${t}column ${nombreTmdl(col.nombre)}`);
        lineas.push(`${t}${t}dataType: ${col.tipo}`);
        if (filasDax) lineas.push(`${t}${t}isNameInferred`);
        if (col.formato) lineas.push(`${t}${t}formatString: ${col.formato}`);
        lineas.push(`${t}${t}lineageTag: ${guid(`columna-${col.nombre}`)}`);
        lineas.push(`${t}${t}summarizeBy: none`);
        lineas.push(`${t}${t}sourceColumn: ${filasDax ? `[${col.nombre}]` : col.nombre}`);
        if (col.ordenarPor) lineas.push(`${t}${t}sortByColumn: ${nombreTmdl(col.ordenarPor)}`);
        lineas.push('');
    });

    if (filasDax) {
        // Tabla calculada (DAX): el motor la calcula al abrir el
        // proyecto, sin que nadie tenga que presionar "Actualizar".
        const tiposDax = { string: 'STRING', int64: 'INTEGER', dateTime: 'DATETIME' };
        const definicion = COLUMNAS.map((col) => `${literalM(col.nombre)}, ${tiposDax[col.tipo]}`).join(', ');
        const valorDax = (valor, col) => {
            if (valor === null || valor === undefined || valor === '') return col.tipo === 'string' ? '""' : 'BLANK()';
            if (col.tipo === 'string') return literalM(valor);
            if (col.tipo === 'dateTime') return literalM(String(valor).replace('T', ' ').replace(/\.\d+Z?$|Z$/, ''));
            return String(Number(valor));
        };

        lineas.push(`${t}partition ${TABLA} = calculated`);
        lineas.push(`${t}${t}mode: import`);
        lineas.push(`${t}${t}source =`);
        lineas.push(`${t}${t}${t}${t}DATATABLE(${definicion},`);
        lineas.push(`${t}${t}${t}${t}${t}{`);
        filasDax.forEach((fila, indice) => {
            const valores = fila.map((valor, i) => valorDax(valor, COLUMNAS[i])).join(', ');
            lineas.push(`${t}${t}${t}${t}${t}${t}{${valores}}${indice < filasDax.length - 1 ? ',' : ''}`);
        });
        lineas.push(`${t}${t}${t}${t}${t}}`);
        lineas.push(`${t}${t}${t}${t})`);
        lineas.push('');

        return lineas.join('\n');
    }

    const tipos = COLUMNAS.map((col) => `{${literalM(col.nombre)}, ${col.m}}`).join(', ');
    const nombres = COLUMNAS.map((col) => literalM(col.nombre)).join(', ');

    const m = [
        'let',
        `    Datos = Json.Document(Binary.Decompress(Binary.FromText(${literalM(datosBase64)}, BinaryEncoding.Base64), Compression.Deflate)),`,
        `    Tabla = Table.FromRows(Datos, {${nombres}}),`,
        `    Fechas = Table.TransformColumns(Tabla, {{"Fecha", each if _ = null then null else DateTimeZone.RemoveZone(DateTimeZone.FromText(_)), type nullable datetime}}),`,
        `    Tipos = Table.TransformColumnTypes(Fechas, {${tipos}})`,
        'in',
        '    Tipos'
    ];

    lineas.push(`${t}partition ${TABLA} = m`);
    lineas.push(`${t}${t}mode: import`);
    lineas.push(`${t}${t}source =`);
    m.forEach((linea) => lineas.push(`${t}${t}${t}${t}${linea}`));
    lineas.push('');

    return lineas.join('\n');
}

function archivosModelo(datosBase64, filasDax) {
    const base = `${NOMBRE_PROYECTO}.SemanticModel`;

    return {
        [`${base}/definition.pbism`]: JSON.stringify({
            $schema: 'https://developer.microsoft.com/json-schemas/fabric/item/semanticModel/definitionProperties/1.0.0/schema.json',
            version: '4.2',
            settings: {}
        }, null, 2),
        [`${base}/definition/database.tmdl`]: 'database\n\tcompatibilityLevel: 1567\n',
        [`${base}/definition/model.tmdl`]: [
            'model Model',
            '\tculture: es-MX',
            '\tdefaultPowerBIDataSourceVersion: powerBI_V3',
            '\tsourceQueryCulture: es-MX',
            '\tdataAccessOptions',
            '\t\tlegacyRedirects',
            '\t\treturnErrorValuesAsNull',
            '',
            `ref table ${TABLA}`,
            ''
        ].join('\n'),
        [`${base}/definition/tables/${TABLA}.tmdl`]: tmdlTabla(datosBase64, filasDax)
    };
}


// ---------------------------------------------------------
// Informe (PBIR)
// ---------------------------------------------------------

const ESQUEMA = 'https://developer.microsoft.com/json-schemas/fabric/item/report/definition';

function titulo(texto) {
    return {
        title: [{
            properties: {
                show: literalRaw(true),
                text: literal(texto),
                fontSize: literalRaw('16D'),
                bold: literalRaw(true)
            }
        }]
    };
}

const proyeccion = (campo, nombre, extra = {}) => ({
    field: campo,
    queryRef: `${TABLA}.${nombre}`,
    nativeQueryRef: nombre,
    ...extra
});

// Colores fijos por nivel (1 Naranja, 2 Amarillo, 3 Verde)
const coloresPorNivel = () =>
    NIVELES_POWERBI.map((nivel) => ({
        properties: { fill: { solid: { color: literal(nivel.color) } } },
        selector: {
            data: [{
                scopeId: {
                    Comparison: {
                        ComparisonKind: 0,
                        Left: columna('Nivel'),
                        Right: { Literal: { Value: `'${nivel.nombre}'` } }
                    }
                }
            }]
        }
    }));

function contenedor(nombre, posicion, visual) {
    return {
        $schema: `${ESQUEMA}/visualContainer/2.4.0/schema.json`,
        name: nombre,
        position: { z: 1000, tabOrder: 0, ...posicion },
        visual
    };
}

function visualTexto(nombre, principal, secundario) {
    return contenedor(nombre, { x: 32, y: 12, z: 0, height: 84, width: 1216 }, {
        visualType: 'textbox',
        objects: {
            general: [{
                properties: {
                    paragraphs: [
                        { textRuns: [{ value: principal, textStyle: { fontSize: '20pt', fontWeight: 'bold', color: '#002060' } }] },
                        { textRuns: [{ value: secundario, textStyle: { fontSize: '11pt', color: '#515154' } }] }
                    ]
                }
            }]
        }
    });
}

function visualPastel(posicion) {
    return contenedor('pastel', posicion, {
        visualType: 'pieChart',
        query: {
            queryState: {
                Category: { projections: [proyeccion(columna('Nivel'), 'Nivel', { active: true })] },
                Y: { projections: [proyeccion(medida('Total valoraciones'), 'Total valoraciones')] }
            },
            sortDefinition: { sort: [{ field: columna('Nivel'), direction: 'Ascending' }], isDefaultSort: false }
        },
        objects: {
            dataPoint: coloresPorNivel(),
            legend: [{ properties: { show: literalRaw(true), position: literal('Right'), fontSize: literalRaw('12D') } }],
            labels: [{ properties: { show: literalRaw(true), labelStyle: literal('Category, percent of total'), fontSize: literalRaw('12D') } }]
        },
        visualContainerObjects: titulo('Valoraciones por nivel')
    });
}

function visualTablaNiveles(posicion) {
    return contenedor('tabla', posicion, {
        visualType: 'tableEx',
        query: {
            queryState: {
                Values: {
                    projections: [
                        proyeccion(columna('Nivel'), 'Nivel'),
                        proyeccion(medida('Total valoraciones'), 'Total valoraciones'),
                        proyeccion(medida('% del total'), '% del total')
                    ]
                }
            },
            sortDefinition: { sort: [{ field: columna('Nivel'), direction: 'Ascending' }], isDefaultSort: false }
        },
        visualContainerObjects: titulo('Detalle por nivel')
    });
}

// Filtro desplegable (segmentador) de una columna
function visualFiltro(nombre, campo, posicion) {
    return contenedor(nombre, posicion, {
        visualType: 'slicer',
        query: {
            queryState: { Values: { projections: [proyeccion(columna(campo), campo, { active: true })] } },
            sortDefinition: { sort: [{ field: columna(campo), direction: 'Ascending' }], isDefaultSort: false }
        },
        objects: {
            data: [{ properties: { mode: literal('Dropdown') } }],
            selection: [{ properties: { selectAllCheckboxEnabled: literalRaw(true) } }]
        },
        visualContainerObjects: {
            title: [{ properties: { show: literalRaw(true), text: literal(campo), fontSize: literalRaw('12D'), bold: literalRaw(true) } }]
        }
    });
}

/*
 * Barras apiladas al 100 %: cada barra (área o línea) muestra
 * qué parte de sus calificaciones fue Naranja, Amarillo y Verde.
 * Ordenadas de mayor a menor % Naranja: arriba lo que más
 * necesita mejora.
 */
function visualBarrasNivel(nombre, campo, tituloVisual, posicion) {
    return contenedor(nombre, posicion, {
        visualType: 'hundredPercentStackedBarChart',
        query: {
            queryState: {
                Category: { projections: [proyeccion(columna(campo), campo, { active: true })] },
                Series: { projections: [proyeccion(columna('Nivel'), 'Nivel')] },
                Y: { projections: [proyeccion(medida('Total valoraciones'), 'Total valoraciones')] },
                Tooltips: { projections: [proyeccion(medida('% Naranja'), '% Naranja'), proyeccion(medida('% Amarillo'), '% Amarillo'), proyeccion(medida('% Verde'), '% Verde'), proyeccion(medida('Promedio'), 'Promedio')] }
            },
            sortDefinition: { sort: [{ field: medida('% Naranja'), direction: 'Descending' }], isDefaultSort: false }
        },
        objects: {
            dataPoint: coloresPorNivel(),
            legend: [{ properties: { show: literalRaw(true), position: literal('Top'), fontSize: literalRaw('11D') } }],
            // Sin texto dentro de las barras: Power BI fuerza texto blanco
            // (ilegible sobre amarillo). Los % se ven en la información
            // emergente y en la tabla de líneas.
            labels: [{ properties: { show: literalRaw(false) } }],
            categoryAxis: [{ properties: { fontSize: literalRaw('11D') } }]
        },
        visualContainerObjects: titulo(tituloVisual)
    });
}

// Líneas del promedio más bajo al más alto
function visualTablaLineas(posicion) {
    return contenedor('tablaLineas', posicion, {
        visualType: 'tableEx',
        query: {
            queryState: {
                Values: {
                    projections: [
                        proyeccion(columna('Línea'), 'Línea'),
                        proyeccion(columna('Área'), 'Área'),
                        proyeccion(medida('Promedio'), 'Promedio'),
                        proyeccion(medida('% Naranja'), '% Naranja'),
                        proyeccion(medida('% Amarillo'), '% Amarillo'),
                        proyeccion(medida('% Verde'), '% Verde'),
                        proyeccion(medida('Total valoraciones'), 'Total valoraciones')
                    ]
                }
            },
            sortDefinition: { sort: [{ field: medida('Promedio'), direction: 'Ascending' }], isDefaultSort: false }
        },
        visualContainerObjects: titulo('Líneas: del promedio más bajo al más alto')
    });
}

function archivosInforme(descripcion) {
    const base = `${NOMBRE_PROYECTO}.Report`;
    const paginas = 'definition/pages';
    const json = (objeto) => JSON.stringify(objeto, null, 2);
    const pagina = (nombre, displayName) => json({
        $schema: `${ESQUEMA}/page/2.0.0/schema.json`,
        name: nombre,
        displayName,
        displayOption: 'FitToPage',
        height: 720,
        width: 1280
    });

    const visuales = {
        resumen: [
            visualTexto('titulo', 'OMA Digital · Shop Floor OMA', descripcion),
            visualFiltro('filtroArea', 'Área', { x: 824, y: 112, height: 72, width: 200, tabOrder: 1 }),
            visualFiltro('filtroLinea', 'Línea', { x: 1040, y: 112, height: 72, width: 208, tabOrder: 2 }),
            visualPastel({ x: 32, y: 112, height: 580, width: 768, tabOrder: 0 }),
            visualTablaNiveles({ x: 824, y: 200, height: 220, width: 424, tabOrder: 3 })
        ],
        dondeMejorar: [
            visualTexto('titulo', 'Dónde mejorar', 'Qué parte de las calificaciones de cada área y línea fue Naranja, Amarillo o Verde. Arriba, lo que más necesita mejora. Pasa el mouse sobre una barra para ver los porcentajes; haz clic para filtrar.'),
            visualBarrasNivel('barrasArea', 'Área', 'Niveles por área', { x: 32, y: 112, height: 268, width: 560, tabOrder: 0 }),
            visualTablaLineas({ x: 32, y: 396, height: 300, width: 560, tabOrder: 1 }),
            visualBarrasNivel('barrasLinea', 'Línea', 'Niveles por línea', { x: 608, y: 112, height: 584, width: 640, tabOrder: 2 })
        ]
    };

    const archivos = {
        [`${base}/definition.pbir`]: json({
            $schema: 'https://developer.microsoft.com/json-schemas/fabric/item/report/definitionProperties/2.0.0/schema.json',
            version: '4.0',
            datasetReference: { byPath: { path: `../${NOMBRE_PROYECTO}.SemanticModel` } }
        }),
        [`${base}/definition/version.json`]: json({
            $schema: `${ESQUEMA}/versionMetadata/1.0.0/schema.json`,
            version: '2.0.0'
        }),
        [`${base}/definition/report.json`]: json({
            $schema: `${ESQUEMA}/report/3.0.0/schema.json`,
            // Tema base incluido en Power BI Desktop + tema "OMA Digital" encima
            themeCollection: {
                baseTheme: {
                    name: 'CY24SU10',
                    reportVersionAtImport: { visual: '1.8.95', report: '2.0.95', page: '1.3.95' },
                    type: 'SharedResources'
                },
                customTheme: {
                    name: 'OMA_Digital.json',
                    reportVersionAtImport: { visual: '2.4.0', report: '3.0.0', page: '2.0.0' },
                    type: 'RegisteredResources'
                }
            },
            layoutOptimization: 'None',
            resourcePackages: [
                {
                    name: 'SharedResources',
                    type: 'SharedResources',
                    items: [{ name: 'CY24SU10', path: 'BaseThemes/CY24SU10.json', type: 'BaseTheme' }]
                },
                {
                    name: 'RegisteredResources',
                    type: 'RegisteredResources',
                    items: [{ name: 'OMA_Digital.json', path: 'OMA_Digital.json', type: 'CustomTheme' }]
                }
            ]
        }),
        [`${base}/StaticResources/RegisteredResources/OMA_Digital.json`]: json(TEMA),
        [`${base}/${paginas}/pages.json`]: json({
            $schema: `${ESQUEMA}/pagesMetadata/1.0.0/schema.json`,
            pageOrder: ['resumen', 'dondeMejorar'],
            activePageName: 'resumen'
        }),
        [`${base}/${paginas}/resumen/page.json`]: pagina('resumen', 'Valoraciones por nivel'),
        [`${base}/${paginas}/dondeMejorar/page.json`]: pagina('dondeMejorar', 'Dónde mejorar')
    };

    Object.entries(visuales).forEach(([nombrePagina, lista]) => {
        lista.forEach((visual) => {
            archivos[`${base}/${paginas}/${nombrePagina}/visuals/${visual.name}/visual.json`] = json(visual);
        });
    });

    return archivos;
}


/*
 * Devuelve { 'ruta/archivo': contenido } listo para empaquetar.
 * comprimir(texto) -> Promise<string base64> (deflate sin encabezado)
 */
export async function construirProyectoPowerBI({ filas, descripcion, comprimir, modo = 'calculada' }) {
    // calculada: datos en DAX (listos al abrir). consulta: datos en Power Query.
    const datosBase64 = modo === 'consulta' ? await comprimir(JSON.stringify(filas)) : '';
    const filasDax = modo === 'consulta' ? null : filas;

    return {
        [`${NOMBRE_PROYECTO}.pbip`]: JSON.stringify({
            $schema: 'https://developer.microsoft.com/json-schemas/fabric/pbip/pbipProperties/1.0.0/schema.json',
            version: '1.0',
            artifacts: [{ report: { path: `${NOMBRE_PROYECTO}.Report` } }],
            settings: { enableAutoRecovery: true }
        }, null, 2),
        '.gitignore': '**/.pbi/localSettings.json\n**/.pbi/cache.abf\n',
        'LEEME.txt': [
            'OMA Digital - Proyecto de Power BI',
            '',
            `1. Extrae todo el contenido de este archivo .zip en una carpeta.`,
            `2. Abre "${NOMBRE_PROYECTO}.pbip" con Power BI Desktop.`,
            '3. Página "Valoraciones por nivel": gráfica de pastel con filtros de Área y Línea.',
            '4. Página "Dónde mejorar": niveles por área y por línea (de más Naranja a menos).',
            '',
            'Los datos vienen incluidos en el proyecto. Para datos más recientes,',
            'vuelve a exportar desde OMA Digital (Resultados > Power BI).',
            ''
        ].join('\r\n'),
        ...archivosModelo(datosBase64, filasDax),
        ...archivosInforme(descripcion)
    };
}
