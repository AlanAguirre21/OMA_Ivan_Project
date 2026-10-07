/*
 * Utilidades de fechas del calendario (sin zonas horarias:
 * las fechas son textos "AAAA-MM-DD" en hora local).
 */

export const MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

const dos = (numero) => String(numero).padStart(2, '0');

export const aTexto = (fecha) =>
    `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;

export const deTexto = (texto) => {
    const [anio, mes, dia] = texto.split('-').map(Number);
    return new Date(anio, mes - 1, dia);
};

export const hoyTexto = () => aTexto(new Date());

// Días que muestra la cuadrícula del mes (semanas completas, lunes a domingo)
export function diasDeCuadricula(anio, mes) {
    const primero = new Date(anio, mes, 1);
    const inicio = new Date(primero);
    inicio.setDate(1 - ((primero.getDay() + 6) % 7));

    const ultimo = new Date(anio, mes + 1, 0);
    const fin = new Date(ultimo);
    fin.setDate(ultimo.getDate() + (6 - ((ultimo.getDay() + 6) % 7)));

    const dias = [];
    for (const dia = new Date(inicio); dia <= fin; dia.setDate(dia.getDate() + 1)) {
        dias.push(aTexto(dia));
    }

    return dias;
}

export function nombreDia(texto) {
    return DIAS_SEMANA[(deTexto(texto).getDay() + 6) % 7];
}

export function fechaLarga(texto) {
    const fecha = deTexto(texto);
    return `${nombreDia(texto)} ${fecha.getDate()} de ${MESES[fecha.getMonth()].toLowerCase()} de ${fecha.getFullYear()}`;
}

/*
 * Estado de una programación:
 * realizada (todas las líneas evaluadas ese día), parcial,
 * pendiente (hoy o futura) o vencida (pasó sin evaluarse).
 */
export function estadoProgramacion(programacion, hoy = hoyTexto()) {
    const total = programacion.lineas.length;
    const hechas = programacion.lineas.filter((linea) => linea.realizada).length;

    if (total > 0 && hechas === total) return { clave: 'realizada', texto: 'Realizada' };
    if (programacion.fecha < hoy) return hechas > 0 ? { clave: 'parcial', texto: `Parcial (${hechas}/${total})` } : { clave: 'vencida', texto: 'Vencida' };
    if (hechas > 0) return { clave: 'parcial', texto: `En curso (${hechas}/${total})` };

    return { clave: 'pendiente', texto: programacion.fecha === hoy ? 'Hoy' : 'Pendiente' };
}

export const ESTADOS = [
    { clave: 'pendiente', texto: 'Pendiente' },
    { clave: 'parcial', texto: 'Parcial / en curso' },
    { clave: 'realizada', texto: 'Realizada' },
    { clave: 'vencida', texto: 'Vencida' }
];
