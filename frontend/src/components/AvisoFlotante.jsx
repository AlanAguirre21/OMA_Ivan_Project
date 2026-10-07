import { createPortal } from 'react-dom';

/*
 * Aviso flotante (toast) estilo notificación de macOS / iOS.
 * Se monta en <body> para que su posición fija no dependa
 * del contenedor de la página: abajo a la derecha en
 * escritorio y sobre la barra de pestañas en móvil.
 */
function AvisoFlotante({ visible, icono = '✓', titulo, detalle }) {
    return createPortal(
        <div
            className={`aviso-flotante ${visible ? 'visible' : ''}`}
            role="status"
            aria-live="polite"
            aria-hidden={!visible}
        >
            <span className="aviso-flotante-icono" aria-hidden="true">{icono}</span>
            <span>
                <strong>{titulo}</strong>
                {detalle && <span className="aviso-flotante-detalle">{detalle}</span>}
            </span>
        </div>,
        document.body
    );
}

export default AvisoFlotante;
