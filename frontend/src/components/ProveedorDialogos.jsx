import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { DialogoContexto } from './dialogos';

const ICONOS = {
    confirmar: '❔',
    peligro: '⚠️',
    error: '⚠️',
    exito: '✅',
    info: 'ℹ️'
};

function ProveedorDialogos({ children }) {
    const [dialogo, setDialogo] = useState(null);
    const botonPrincipal = useRef(null);

    const abrir = useCallback(
        (opciones) =>
            new Promise((resolver) => {
                setDialogo({ ...opciones, resolver });
            }),
        []
    );

    const cerrar = useCallback((respuesta) => {
        setDialogo((actual) => {
            actual?.resolver(respuesta);
            return null;
        });
    }, []);

    const valor = useMemo(
        () => ({
            confirmar: (opciones) => abrir({ ...opciones, modo: 'confirmar' }),
            avisar: (opciones) => abrir({ ...opciones, modo: 'avisar' })
        }),
        [abrir]
    );

    // Foco en el botón principal y Esc para cancelar
    useEffect(() => {
        if (!dialogo) return undefined;

        botonPrincipal.current?.focus();

        const alPresionar = (evento) => {
            if (evento.key === 'Escape') cerrar(false);
        };

        document.addEventListener('keydown', alPresionar);

        return () => document.removeEventListener('keydown', alPresionar);
    }, [dialogo, cerrar]);

    const tipo = dialogo?.peligro ? 'peligro' : dialogo?.tipo || (dialogo?.modo === 'confirmar' ? 'confirmar' : 'info');

    return (
        <DialogoContexto.Provider value={valor}>
            {children}

            {dialogo && createPortal(
                <div
                    className="modal-overlay hoja-movil"
                    onMouseDown={(evento) => {
                        if (evento.target === evento.currentTarget) cerrar(false);
                    }}
                >
                    <div
                        className="glass-strong validation-modal"
                        role={dialogo.modo === 'confirmar' ? 'alertdialog' : 'dialog'}
                        aria-modal="true"
                        aria-labelledby="dialogo-titulo"
                        aria-describedby="dialogo-mensaje"
                    >
                        <div className="validation-header">
                            <div className="validation-icon" aria-hidden="true">{ICONOS[tipo]}</div>
                            <div>
                                <h2 className="validation-title" id="dialogo-titulo">{dialogo.titulo}</h2>
                                {dialogo.mensaje && (
                                    <p className="validation-description dialogo-mensaje" id="dialogo-mensaje">
                                        {dialogo.mensaje}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="validation-actions">
                            {dialogo.modo === 'confirmar' && (
                                <button type="button" className="btn-secondary" onClick={() => cerrar(false)}>
                                    {dialogo.textoCancelar || 'Cancelar'}
                                </button>
                            )}
                            <button
                                ref={botonPrincipal}
                                type="button"
                                className={`btn-primary ${dialogo.peligro ? 'btn-peligro' : ''}`}
                                onClick={() => cerrar(true)}
                            >
                                {dialogo.textoConfirmar || (dialogo.modo === 'confirmar' ? 'Aceptar' : 'Entendido')}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </DialogoContexto.Provider>
    );
}

export default ProveedorDialogos;
