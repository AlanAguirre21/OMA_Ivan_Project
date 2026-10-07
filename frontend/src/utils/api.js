// Misma dirección que la app (el backend sirve ambas).
// Se puede sobrescribir con VITE_API_URL en frontend/.env
export const API_ROOT =
    import.meta.env?.VITE_API_URL ||
    '/api';

// Rutas cuyo 401 no significa "se cerró la sesión"
const SIN_AVISO_SESION = ['/auth/login', '/auth/me', '/auth/sesion'];


// =========================================================
// ERROR DE API
// =========================================================
//
// Todos los errores de red o del servidor se convierten
// en un ApiError con un mensaje listo para mostrarse
// al usuario y el código HTTP (0 = sin conexión).
// =========================================================

export class ApiError extends Error {
    constructor(mensaje, status = 0, datos = null) {
        super(mensaje);

        this.name = 'ApiError';
        this.status = status;
        this.datos = datos;
    }
}


// Mensajes para el usuario: claros y sin términos técnicos
const MENSAJES_POR_STATUS = {
    400: 'Revisa la información e inténtalo de nuevo.',
    401: 'Tu sesión terminó. Inicia sesión nuevamente.',
    403: 'No tienes permiso para realizar esta acción.',
    404: 'No encontramos la información solicitada.',
    408: 'La solicitud tardó demasiado. Inténtalo de nuevo.',
    429: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
    500: 'No pudimos completar la operación. Inténtalo de nuevo en unos momentos.',
    502: 'OMA Digital no está disponible en este momento. Inténtalo de nuevo en unos minutos.',
    503: 'OMA Digital no está disponible en este momento. Inténtalo de nuevo en unos minutos.',
    504: 'OMA Digital tardó demasiado en responder. Inténtalo de nuevo en unos minutos.'
};

export const MENSAJE_SIN_CONEXION =
    'No pudimos conectar con OMA Digital. Revisa tu conexión e inténtalo de nuevo. Si el problema continúa, contacta al administrador.';


export function obtenerMensajeError(
    error,
    mensajePorDefecto = 'Algo salió mal. Inténtalo de nuevo.'
) {
    if (!error) {
        return mensajePorDefecto;
    }

    if (typeof error === 'string') {
        return error;
    }

    return error.message || mensajePorDefecto;
}


async function leerJSON(response) {
    const texto = await response.text();

    if (!texto) {
        return null;
    }

    try {
        return JSON.parse(texto);
    } catch {
        return null;
    }
}


// =========================================================
// FETCH BASE
// =========================================================
//
// Devuelve el Response tal cual (para quien necesite
// revisar el status manualmente). Solo lanza ApiError
// cuando no hay conexión con el servidor.
//
// La sesión viaja en una cookie httpOnly que el navegador
// envía solo; el código de la página nunca ve el token.
// =========================================================

export async function apiFetch(
    endpoint,
    options = {}
) {
    const headers = new Headers(
        options.headers || {}
    );

    if (
        options.body &&
        !headers.has('Content-Type')
    ) {
        headers.set(
            'Content-Type',
            'application/json'
        );
    }

    // Encabezado propio: el servidor rechaza peticiones que
    // modifican datos sin él (protección CSRF)
    headers.set('X-Requested-With', 'OMA-Digital');

    let response;

    try {
        response = await fetch(
            `${API_ROOT}${endpoint}`,
            {
                ...options,
                headers,
                credentials: 'include'
            }
        );
    } catch (error) {
        console.error(
            `Sin conexión con ${API_ROOT}${endpoint}:`,
            error
        );

        throw new ApiError(MENSAJE_SIN_CONEXION, 0);
    }

    if (
        response.status === 401 &&
        !SIN_AVISO_SESION.some((ruta) => endpoint.startsWith(ruta))
    ) {
        const datos = await leerJSON(
            response.clone()
        );

        window.dispatchEvent(
            new CustomEvent(
                'oma:sesion-expirada',
                {
                    detail: {
                        mensaje:
                            datos?.mensaje ||
                            MENSAJES_POR_STATUS[401]
                    }
                }
            )
        );
    }

    if (response.status === 403) {
        const datos = await leerJSON(response.clone());

        if (datos?.codigo === 'CAMBIO_PASSWORD_REQUERIDO') {
            window.dispatchEvent(new Event('oma:cambio-password'));
        }
    }

    return response;
}


// =========================================================
// FETCH + JSON
// =========================================================
//
// Devuelve directamente los datos. Si la respuesta no es
// exitosa lanza un ApiError con el mensaje del servidor
// (o uno genérico según el código HTTP).
// =========================================================

export async function apiJson(
    endpoint,
    options = {},
    mensajePorDefecto
) {
    const response = await apiFetch(
        endpoint,
        options
    );

    const datos = await leerJSON(response);

    if (!response.ok) {
        throw new ApiError(
            datos?.mensaje ||
                mensajePorDefecto ||
                MENSAJES_POR_STATUS[response.status] ||
                (response.status >= 500
                    ? MENSAJES_POR_STATUS[500]
                    : 'Algo salió mal. Inténtalo de nuevo.'),
            response.status,
            datos
        );
    }

    return datos;
}
