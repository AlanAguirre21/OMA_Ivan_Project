import { IconoBarraLateral, IconoEquipos, IconoEscudo, IconoLlave, IconoSalir } from './Iconos';

function iniciales(nombre = '') {
    return nombre
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((parte) => parte[0].toUpperCase())
        .join('') || '?';
}

function Topbar({ titulo, usuario, onCerrarSesion, onCambiarPassword, onVerSesiones, menuAbierto, onAlternarMenu }) {
    return (
        <header className="topbar">
            <div className="topbar-izquierda">
                <button
                    type="button"
                    className="btn-plain btn-icon topbar-menu"
                    onClick={onAlternarMenu}
                    aria-controls="menu-principal"
                    aria-expanded={menuAbierto}
                    aria-label={menuAbierto ? 'Ocultar menú' : 'Mostrar menú'}
                    title={menuAbierto ? 'Ocultar menú' : 'Mostrar menú'}
                >
                    <IconoBarraLateral />
                </button>

                <img className="topbar-logo" src="/zf-logo.svg" alt="ZF" />
                <span className="topbar-title">{titulo}</span>
            </div>

            <div className="topbar-user">
                {usuario && (
                    <>
                        <div className="topbar-user-text">
                            <div className="topbar-user-name">{usuario.nombre}</div>
                            <div className="topbar-user-area">
                                {usuario.rol === 'admin' ? 'Administrador · ' : ''}{usuario.area}
                            </div>
                        </div>
                        <div className="avatar" title={`${usuario.nombre} · ${usuario.area}`}>
                            {iniciales(usuario.nombre)}
                            {usuario.rol === 'admin' && (
                                <span className="avatar-insignia" title="Administrador">
                                    <IconoEscudo />
                                </span>
                            )}
                        </div>
                    </>
                )}

                <button
                    type="button"
                    className="btn-secondary btn-icon"
                    onClick={onVerSesiones}
                    title="Sesiones activas"
                    aria-label="Sesiones activas"
                >
                    <IconoEquipos />
                </button>

                <button
                    type="button"
                    className="btn-secondary btn-icon"
                    onClick={onCambiarPassword}
                    title="Cambiar contraseña"
                    aria-label="Cambiar contraseña"
                >
                    <IconoLlave />
                </button>

                <button
                    type="button"
                    className="btn-secondary btn-icon"
                    onClick={onCerrarSesion}
                    title="Cerrar sesión"
                    aria-label="Cerrar sesión"
                >
                    <IconoSalir />
                </button>
            </div>
        </header>
    );
}

export default Topbar;
