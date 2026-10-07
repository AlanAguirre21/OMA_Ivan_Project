import { useEffect, useState } from 'react';

import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { seccionesPara } from './secciones';
import { useMediaQuery } from '../utils/useMediaQuery';

/*
 * Barra lateral desplegable:
 * - Pantalla ancha: empuja el contenido; se recuerda si
 *   quedó abierta o cerrada.
 * - Pantalla mediana / móvil: panel flotante sobre el
 *   contenido que se cierra al elegir, tocar fuera o Esc.
 */

const CLAVE_MENU = 'oma_digital_menu_abierto_v1';
const CONSULTA_ANCHA = '(min-width: 1200px)';

function leerPreferencia() {
    try {
        const valor = localStorage.getItem(CLAVE_MENU);
        return valor === null ? true : valor === '1';
    } catch {
        return true;
    }
}

function Layout({
    children,
    vistaActual,
    onCambiarVista,
    usuario,
    onCerrarSesion,
    onCambiarPassword,
    onVerSesiones
}) {
    const esAncha = useMediaQuery(CONSULTA_ANCHA);

    // Preferencia para pantalla ancha y estado del panel flotante
    const [fijaAbierta, setFijaAbierta] = useState(leerPreferencia);
    const [flotanteAbierta, setFlotanteAbierta] = useState(false);

    const abierta = esAncha ? fijaAbierta : flotanteAbierta;
    const flotante = !esAncha;

    const alternarMenu = () => {
        if (esAncha) {
            setFijaAbierta((actual) => {
                try {
                    localStorage.setItem(CLAVE_MENU, actual ? '0' : '1');
                } catch {
                    // Sin almacenamiento: solo dura esta sesión
                }

                return !actual;
            });
        } else {
            setFlotanteAbierta((actual) => !actual);
        }
    };

    const cerrarFlotante = () => setFlotanteAbierta(false);

    // Esc cierra el panel flotante
    useEffect(() => {
        if (!flotante || !flotanteAbierta) return undefined;

        const alPresionar = (evento) => {
            if (evento.key === 'Escape') setFlotanteAbierta(false);
        };

        document.addEventListener('keydown', alPresionar);

        return () => document.removeEventListener('keydown', alPresionar);
    }, [flotante, flotanteAbierta]);

    const secciones = seccionesPara(usuario);
    const seccion = secciones.find((item) => item.id === vistaActual);

    const cambiarVista = (id) => {
        onCambiarVista(id);

        if (flotante) cerrarFlotante();
    };

    return (
        <div
            className={[
                'app-shell',
                abierta ? 'menu-abierto' : 'menu-cerrado',
                flotante ? 'menu-flotante' : 'menu-fijo'
            ].join(' ')}
        >
            <Sidebar
                id="menu-principal"
                secciones={secciones}
                vistaActual={vistaActual}
                onCambiarVista={cambiarVista}
                oculta={!abierta}
                onCerrar={flotante ? cerrarFlotante : undefined}
            />

            {flotante && abierta && (
                <div
                    className="sidebar-fondo"
                    aria-hidden="true"
                    onClick={cerrarFlotante}
                />
            )}

            <Topbar
                titulo={seccion?.nombre || 'OMA Digital'}
                usuario={usuario}
                onCerrarSesion={onCerrarSesion}
                onCambiarPassword={onCambiarPassword}
                onVerSesiones={onVerSesiones}
                menuAbierto={abierta}
                onAlternarMenu={alternarMenu}
            />

            <main className="app-main">
                <div className="app-content">{children}</div>
            </main>

            <nav
                className="tabbar"
                aria-label="Secciones"
                style={{ gridTemplateColumns: `repeat(${secciones.length}, minmax(0, 1fr))` }}
            >
                {secciones.map(({ id, nombre, nombreCorto, Icono }) => (
                    <button
                        key={id}
                        type="button"
                        className={`tabbar-item ${vistaActual === id ? 'active' : ''}`}
                        aria-current={vistaActual === id ? 'page' : undefined}
                        onClick={() => cambiarVista(id)}
                    >
                        <Icono />
                        <span className="tabbar-texto">{secciones.length > 6 && nombreCorto ? nombreCorto : nombre}</span>
                    </button>
                ))}
            </nav>
        </div>
    );
}

export default Layout;
