import { useEffect, useRef, useState } from 'react';

import { IconoCandado, IconoCorreo, IconoOjo } from '../components/Iconos';
import { apiJson } from '../utils/api';

/*
 * =========================================================
 * INICIO DE SESIÓN
 *
 * Correo + contraseña. Opcionalmente se recuerda SOLO el
 * correo en este navegador (la contraseña nunca se guarda).
 * =========================================================
 */

const CLAVE_RECORDAR = 'oma_digital_recordar_v2';
const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;


function leerCorreoRecordado() {
    try {
        return localStorage.getItem(CLAVE_RECORDAR) || '';
    } catch {
        return '';
    }
}

function recordarCorreo(correo) {
    try {
        if (correo) {
            localStorage.setItem(CLAVE_RECORDAR, correo);
        } else {
            localStorage.removeItem(CLAVE_RECORDAR);
        }

        // Formato anterior (correo + área): ya no se usa
        localStorage.removeItem('oma_digital_recordar_v1');
    } catch {
        // El navegador bloquea el almacenamiento
    }
}


function Login({ onLogin, aviso = '' }) {
    const [correoRecordado] = useState(leerCorreoRecordado);

    const [correo, setCorreo] = useState(correoRecordado);
    const [password, setPassword] = useState('');
    const [verPassword, setVerPassword] = useState(false);
    const [mayusculas, setMayusculas] = useState(false);
    const [recordar, setRecordar] = useState(Boolean(correoRecordado));

    const [tocado, setTocado] = useState({ correo: false, password: false });
    const [error, setError] = useState('');
    const [cargando, setCargando] = useState(false);

    const correoRef = useRef(null);
    const passwordRef = useRef(null);

    useEffect(() => {
        (correoRecordado ? passwordRef : correoRef).current?.focus();
    }, [correoRecordado]);


    const correoLimpio = correo.trim().toLowerCase();

    const errorCorreo = !correoLimpio
        ? 'Escribe tu correo.'
        : !CORREO_VALIDO.test(correoLimpio)
            ? 'El correo no tiene un formato válido (ej. nombre@empresa.com).'
            : '';

    const errorPassword = password ? '' : 'Escribe tu contraseña.';


    const iniciarSesion = async (evento) => {
        evento.preventDefault();

        setTocado({ correo: true, password: true });

        if (errorCorreo) {
            correoRef.current?.focus();
            return;
        }

        if (errorPassword) {
            passwordRef.current?.focus();
            return;
        }

        try {
            setCargando(true);
            setError('');

            const datos = await apiJson(
                '/auth/login',
                {
                    method: 'POST',
                    body: JSON.stringify({ correo: correoLimpio, password })
                },
                'No fue posible iniciar sesión.'
            );

            if (!datos?.usuario) {
                throw new Error('No pudimos iniciar tu sesión. Inténtalo de nuevo en unos momentos.');
            }

            recordarCorreo(recordar ? correoLimpio : '');
            setPassword('');
            onLogin(datos.usuario);
        } catch (err) {
            setError(err.message || 'No fue posible iniciar sesión.');
            setPassword('');
            passwordRef.current?.focus();
        } finally {
            setCargando(false);
        }
    };


    const detectarMayusculas = (evento) =>
        setMayusculas(Boolean(evento.getModifierState?.('CapsLock')));

    const mostrarErrorCorreo = tocado.correo && errorCorreo;
    const mostrarErrorPassword = tocado.password && errorPassword;

    return (
        <div className="login-page">
            <main className="glass-strong login-card">
                <img className="login-logo" src="/zf-logo.svg" alt="ZF" />

                <h1 className="login-title">OMA Digital</h1>
                <p className="login-subtitle">Inicia sesión para evaluar Shop Floor OMA</p>

                {aviso && !error && (
                    <div className="aviso aviso-info" role="status">{aviso}</div>
                )}

                {error && (
                    <div className="aviso aviso-error" role="alert">{error}</div>
                )}

                <form onSubmit={iniciarSesion} noValidate>
                    <div className="campo">
                        <label className="campo-label" htmlFor="correo">Correo</label>

                        <div className="campo-con-icono">
                            <span className="campo-icono"><IconoCorreo /></span>

                            <input
                                ref={correoRef}
                                id="correo"
                                className="campo-input"
                                type="email"
                                inputMode="email"
                                autoComplete="username"
                                autoCapitalize="none"
                                spellCheck={false}
                                placeholder="nombre@empresa.com"
                                maxLength={160}
                                value={correo}
                                disabled={cargando}
                                aria-invalid={Boolean(mostrarErrorCorreo)}
                                aria-describedby={mostrarErrorCorreo ? 'correo-error' : undefined}
                                onChange={(evento) => {
                                    setCorreo(evento.target.value);
                                    setError('');
                                }}
                                onBlur={() => setTocado((actual) => ({ ...actual, correo: true }))}
                            />
                        </div>

                        {mostrarErrorCorreo && (
                            <div id="correo-error" className="campo-error">{errorCorreo}</div>
                        )}
                    </div>

                    <div className="campo">
                        <label className="campo-label" htmlFor="password">Contraseña</label>

                        <div className="campo-con-icono">
                            <span className="campo-icono"><IconoCandado /></span>

                            <input
                                ref={passwordRef}
                                id="password"
                                className="campo-input con-accion"
                                type={verPassword ? 'text' : 'password'}
                                autoComplete="current-password"
                                maxLength={128}
                                value={password}
                                disabled={cargando}
                                aria-invalid={Boolean(mostrarErrorPassword)}
                                aria-describedby={
                                    [mostrarErrorPassword && 'password-error', mayusculas && 'password-mayus']
                                        .filter(Boolean)
                                        .join(' ') || undefined
                                }
                                onChange={(evento) => {
                                    setPassword(evento.target.value);
                                    setError('');
                                }}
                                onKeyUp={detectarMayusculas}
                                onKeyDown={detectarMayusculas}
                                onBlur={() => setTocado((actual) => ({ ...actual, password: true }))}
                            />

                            <button
                                type="button"
                                className="campo-accion"
                                onClick={() => setVerPassword((actual) => !actual)}
                                aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                aria-pressed={verPassword}
                                title={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                            >
                                <IconoOjo tachado={verPassword} />
                            </button>
                        </div>

                        {mostrarErrorPassword && (
                            <div id="password-error" className="campo-error">{errorPassword}</div>
                        )}

                        {mayusculas && (
                            <div id="password-mayus" className="campo-ayuda aviso-mayus">
                                ⇪ Bloq Mayús está activado.
                            </div>
                        )}
                    </div>

                    <label className="switch">
                        Recordar mi correo en este equipo
                        <input
                            type="checkbox"
                            checked={recordar}
                            onChange={(evento) => {
                                setRecordar(evento.target.checked);

                                if (!evento.target.checked) recordarCorreo('');
                            }}
                        />
                        <span className="switch-pista" aria-hidden="true" />
                    </label>

                    <button
                        type="submit"
                        className="btn-primary btn-lg"
                        style={{ width: '100%' }}
                        disabled={cargando}
                    >
                        {cargando && <span className="boton-spinner" aria-hidden="true" />}
                        {cargando ? 'Iniciando sesión…' : 'Iniciar sesión'}
                    </button>
                </form>

                <p className="login-pie">
                    ¿Olvidaste tu contraseña o no tienes acceso?
                    <br />
                    Solicita al administrador de OMA Digital que la restablezca.
                </p>
            </main>
        </div>
    );
}

export default Login;
