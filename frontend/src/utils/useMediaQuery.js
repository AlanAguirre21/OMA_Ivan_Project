import { useEffect, useState } from 'react';

// true mientras la media query se cumpla (se actualiza al redimensionar)
export function useMediaQuery(query) {
    const obtener = () =>
        typeof window !== 'undefined' && typeof window.matchMedia === 'function'
            ? window.matchMedia(query).matches
            : false;

    const [coincide, setCoincide] = useState(obtener);

    useEffect(() => {
        if (typeof window.matchMedia !== 'function') return undefined;

        const lista = window.matchMedia(query);
        const actualizar = () => setCoincide(lista.matches);

        actualizar();
        lista.addEventListener('change', actualizar);

        return () => lista.removeEventListener('change', actualizar);
    }, [query]);

    return coincide;
}

export const CONSULTA_MOVIL = '(max-width: 860px)';
