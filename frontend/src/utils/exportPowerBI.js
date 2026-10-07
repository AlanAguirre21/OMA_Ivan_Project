import { apiJson } from './api';
import { descargar } from './descargar';
import { areasDeEvaluacion, construirMatriz, evaluadorDe, normalizarAreas } from './oma';
import { construirProyectoPowerBI, filasDesdeExportacion } from './powerbiProyecto';

/*
 * =========================================================
 * EXPORTAR A POWER BI
 *
 * Descarga un .zip con un proyecto de Power BI (.pbip) que
 * se abre con la gráfica de pastel "Valoraciones por nivel"
 * ya armada. Los datos van incluidos en el proyecto: una
 * fila por calificación (evaluación × criterio × línea).
 * =========================================================
 */

async function obtenerConfiguracion(criteriosConfig, areas) {
    if (criteriosConfig?.length && areas?.length) {
        return { criteriosConfig, areas };
    }

    const datos = await apiJson(
        '/evaluaciones/config',
        {},
        'No fue posible obtener la configuración de criterios.'
    );

    return {
        criteriosConfig: Array.isArray(datos?.criterios) ? datos.criterios : [],
        areas: normalizarAreas(datos?.areas)
    };
}


// Una entrada por calificación de línea (solo valores 1, 2 o 3)
export function construirRegistros(evaluaciones, config) {
    const registros = [];

    evaluaciones.forEach((evaluacion) => {
        // Las líneas con que se hizo la evaluación
        const areasEval = areasDeEvaluacion(evaluacion, config.areas);
        const { criterios, filas } = construirMatriz(evaluacion, config.criteriosConfig, areasEval);
        const evaluador = evaluadorDe(evaluacion);
        const fecha = evaluacion.fecha ? new Date(evaluacion.fecha).toISOString() : null;

        criterios.forEach((criterio) => {
            const fila = filas[criterio.numero];

            areasEval.forEach((area) => {
                area.nodos.forEach((nodo) => {
                    registros.push({
                        evaluacion: evaluacion._id,
                        fecha,
                        evaluador: evaluador.nombre,
                        correo: evaluador.correo,
                        areaEvaluador: evaluacion.area ?? '',
                        criterio: criterio.numero,
                        nombreCriterio: criterio.nombre,
                        area: area.nombre,
                        linea: nodo,
                        planta: fila.planta,
                        objetivo: fila.objetivo,
                        valor: fila.valores?.[area.nombre]?.[nodo]
                    });
                });
            });
        });
    });

    return registros;
}


// Deflate sin encabezado + base64 (lo que espera Binary.Decompress de Power Query)
async function comprimirNavegador(texto) {
    const flujo = new Blob([texto]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    const bytes = new Uint8Array(await new Response(flujo).arrayBuffer());

    let binario = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
        binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }

    return btoa(binario);
}


export async function exportarPowerBI({
    evaluaciones = [],
    criteriosConfig = [],
    areas = [],
    descripcion = ''
}) {
    if (!Array.isArray(evaluaciones) || evaluaciones.length === 0) {
        throw new Error('No hay evaluaciones para exportar.');
    }

    if (typeof CompressionStream === 'undefined') {
        throw new Error('Tu navegador no permite generar el archivo de Power BI. Usa una versión reciente de Edge o Chrome.');
    }

    const config = await obtenerConfiguracion(criteriosConfig, areas);
    const filas = filasDesdeExportacion(construirRegistros(evaluaciones, config));

    if (filas.length === 0) {
        throw new Error('Las evaluaciones seleccionadas no tienen valoraciones para graficar.');
    }

    const fecha = new Date().toISOString().slice(0, 10);

    const archivos = await construirProyectoPowerBI({
        filas,
        descripcion: descripcion ||
            `${evaluaciones.length} evaluación(es) · ${filas.length} valoraciones · exportado el ${new Date().toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' })}`,
        comprimir: comprimirNavegador
    });

    // JSZip se carga solo al exportar
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    const carpeta = zip.folder(`OMA_PowerBI_${fecha}`);

    Object.entries(archivos).forEach(([ruta, contenido]) => carpeta.file(ruta, contenido));

    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });

    descargar(blob, `OMA_Digital_PowerBI_${fecha}.zip`);
}
