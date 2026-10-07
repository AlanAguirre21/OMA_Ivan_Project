import { IconoCalendario, IconoHistorial, IconoLineas, IconoMatriz, IconoRespuestas, IconoResultados, IconoUsuarios } from './Iconos';

// Secciones de la app: las usan la barra lateral (escritorio)
// y la barra de pestañas (móvil).
export const SECCIONES = [
    { id: 'evaluacion', nombre: 'Evaluación', nombreCorto: 'Evaluar', Icono: IconoMatriz },
    { id: 'historial', nombre: 'Historial', Icono: IconoHistorial },
    { id: 'resultados', nombre: 'Resultados', nombreCorto: 'Result.', Icono: IconoResultados },
    { id: 'calendario', nombre: 'Calendario', nombreCorto: 'Agenda', Icono: IconoCalendario },
    { id: 'usuarios', nombre: 'Usuarios', Icono: IconoUsuarios, soloAdmin: true },
    { id: 'lineas', nombre: 'Líneas', Icono: IconoLineas, soloAdmin: true },
    { id: 'respuestas', nombre: 'Respuestas', nombreCorto: 'Resp.', Icono: IconoRespuestas, soloAdmin: true }
];

// Secciones visibles para el rol del usuario
export const seccionesPara = (usuario) =>
    SECCIONES.filter((seccion) => !seccion.soloAdmin || usuario?.rol === 'admin');
