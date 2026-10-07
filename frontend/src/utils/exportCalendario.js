import ExcelJS from 'exceljs';

import { descargar } from './descargar';
import { DIAS_SEMANA, MESES, deTexto, diasDeCuadricula, estadoProgramacion, hoyTexto } from './calendario';

/*
 * =========================================================
 * EXPORTAR CALENDARIO A EXCEL
 *
 * Hoja "Calendario": el mes en cuadrícula (lunes a domingo)
 *   con las líneas de cada día, coloreadas por estado.
 * Hoja "Programación": una fila por línea programada
 *   (fecha, día, línea, área, nota, estado) con filtros.
 * =========================================================
 */

const AZUL = 'FF002060';
const BORDE = { style: 'thin', color: { argb: 'FFD1D1D6' } };
const BORDES = { top: BORDE, left: BORDE, bottom: BORDE, right: BORDE };

// Mismos tonos que el calendario de la app
const COLOR_ESTADO = {
    pendiente: 'FFE8F1FD',
    parcial: 'FFFFF4CC',
    realizada: 'FFE3F4D7',
    vencida: 'FFFDE4E4'
};

const encabezado = (celda, valor) => {
    celda.value = valor;
    celda.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } };
    celda.alignment = { horizontal: 'center', vertical: 'middle' };
    celda.border = BORDES;
};


export async function exportarCalendarioExcel({ anio, mes, programaciones }) {
    const hoy = hoyTexto();
    const titulo = `${MESES[mes]} ${anio}`;
    const prefijo = `${anio}-${String(mes + 1).padStart(2, '0')}`;

    const libro = new ExcelJS.Workbook();
    libro.creator = 'OMA Digital';
    libro.created = new Date();

    // ---------------------------------------------- Hoja 1: cuadrícula
    const hoja = libro.addWorksheet('Calendario', {
        pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 1 }
    });

    hoja.columns = DIAS_SEMANA.map(() => ({ width: 24 }));
    hoja.mergeCells(1, 1, 1, 7);
    hoja.getCell(1, 1).value = `Calendario de evaluaciones OMA · ${titulo}`;
    hoja.getCell(1, 1).font = { bold: true, size: 15, color: { argb: AZUL } };
    hoja.getRow(1).height = 26;

    hoja.mergeCells(2, 1, 2, 7);
    hoja.getCell(2, 1).value = 'Azul: pendiente · Amarillo: parcial / en curso · Verde: realizada · Rojo: vencida';
    hoja.getCell(2, 1).font = { size: 10, color: { argb: 'FF515154' } };

    DIAS_SEMANA.forEach((dia, indice) => encabezado(hoja.getCell(3, indice + 1), dia));

    const porDia = new Map();
    programaciones.forEach((item) => {
        if (!porDia.has(item.fecha)) porDia.set(item.fecha, []);
        porDia.get(item.fecha).push(item);
    });

    const dias = diasDeCuadricula(anio, mes);

    for (let semana = 0; semana < dias.length / 7; semana++) {
        const fila = hoja.getRow(4 + semana);
        let maxLineas = 1;

        for (let d = 0; d < 7; d++) {
            const dia = dias[semana * 7 + d];
            const celda = fila.getCell(d + 1);
            const delDia = dia.startsWith(prefijo) ? porDia.get(dia) || [] : [];

            const textos = delDia.map((item) => {
                const estado = estadoProgramacion(item, hoy);
                return `• ${item.lineas.map((l) => l.nodo).join(', ')} (${estado.texto})${item.nota ? ` — ${item.nota}` : ''}`;
            });

            maxLineas = Math.max(maxLineas, textos.length + 1);

            celda.value = dia.startsWith(prefijo)
                ? { richText: [{ text: `${deTexto(dia).getDate()}\n`, font: { bold: true, size: 12 } }, { text: textos.join('\n'), font: { size: 10 } }] }
                : '';

            celda.alignment = { vertical: 'top', wrapText: true };
            celda.border = BORDES;

            if (!dia.startsWith(prefijo)) {
                celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F7' } };
            } else if (delDia.length) {
                // Color del estado más urgente del día
                const claves = delDia.map((item) => estadoProgramacion(item, hoy).clave);
                const clave = ['vencida', 'parcial', 'pendiente', 'realizada'].find((c) => claves.includes(c));
                celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_ESTADO[clave] } };
            }
        }

        fila.height = Math.max(60, maxLineas * 15 + 10);
    }

    // ---------------------------------------------- Hoja 2: lista
    const lista = libro.addWorksheet('Programación', { views: [{ state: 'frozen', ySplit: 1 }] });

    lista.columns = [
        { header: 'Fecha', key: 'fecha', width: 12 },
        { header: 'Día', key: 'dia', width: 12 },
        { header: 'Línea', key: 'linea', width: 16 },
        { header: 'Área', key: 'area', width: 12 },
        { header: 'Evaluada ese día', key: 'evaluada', width: 16 },
        { header: 'Estado', key: 'estado', width: 18 },
        { header: 'Nota', key: 'nota', width: 44 }
    ];
    lista.getRow(1).eachCell((celda) => encabezado(celda, celda.value));

    [...programaciones]
        .sort((a, b) => a.fecha.localeCompare(b.fecha))
        .forEach((item) => {
            const estado = estadoProgramacion(item, hoy);

            item.lineas.forEach((linea) => {
                const fila = lista.addRow({
                    fecha: deTexto(item.fecha),
                    dia: DIAS_SEMANA[(deTexto(item.fecha).getDay() + 6) % 7],
                    linea: linea.nodo,
                    area: linea.area,
                    evaluada: linea.realizada ? 'Sí' : 'No',
                    estado: estado.texto,
                    nota: item.nota || ''
                });

                fila.getCell('fecha').numFmt = 'dd/mm/yyyy';
                fila.eachCell((celda) => {
                    celda.border = BORDES;
                    celda.alignment = { vertical: 'middle', wrapText: true };
                });
                fila.getCell('estado').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_ESTADO[estado.clave] } };
            });
        });

    if (lista.rowCount > 1) {
        lista.autoFilter = { from: 'A1', to: `G${lista.rowCount}` };
    } else {
        lista.addRow({ fecha: '', linea: 'Sin evaluaciones programadas este mes' });
    }

    const buffer = await libro.xlsx.writeBuffer();

    descargar(
        new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        `OMA_Calendario_${prefijo}.xlsx`
    );
}
