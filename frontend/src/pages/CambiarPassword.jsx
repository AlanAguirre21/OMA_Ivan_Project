import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { IconoCandado, IconoOjo } from '../components/Iconos';
import { apiJson } from '../utils/api';

/*
 * =========================================================
 * CAMBIO DE CONTRASEÑA
 *
 * - obligatorio: pantalla completa tras el primer ingreso
 *   o un restablecimiento (no se puede usar la app antes).
 * - voluntario: ventana desde la barra superior.
 *
 * Los requisitos se validan en vivo y otra vez en el servidor.
 * =========================================================
 */

function requisitos(nueva, confirmacion, correo) {
    const usuarioCorreo = String(correo || '').split('@')[0].toLowerCase();

    return [
        { ok: nueva.length >= 10, texto: 'Al menos 10 caracteres' },
        { ok: /[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(nueva) && /\d/.test(nueva), texto: 'Letras y números' },
        {
            ok: nueva.length > 0 && !(usuarioCorreo.length >= 4 && nueva.toLowerCase().includes(usuarioCorreo)),
            texto: 'No contiene tu correo'
        },
        { ok: nueva.length > 0 && nueva === nueva.trim(), texto: 'Sin espacios al inicio o al final' },
        { ok: nueva.length > 0 && nueva === confirmacion, texto: 'La confirmación coincide' }
    ];
}


function CampoPassword({ id, etiqueta, valor, onCambiar, autoComplete, inputRef, disabled }) {
    const [ver, setVer] = useState(false);

    return (
        <div className="campo">
            <label className="campo-label" htmlFor={id}>{etiqueta}</label>

            <div className="campo-con-icono">
                <span className="campo-icono"><IconoCandado /></span>

                <input
                    ref={inputRef}
                    id={id}
                    className="campo-input con-accion"
                    type={ver ? 'text' : 'password'}
                    autoComplete={autoComplete}
                    maxLength={128}
                    value={valor}
                    disabled={disabled}
                    onChange={(evento) => onCambiar(evento.target.value)}
                />

                <button
                    type="button"
                    className="campo-accion"
                    onClick={() => setVer((actual) => !actual)}
                    aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    aria-pressed={ver}
                >
                    <IconoOjo tachado={ver} />
                </button>
            </div>
        </div>
    );
}


function CambiarPassword({ obligatorio = false, usuario, onListo, onCancelar }) {
    const [actual, setActual] = useState('');
    const [nueva, setNueva] = useState('');
    const [confirmacion, setConfirmacion] = useState('');
    const [error, setError] = useState('');
    const [guardando, setGuardando] = useState(false);

    const primerCampo = useRef(null);

    useEffect(() => {
        primerCampo.current?.focus();
    }, []);

    // Esc cierra la ventana (solo en modo voluntario)
    useEffect(() => {
        if (obligatorio) return undefined;

        const alPresionar = (evento) => {
            if (evento.key === 'Escape') onCancelar?.();
        };

        document.addEventListener('keydown', alPresionar);

        return () => document.removeEventListener('keydown', alPresionar);
    }, [obligatorio, onCancelar]);

    const lista = requisitos(nueva, confirmacion, usuario?.correo);
    const valido = actual.length > 0 && lista.every((requisito) => requisito.ok);

    const guardar = async (evento) => {
        evento.preventDefault();

        if (!valido) {
            setError('Revisa los requisitos de la nueva contraseña.');
            return;
        }

        try {
            setGuardando(true);
            setError('');

            const datos = await apiJson(
                '/auth/cambiar-password',
                { method: 'POST', body: JSON.stringify({ actual, nueva }) },
                'No fue posible cambiar la contraseña.'
            );

            onListo(datos.usuario);
        } catch (err) {
            setError(err.message);
        } finally {
            setGuardando(false);
        }
    };

    const contenido = (
        <form onSubmit={guardar} noValidate>
            <div className="validation-header" style={{ marginBottom: 18 }}>
                <div className="validation-icon" aria-hidden="true">🔐</div>
                <div>
                    <h2 className="validation-title" id="titulo-password">
                        {obligatorio ? 'Crea tu contraseña personal' : 'Cambiar contraseña'}
                    </h2>
                    <p className="validation-description">
                        {obligatorio
                            ? `Hola ${usuario?.nombre?.split(' ')[0] || ''}. Por seguridad, reemplaza la contraseña temporal que te dio el administrador.`
                            : 'Al cambiarla se cerrarán tus sesiones abiertas en otros equipos.'}
                    </p>
                </div>
            </div>

            {error && <div className="aviso aviso-error" role="alert">{error}</div>}

            <CampoPassword
                id="password-actual"
                etiqueta={obligatorio ? 'Contraseña temporal' : 'Contraseña actual'}
                valor={actual}
                onCambiar={(valor) => { setActual(valor); setError(''); }}
                autoComplete="current-password"
                inputRef={primerCampo}
                disabled={guardando}
            />

            <CampoPassword
                id="password-nueva"
                etiqueta="Nueva contraseña"
                valor={nueva}
                onCambiar={(valor) => { setNueva(valor); setError(''); }}
                autoComplete="new-password"
                disabled={guardando}
            />

            <CampoPassword
                id="password-confirmacion"
                etiqueta="Confirma la nueva contraseña"
                valor={confirmacion}
                onCambiar={(valor) => { setConfirmacion(valor); setError(''); }}
                autoComplete="new-password"
                disabled={guardando}
            />

            <ul className="requisitos" aria-label="Requisitos de la contraseña">
                {lista.map((requisito) => (
                    <li key={requisito.texto} className={requisito.ok ? 'ok' : ''}>
                        <span aria-hidden="true">{requisito.ok ? '✓' : '○'}</span>
                        {requisito.texto}
                        <span className="sr-only">{requisito.ok ? ' (cumplido)' : ' (pendiente)'}</span>
                    </li>
                ))}
            </ul>

            <div className="validation-actions">
                <button type="button" className="btn-secondary" onClick={onCancelar} disabled={guardando}>
                    {obligatorio ? 'Cerrar sesión' : 'Cancelar'}
                </button>
                <button type="submit" className="btn-primary" disabled={guardando || !valido}>
                    {guardando && <span className="boton-spinner" aria-hidden="true" />}
                    {guardando ? 'Guardando…' : 'Guardar contraseña'}
                </button>
            </div>
        </form>
    );

    if (obligatorio) {
        return (
            <div className="login-page">
                <main className="glass-strong login-card" style={{ width: 'min(440px, 100%)' }}>
                    {contenido}
                </main>
            </div>
        );
    }

    return createPortal(
        <div className="modal-overlay hoja-movil">
            <div
                className="glass-strong validation-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="titulo-password"
            >
                {contenido}
            </div>
        </div>,
        document.body
    );
}

export default CambiarPassword;
