/*
 * La sesión vive en una cookie httpOnly que administra el
 * servidor: nada de la sesión se guarda en el navegador.
 * Aquí solo se eliminan datos de versiones anteriores, que
 * guardaban el token en localStorage.
 */

const CLAVES_ANTIGUAS = [
    'oma_digital_token_v1',
    'oma_digital_usuario_v1'
];

export function limpiarSesionAntigua() {
    try {
        CLAVES_ANTIGUAS.forEach((clave) => localStorage.removeItem(clave));
    } catch {
        // Almacenamiento bloqueado: no hay nada que limpiar
    }
}
