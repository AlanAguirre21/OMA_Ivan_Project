import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { apiJson } from '../utils/api';

/*
 * Equipos con sesión abierta.
 * - Sin "usuario": las sesiones propias (se pueden cerrar
 *   una por una o todas menos la de este equipo).
 * - Con "usuario" (admin): las de esa persona.
 */

const formatoFecha = new Intl.DateTimeFormat('es-MX', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
});

function haceCuanto(fecha) {
    const minutos = Math.round((Date.now() - new Date(fecha).getTime()) / 60000);

    if (minutos < 2) return 'Activa ahora';
    if (minutos < 60) return `Hace ${minutos} min`;
    if (minutos < 24 * 60) return `Hace ${Math.round(minutos / 60)} h`;

    return formatoFecha.format(new Date(fecha));
}

function SesionesActivas({ usuario = null, onCerrar, onSesionActualCerrada }) {
    const ajena = Boolean(usuario);
    const base = ajena ? `/admin/usuarios/${usuario.id}/sesiones` : '/auth/sesiones';

    const [sesiones, setSesiones] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [ocupado, setOcupado] = useState('');
    const [error, setError] = useState('');
    const [aviso, setAviso] = useState('');

    const [version, setVersion] = useState(0);

    useEffect(() => {
        let cancelado = false;

        apiJson(base)
            .then((datos) => {
                if (!cancelado) setSesiones(datos?.sesiones || []);
            })
            .catch((err) => {
                if (!cancelado) setError(err.message);
            })
            .finally(() => {
                if (!cancelado) setCargando(false);
            });

        return () => {
            cancelado = true;
        };
    }, [base, version]);

    useEffect(() => {
        const alPresionar = (evento) => {
            if (evento.key === 'Escape') onCerrar?.();
        };

        document.addEventListener('keydown', alPresionar);

        return () => document.removeEventListener('keydown', alPresionar);
    }, [onCerrar]);

    const ejecutar = async (clave, endpoint, opciones) => {
        try {
            setOcupado(clave);
            setError('');
            const datos = await apiJson(endpoint, opciones);
            setAviso(datos?.mensaje || '');

            if (datos?.actual) {
                onSesionActualCerrada?.();
                return;
            }

            setVersion((valor) => valor + 1);
        } catch (err) {
            setError(err.message);
        } finally {
            setOcupado('');
        }
    };

    const cerrarUna = (sesion) =>
        ejecutar(String(sesion.id), `${base}/${sesion.id}`, { method: 'DELETE' });

    const cerrarOtras = () =>
        ajena
            ? ejecutar('todas', base, { method: 'DELETE' })
            : ejecutar('todas', '/auth/sesiones/cerrar-otras', { method: 'POST' });

    const otras = sesiones.filter((sesion) => !sesion.actual);

    return createPortal(
        <div className="modal-overlay hoja-movil">
            <div
                className="glass-strong validation-modal sesiones-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="titulo-sesiones"
            >
                <div className="validation-header" style={{ marginBottom: 14 }}>
                    <div className="validation-icon" aria-hidden="true">💻</div>
                    <div>
                        <h2 className="validation-title" id="titulo-sesiones">
                            {ajena ? `Sesiones de ${usuario.nombre}` : 'Sesiones activas'}
                        </h2>
                        <p className="validation-description">
                            {ajena
                                ? 'Equipos donde esta persona tiene la sesión abierta. Al cerrarla, deberá iniciar sesión otra vez en ese equipo.'
                                : 'Equipos donde tienes la sesión abierta. Si no reconoces alguno, ciérralo y cambia tu contraseña.'}
                        </p>
                    </div>
                </div>

                {error && <div className="aviso aviso-error" role="alert">{error}</div>}
                {aviso && !error && <div className="aviso aviso-exito" role="status">{aviso}</div>}

                {cargando ? (
                    <div className="sesiones-vacio"><span className="boton-spinner" aria-hidden="true" /> Cargando…</div>
                ) : sesiones.length === 0 ? (
                    <div className="sesiones-vacio">No hay sesiones abiertas.</div>
                ) : (
                    <ul className="sesiones-lista">
                        {sesiones.map((sesion) => (
                            <li key={sesion.id} className={sesion.actual ? 'actual' : ''}>
                                <div className="sesiones-info">
                                    <div className="sesiones-equipo">
                                        {sesion.equipo}
                                        {sesion.actual && <span className="sesiones-etiqueta">Este equipo</span>}
                                    </div>
                                    <div className="sesiones-detalle">
                                        {haceCuanto(sesion.ultimaActividad)}
                                        {sesion.ip ? ` · IP ${sesion.ip}` : ''}
                                        {` · Inició ${formatoFecha.format(new Date(sesion.inicio))}`}
                                    </div>
                                </div>

                                {!(ajena && sesion.actual) && (
                                    <button
                                        type="button"
                                        className="btn-secondary btn-sm"
                                        onClick={() => cerrarUna(sesion)}
                                        disabled={Boolean(ocupado)}
                                    >
                                        {ocupado === String(sesion.id) ? 'Cerrando…' : sesion.actual ? 'Cerrar aquí' : 'Cerrar'}
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                )}

                <div className="validation-actions">
                    {otras.length > 0 && (
                        <button type="button" className="btn-secondary btn-texto-peligro" onClick={cerrarOtras} disabled={Boolean(ocupado)}>
                            {ocupado === 'todas'
                                ? 'Cerrando…'
                                : ajena ? 'Cerrar todas' : 'Cerrar en los demás equipos'}
                        </button>
                    )}
                    <button type="button" className="btn-primary" onClick={onCerrar}>
                        Listo
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

export default SesionesActivas;
