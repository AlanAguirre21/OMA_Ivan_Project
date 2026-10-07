// Íconos de línea estilo SF Symbols (heredan el color del texto)

const base = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true
};

export function IconoMatriz() {
    return (
        <svg {...base}>
            <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
            <path d="M3.5 9.5h17M3.5 14.5h17M9.5 3.5v17M14.5 3.5v17" />
        </svg>
    );
}

export function IconoHistorial() {
    return (
        <svg {...base}>
            <circle cx="12" cy="12" r="8.5" />
            <path d="M12 7.5V12l3 2" />
        </svg>
    );
}

export function IconoResultados() {
    return (
        <svg {...base}>
            <path d="M4 20h16" />
            <rect x="5.5" y="11" width="3" height="6.5" rx="1" />
            <rect x="10.5" y="6.5" width="3" height="11" rx="1" />
            <rect x="15.5" y="9" width="3" height="8.5" rx="1" />
        </svg>
    );
}

export function IconoSalir() {
    return (
        <svg {...base}>
            <path d="M14 4.5h3.5a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H14" />
            <path d="M10 8l-4 4 4 4M6 12h9" />
        </svg>
    );
}

export function IconoCorreo() {
    return (
        <svg {...base}>
            <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
            <path d="M4.5 7l7.5 6 7.5-6" />
        </svg>
    );
}

export function IconoBarraLateral() {
    return (
        <svg {...base}>
            <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
            <path d="M9.5 4.5v15M5.75 8h1.5M5.75 11h1.5" />
        </svg>
    );
}

export function IconoCerrar() {
    return (
        <svg {...base}>
            <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
        </svg>
    );
}

export function IconoCandado() {
    return (
        <svg {...base}>
            <rect x="5" y="10.5" width="14" height="9.5" rx="2.5" />
            <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
        </svg>
    );
}

export function IconoOjo({ tachado = false }) {
    return (
        <svg {...base}>
            <path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" />
            <circle cx="12" cy="12" r="3" />
            {tachado && <path d="M4 20L20 4" />}
        </svg>
    );
}

export function IconoLlave() {
    return (
        <svg {...base}>
            <circle cx="8" cy="15" r="4" />
            <path d="M11 12l8.5-8.5M16 7l2.5 2.5M14 9l2 2" />
        </svg>
    );
}

export function IconoUsuarios() {
    return (
        <svg {...base}>
            <circle cx="9" cy="8.5" r="3.5" />
            <path d="M2.5 19.5c.8-3.4 3.4-5 6.5-5s5.7 1.6 6.5 5" />
            <path d="M16 5.2a3.4 3.4 0 0 1 0 6.6M18 14.8c1.8.7 3 2.2 3.5 4.7" />
        </svg>
    );
}

export function IconoEscudo() {
    return (
        <svg {...base}>
            <path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.3-7.5 9.5-4.3-1.2-7.5-4.9-7.5-9.5V6L12 3z" />
            <path d="M9 12l2 2 4-4" />
        </svg>
    );
}


export function IconoLineas() {
    return (
        <svg {...base}>
            <circle cx="5.5" cy="6" r="2" />
            <circle cx="5.5" cy="12" r="2" />
            <circle cx="5.5" cy="18" r="2" />
            <path d="M10 6h9.5M10 12h9.5M10 18h9.5" />
        </svg>
    );
}


export function IconoCalendario() {
    return (
        <svg {...base}>
            <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
            <path d="M3.5 10h17M8 3v4M16 3v4M7.5 14h2M11 14h2M14.5 14h2M7.5 17h2M11 17h2" />
        </svg>
    );
}


export function IconoRespuestas() {
    return (
        <svg {...base}>
            <path d="M4 5.5h16v10H9l-5 4v-14Z" />
            <path d="M8 9.5h8M8 12.5h5" />
        </svg>
    );
}


export function IconoEquipos() {
    return (
        <svg {...base}>
            <rect x="2.5" y="4.5" width="14" height="10" rx="1.8" />
            <path d="M6.5 18.5h6M9.5 14.5v4" />
            <rect x="17" y="8.5" width="4.5" height="10" rx="1.2" />
        </svg>
    );
}
