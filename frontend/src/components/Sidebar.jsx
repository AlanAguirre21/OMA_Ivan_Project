import { IconoCerrar } from './Iconos';

function Sidebar({ id, secciones, vistaActual, onCambiarVista, oculta, onCerrar }) {
    return (
        <aside
            id={id}
            className="sidebar"
            aria-hidden={oculta}
            // inert: con el menú oculto no se puede llegar con Tab
            inert={oculta}
        >
            <div className="sidebar-brand">
                <img src="/zf-logo.svg" alt="ZF" />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="sidebar-brand-title">OMA Digital</div>
                    <div className="sidebar-brand-subtitle">Shop Floor OMA</div>
                </div>

                {onCerrar && (
                    <button
                        type="button"
                        className="btn-plain btn-icon"
                        onClick={onCerrar}
                        aria-label="Cerrar menú"
                        title="Cerrar menú"
                    >
                        <IconoCerrar />
                    </button>
                )}
            </div>

            <div className="sidebar-section">Menú</div>

            <nav className="sidebar-nav" aria-label="Secciones">
                {secciones.map(({ id: seccion, nombre, Icono }) => (
                    <button
                        key={seccion}
                        type="button"
                        className={`sidebar-item ${vistaActual === seccion ? 'active' : ''}`}
                        aria-current={vistaActual === seccion ? 'page' : undefined}
                        onClick={() => onCambiarVista(seccion)}
                    >
                        <Icono />
                        {nombre}
                    </button>
                ))}
            </nav>

            <div className="sidebar-footer">
                <div className="sidebar-marca">
                    <img src="/logozf-DtEcICS.svg" alt="ZF Smart Factory & Digitalization" loading="lazy" />
                    <div className="sidebar-marca-pie">
                        <span>OMA Digital</span>
                        <span className="sidebar-marca-version">ZF ESL</span>
                    </div>
                </div>
            </div>
        </aside>
    );
}

export default Sidebar;
