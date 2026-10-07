const areas = {
    CTT1: ['B1', 'B2'],

    CTT2: ['A8', 'A3'],

    CTA: ['A11', 'A12'],

    'PW&PR': ['W7.2', 'W8.8', 'ATTO 1'],

    'P&FA': ['MOD A8', 'EMB L1', 'P.ELEC']
};

const criterios = [
    {
        numero: '1.01',
        nombre: "Administración de las 5S's",
        queEvaluar: `La linea demuestra que se viven las 5S's?
El supervisor debe exponer como se viven las 5 s y como ha mejorado su linea en comparacion de año pasado y debe mostrar en tiempo real el resultado de 5 s de manera digital
El operador debe explicar y dar ejemplos como las 5 S's han mejorado su operacion.`
    },
    {
        numero: '1.02',
        nombre: "Mantenimiento AUTÓNOMO",
        queEvaluar: `Se aplica TPM en la linea, se registran acciones derivadas del TPM, se le da seguimiento al cierre de las acciones.`
    },
    {
        numero: '1.03',
        nombre: "Trabajo ESTANDARIZADO",
        queEvaluar: `El personal operativo esta certificado en la matriz de competencias, la maquina cuenta con el estandar de trabajo, el operador ha sido considerado en el desarrollo del trabajo estandarizado, la maquina cuello de botella esta identicada y el supervisor puede explicar como se asegura que la estacion critica siga el trabajo estandarizado`
    },
    {
        numero: '2.01',
        nombre: "Cultura de la CALIDAD, No pasar DEFECTOS",
        queEvaluar: `El operador debe mostrar como es el manejo de material no conforme, El operador debe contar con el entrenamiento de manejo de material no conforme, debe conocer el nivel de alarma, el procedimiento de escalacion e identificar la calibracion en sus dispositivos. 
Tambien debe demostrar que conoce su listado de pokayokes`
    },
    {
        numero: '2.02',
        nombre: "Crecimiento cultural y Mejora Continua",
        queEvaluar: `Seguimiento a programa levanta la mano, el supervisor debe conocer el avance de las manitas levantadas y darlo a conocer a su personal, adicional como una manita levantada a mejorado alguna condicion de su linea, el personal operativo debe conocer sobre el programa y que reconocimientos se otorgan por participar en ese programa.`
    },
    {
        numero: '2.03',
        nombre: "DESARROLLO de Multihabilidades",
        queEvaluar: `El personal operativo esta certificado en las operaciones donde trabaja, existe un plan de certificacion para el personal operativo, los entrenamientos incluyen el ADN de calidad, mostrar evidencia en la matriz de habilidades y explicar el proceso de certificacion.`
    },
    {
        numero: '2.04',
        nombre: "Reconocimiento",
        queEvaluar: `El gerente del area debe exponer como se viven los programas de reconocimiento en sus areas `
    },
    {
        numero: '2.05',
        nombre: "Administración Visual y COMUNICACIÓN",
        queEvaluar: `Verificar que el estandar de visual management en piso ayude al supervisor y personal operativo a identificar rapidamente una anomalia en el proceso. Ejemplo tableros hora por hora, tablero de SFM, alertas de calidad y desviaciones posteadas.`
    },
    {
        numero: '2.07',
        nombre: "Traceability",
        queEvaluar: `El supervisor puede demostrar la trazabilidad a nivel de lote y logistica debe demostrar que se mantiene el FIFO`
    },
    {
        numero: '2.14',
        nombre: "SOLUCIÓN de Problemas",
        queEvaluar: ""
    },
    {
        numero: '3.03',
        nombre: "Producción ESTABLE",
        queEvaluar: `Mostrar la adherencia al plan de produccion, procedimiento de escalacion en caso de detectar riesgo para alcaza la meta del turno y el seguimiento al plan de accion de 24 horas.`
    },
    {
        numero: '3.04',
        nombre: "Producción FLEXIBLE",
        queEvaluar: `Mostrar la cantidad de cambios de codigos programados y ejecutados durante la ultima semana y el tiempo de cada cambio debe estar alineado al tiempo estipulado.`
    },
    {
        numero: '4.03',
        nombre: "Comportamiento Basado en la SEGURIDAD",
        queEvaluar: `Mostrar el resultado de BBS de la linea, que el personal operativo conozca el indicador y preguntar si existe algun reconocimiento a los auditores de BBS `
    },
    {
        numero: '7.01',
        nombre: "Organización y Enfoque a RESULTADOS",
        queEvaluar: `Los gerentes participan en Work shops y co dirigen en alguno de ellos`
    }
      
];

module.exports = {
    areas,
    criterios
};