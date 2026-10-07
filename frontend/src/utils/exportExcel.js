import ExcelJS from 'exceljs';

import { apiJson } from './api';
import { descargar } from './descargar';
import {
    COLORES_NIVEL,
    calcularResultados,
    areasDeEvaluacion,
    construirMatriz,
    evaluadorDe,
    formatearFecha,
    normalizarAreas
} from './oma';

/*
 * =========================================================
 * EXPORTAR A EXCEL
 *
 * Genera la hoja "OMA EN PISO" con el mismo formato que
 * el Excel original: encabezados de área combinados,
 * colores por nivel y fila final de promedios (fórmulas).
 * =========================================================
 */

const AZUL = 'FF002060';
const BLANCO = 'FFFFFFFF';
const TEXTO = 'FF1F2937';
const GRIS = 'FFE5E7EB';

const argb = (hex) => `FF${hex.replace('#', '').toUpperCase()}`;

const relleno = (color) => ({
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: color }
});

const bordes = {
    top: { style: 'thin', color: { argb: 'FFBFBFBF' } },
    left: { style: 'thin', color: { argb: 'FFBFBFBF' } },
    bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
    right: { style: 'thin', color: { argb: 'FFBFBFBF' } }
};


function colorExcel(valor) {
    if (valor === null || valor === undefined) return GRIS;

    const numero = Number(valor);

    if (numero < 2) return argb(COLORES_NIVEL[1]);
    if (numero < 3) return argb(COLORES_NIVEL[2]);

    return argb(COLORES_NIVEL[3]);
}


function encabezado(celda, valor) {
    celda.value = valor;
    celda.font = { bold: true, color: { argb: BLANCO } };
    celda.fill = relleno(AZUL);
    celda.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    celda.border = bordes;
}


function celdaNivel(celda, valor, formato) {
    celda.value = valor ?? null;
    celda.fill = relleno(colorExcel(valor));
    celda.font = { bold: true, color: { argb: TEXTO } };
    celda.alignment = { horizontal: 'center', vertical: 'middle' };
    celda.border = bordes;

    if (formato) celda.numFmt = formato;
}


async function obtenerConfiguracion(criteriosConfig, areas) {
    if (criteriosConfig?.length && areas?.length) {
        return { criteriosConfig, areas };
    }

    const datos = await apiJson(
        '/evaluaciones/config',
        {},
        'No fue posible obtener la configuración de los criterios.'
    );

    return {
        criteriosConfig: Array.isArray(datos?.criterios) ? datos.criterios : [],
        areas: normalizarAreas(datos?.areas)
    };
}


export async function exportarEvaluacionExcel({
    evaluacion,
    criteriosConfig = [],
    areas = []
}) {
    if (!evaluacion) {
        throw new Error('No hay una evaluación seleccionada.');
    }

    const config = await obtenerConfiguracion(criteriosConfig, areas);
    // Solo las líneas (nodos) que se evaluaron
    const areasEval = areasDeEvaluacion(evaluacion, config.areas);
    const { criterios, filas } = construirMatriz(evaluacion, config.criteriosConfig, areasEval);
    const listaFilas = criterios.map((criterio) => filas[criterio.numero]);
    const resultados = calcularResultados(listaFilas, areasEval);

    const nodos = areasEval.flatMap((area) =>
        area.nodos.map((nodo) => ({ area: area.nombre, nodo }))
    );

    // Columnas: A Planta | B Objetivo | C Criterio | D ¿Qué evaluar? | nodos... | Promedio
    const PRIMER_NODO = 5;
    const ULTIMO_NODO = PRIMER_NODO + nodos.length - 1;
    const COL_PROMEDIO = ULTIMO_NODO + 1;
    const FILA_AREAS = 2;
    const FILA_ENCABEZADOS = 3;
    const PRIMERA_FILA = 4;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'OMA Digital';
    workbook.created = new Date();

    const hoja = workbook.addWorksheet('OMA EN PISO', {
        views: [{ state: 'frozen', xSplit: 4, ySplit: FILA_ENCABEZADOS }],
        pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
    });

    hoja.getColumn(1).width = 9;
    hoja.getColumn(2).width = 10;
    hoja.getColumn(3).width = 38;
    hoja.getColumn(4).width = 60;

    for (let columna = PRIMER_NODO; columna <= ULTIMO_NODO; columna++) {
        hoja.getColumn(columna).width = 9;
    }

    hoja.getColumn(COL_PROMEDIO).width = 11;

    // Fila 1: título
    const titulo = hoja.getCell(1, 1);
    titulo.value =
        `Shop Floor OMA — ${formatearFecha(evaluacion.fecha, 'long')}` +
        (evaluadorDe(evaluacion).correo ? ` — Evaluador: ${evaluadorDe(evaluacion).nombre}` : '') +
        (evaluacion.area ? ` — Área: ${evaluacion.area}` : '');
    titulo.font = { bold: true, size: 14, color: { argb: AZUL } };
    hoja.mergeCells(1, 1, 1, COL_PROMEDIO);
    hoja.getRow(1).height = 24;

    // Fila 2: áreas combinadas sobre sus nodos
    let columna = PRIMER_NODO;

    areasEval.forEach((area) => {
        const fin = columna + area.nodos.length - 1;

        encabezado(hoja.getCell(FILA_AREAS, columna), area.nombre);

        if (fin > columna) {
            hoja.mergeCells(FILA_AREAS, columna, FILA_AREAS, fin);
        }

        columna = fin + 1;
    });

    // Fila 3: encabezados de columna
    ['Planta', 'Objetivo', 'Criterio', '¿Qué evaluar?'].forEach((texto, indice) => {
        encabezado(hoja.getCell(FILA_ENCABEZADOS, indice + 1), texto);
    });

    nodos.forEach(({ nodo }, indice) => {
        encabezado(hoja.getCell(FILA_ENCABEZADOS, PRIMER_NODO + indice), nodo);
    });

    encabezado(hoja.getCell(FILA_ENCABEZADOS, COL_PROMEDIO), 'Promedio');
    hoja.getRow(FILA_ENCABEZADOS).height = 22;

    // Filas de criterios
    criterios.forEach((criterio, indice) => {
        const numeroFila = PRIMERA_FILA + indice;
        const fila = filas[criterio.numero];
        const row = hoja.getRow(numeroFila);

        celdaNivel(row.getCell(1), fila.planta);
        celdaNivel(row.getCell(2), fila.objetivo);

        const celdaCriterio = row.getCell(3);
        celdaCriterio.value = `${criterio.numero} ${criterio.nombre}`;
        celdaCriterio.font = { bold: true };
        celdaCriterio.alignment = { vertical: 'middle', wrapText: true };
        celdaCriterio.border = bordes;

        const celdaQueEvaluar = row.getCell(4);
        celdaQueEvaluar.value = String(criterio.queEvaluar || '').trim();
        celdaQueEvaluar.alignment = { vertical: 'top', wrapText: true };
        celdaQueEvaluar.border = bordes;

        nodos.forEach(({ area, nodo }, indiceNodo) => {
            celdaNivel(row.getCell(PRIMER_NODO + indiceNodo), fila.valores?.[area]?.[nodo]);
        });

        const inicio = hoja.getCell(numeroFila, PRIMER_NODO).address;
        const fin = hoja.getCell(numeroFila, ULTIMO_NODO).address;
        const promedio = resultados.promedioFila[criterio.numero];

        celdaNivel(
            row.getCell(COL_PROMEDIO),
            { formula: `AVERAGE(${inicio}:${fin})`, result: promedio ?? undefined },
            '0.00'
        );
        row.getCell(COL_PROMEDIO).fill = relleno(colorExcel(promedio));

        row.height = Math.max(30, Math.ceil(celdaQueEvaluar.value.length / 75) * 15);
    });

    // Fila final de promedios
    const ultimaFila = PRIMERA_FILA + criterios.length - 1;
    const filaPromedios = hoja.getRow(ultimaFila + 1);

    const promedioColumna = (numeroColumna, resultado) => {
        const letra = hoja.getColumn(numeroColumna).letter;

        celdaNivel(
            filaPromedios.getCell(numeroColumna),
            { formula: `AVERAGE(${letra}${PRIMERA_FILA}:${letra}${ultimaFila})`, result: resultado ?? undefined },
            '0.00'
        );
        filaPromedios.getCell(numeroColumna).fill = relleno(colorExcel(resultado));
    };

    promedioColumna(1, resultados.promedioPlanta);
    promedioColumna(2, resultados.promedioObjetivo);

    const etiqueta = filaPromedios.getCell(3);
    etiqueta.value = 'Promedio';
    etiqueta.font = { bold: true };
    etiqueta.alignment = { horizontal: 'right' };
    etiqueta.border = bordes;

    nodos.forEach(({ area, nodo }, indice) => {
        promedioColumna(PRIMER_NODO + indice, resultados.promedioNodo[area]?.[nodo]);
    });

    promedioColumna(COL_PROMEDIO, resultados.promedioGeneral);

    hoja.headerFooter.oddFooter = 'OMA Digital — ZF';

    // Respuestas del evaluado (si se capturaron)
    const respuestas = Array.isArray(evaluacion.respuestas) ? evaluacion.respuestas : [];

    if (respuestas.length > 0) {
        const hojaRespuestas = workbook.addWorksheet('Respuestas');
        hojaRespuestas.columns = [
            { header: 'Criterio', key: 'numero', width: 10 },
            { header: 'Nombre', key: 'nombre', width: 38 },
            { header: 'Respuestas del evaluado', key: 'opciones', width: 60 },
            { header: 'Comentario', key: 'comentario', width: 60 }
        ];
        hojaRespuestas.getRow(1).eachCell((celda) => encabezado(celda, celda.value));

        respuestas.forEach((item) => {
            const fila = hojaRespuestas.addRow({
                numero: item.numero,
                nombre: item.nombre || '',
                opciones: (item.opciones || []).join('\n'),
                comentario: item.comentario || ''
            });
            fila.alignment = { vertical: 'top', wrapText: true };
        });
    }

    // Descargar
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const fecha = evaluacion.fecha
        ? new Date(evaluacion.fecha).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);

    descargar(blob, `OMA_EN_PISO_${fecha}.xlsx`);
}

