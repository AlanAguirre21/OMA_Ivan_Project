import { createContext, useContext } from 'react';

/*
 * Ventanas de confirmación y aviso propias de la app
 * (reemplazan a window.confirm y alert del navegador).
 *
 *   const { confirmar, avisar } = useDialogo();
 *   if (await confirmar({ titulo, mensaje, textoConfirmar, peligro })) { ... }
 *   await avisar({ titulo, mensaje, tipo: 'error' });
 */
export const DialogoContexto = createContext(null);

export function useDialogo() {
    const contexto = useContext(DialogoContexto);

    if (!contexto) {
        throw new Error('useDialogo debe usarse dentro de ProveedorDialogos.');
    }

    return contexto;
}
