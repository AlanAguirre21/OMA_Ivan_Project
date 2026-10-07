/*
 * =========================================================
 * BORRADOR LOCAL DE LA EVALUACIÓN
 *
 * El avance de la matriz se guarda en este navegador,
 * separado por usuario, hasta que la evaluación se envía.
 * =========================================================
 */

const STORAGE_KEY_BASE =
    'oma_digital_borrador_evaluacion_v1';

const obtenerStorageKey = (usuarioId = 'local') =>
    `${STORAGE_KEY_BASE}_${encodeURIComponent(
        String(usuarioId || 'local').trim().toLowerCase()
    )}`;


// true si existe al menos un valor capturado
export function tieneDatosBorrador(datos) {
    if (datos === null || datos === undefined) {
        return false;
    }

    if (typeof datos !== 'object') {
        return true;
    }

    return Object.values(datos).some(tieneDatosBorrador);
}


export function guardarBorrador(evaluaciones, usuarioId = 'local') {
    const borrador = {
        version: 2,
        fechaGuardado: new Date().toISOString(),
        evaluaciones
    };

    try {
        localStorage.setItem(
            obtenerStorageKey(usuarioId),
            JSON.stringify(borrador)
        );

        return borrador;
    } catch (error) {
        console.error('No fue posible guardar el borrador:', error);

        return null;
    }
}


export function cargarBorrador(usuarioId = 'local') {
    try {
        const contenido = localStorage.getItem(
            obtenerStorageKey(usuarioId)
        );

        if (!contenido) {
            return null;
        }

        const borrador = JSON.parse(contenido);

        if (
            !borrador ||
            typeof borrador.evaluaciones !== 'object' ||
            borrador.evaluaciones === null
        ) {
            return null;
        }

        return borrador;
    } catch (error) {
        console.error('No fue posible cargar el borrador:', error);

        return null;
    }
}


export function eliminarBorrador(usuarioId = 'local') {
    try {
        localStorage.removeItem(obtenerStorageKey(usuarioId));
    } catch (error) {
        console.error('No fue posible eliminar el borrador:', error);
    }
}


export function obtenerFechaBorrador(borrador) {
    return borrador?.fechaGuardado || null;
}
