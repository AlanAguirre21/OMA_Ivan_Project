import { useEffect, useState } from 'react';

import Layout from './components/Layout';
import EvaluacionForm from './components/EvaluacionForm';
import ErrorBoundary from './components/ErrorBoundary';
import SesionesActivas from './components/SesionesActivas';
import CambiarPassword from './pages/CambiarPassword';
import Calendario from './pages/Calendario';
import Historial from './pages/Historial';
import Lineas from './pages/Lineas';
import Login from './pages/Login';
import Respuestas from './pages/Respuestas';
import Resultados from './pages/Resultados';
import Usuarios from './pages/Usuarios';

import { limpiarSesionAntigua } from './utils/auth';

import { apiFetch, apiJson, MENSAJE_SIN_CONEXION } from './utils/api';


function App() {
    const [usuario, setUsuario] = useState(null);
    const [verificandoSesion, setVerificandoSesion] = useState(true);

    const [vista, setVista] = useState('evaluacion');
    const [evaluacionSeleccionada, setEvaluacionSeleccionada] = useState(null);

    // Admin: ver resultados / historial de un usuario concreto
    const [usuarioFiltro, setUsuarioFiltro] = useState('');

    const [mostrarCambioPassword, setMostrarCambioPassword] = useState(false);
    const [mostrarSesiones, setMostrarSesiones] = useState(false);

    // Motivo por el que se cerró la sesión (se muestra en el login)
    const [avisoSesion, setAvisoSesion] = useState('');

    const esAdmin = usuario?.rol === 'admin';


    // ------------------------------------------------------------
    // Al abrir la app: ¿hay una sesión abierta en este equipo?
    // (la cookie de sesión la envía el navegador)
    // ------------------------------------------------------------

    useEffect(() => {
        const validarSesion = async () => {
            limpiarSesionAntigua();

            try {
                // Sin sesión el servidor responde { usuario: null } (no es un error)
                const datos = await apiJson('/auth/sesion');

                setUsuario(datos?.usuario || null);

                // Sesión vencida o cerrada desde otro equipo
                if (!datos?.usuario && datos?.codigo && datos.codigo !== 'SIN_SESION') {
                    setAvisoSesion(datos.mensaje || 'Tu sesión terminó. Inicia sesión nuevamente.');
                }
            } catch (error) {
                setUsuario(null);
                setAvisoSesion(error?.status === 0 ? MENSAJE_SIN_CONEXION : error.message);
            } finally {
                setVerificandoSesion(false);
            }
        };

        validarSesion();
    }, []);


    // ------------------------------------------------------------
    // Eventos globales de la API
    // ------------------------------------------------------------

    useEffect(() => {
        const sesionExpirada = (evento) => {
            setAvisoSesion(evento?.detail?.mensaje || 'Tu sesión expiró. Inicia sesión nuevamente.');
            setUsuario(null);
            setVista('evaluacion');
            setEvaluacionSeleccionada(null);
            setUsuarioFiltro('');
            setMostrarCambioPassword(false);
            setMostrarSesiones(false);
        };

        // El servidor exige cambiar la contraseña antes de continuar
        const cambioRequerido = () =>
            setUsuario((actual) => (actual ? { ...actual, debeCambiarPassword: true } : actual));

        window.addEventListener('oma:sesion-expirada', sesionExpirada);
        window.addEventListener('oma:cambio-password', cambioRequerido);

        return () => {
            window.removeEventListener('oma:sesion-expirada', sesionExpirada);
            window.removeEventListener('oma:cambio-password', cambioRequerido);
        };
    }, []);


    // ------------------------------------------------------------
    // Sesión
    // ------------------------------------------------------------

    const manejarLogin = (usuarioAutenticado) => {
        setAvisoSesion('');
        setUsuario(usuarioAutenticado);
        setVista('evaluacion');
        setEvaluacionSeleccionada(null);
        setUsuarioFiltro('');
    };

    // Cierra la sesión de este equipo en el servidor (borra la cookie)
    const limpiarEstado = () => {
        setUsuario(null);
        setVista('evaluacion');
        setEvaluacionSeleccionada(null);
        setUsuarioFiltro('');
        setMostrarCambioPassword(false);
        setMostrarSesiones(false);
    };

    const manejarLogout = async () => {
        try {
            await apiFetch('/auth/logout', { method: 'POST' });
        } catch {
            // Sin conexión: la sesión vencerá sola en el servidor
        }

        setAvisoSesion('');
        limpiarEstado();
    };

    // Se cerró la sesión de este equipo desde "Sesiones activas"
    const sesionActualCerrada = () => {
        setAvisoSesion('Cerraste la sesión en este equipo.');
        limpiarEstado();
    };

    // Tras cambiar la contraseña el servidor abre una sesión nueva
    const passwordActualizada = (usuarioActualizado) => {
        setUsuario(usuarioActualizado);
        setMostrarCambioPassword(false);
    };


    // ------------------------------------------------------------
    // Navegación
    // ------------------------------------------------------------

    const cambiarVista = (nuevaVista) => {
        setVista(nuevaVista);
        setEvaluacionSeleccionada(null);

        if (nuevaVista === 'evaluacion' || nuevaVista === 'usuarios' || nuevaVista === 'lineas') {
            setUsuarioFiltro('');
        }
    };

    const verEvaluacion = (id) => {
        setEvaluacionSeleccionada(id);
        setVista('resultados');
    };

    // Admin: Usuarios → Resultados de esa persona
    const verResultadosDe = (idUsuario) => {
        setUsuarioFiltro(idUsuario);
        setEvaluacionSeleccionada(null);
        setVista('resultados');
    };


    // ------------------------------------------------------------
    // Render
    // ------------------------------------------------------------

    if (verificandoSesion) {
        return (
            <div className="login-page">
                <div className="glass loading-card">
                    <div className="loading-spinner" />
                    <p>Verificando sesión…</p>
                </div>
            </div>
        );
    }

    if (!usuario) {
        return <Login onLogin={manejarLogin} aviso={avisoSesion} />;
    }

    if (usuario.debeCambiarPassword) {
        return (
            <CambiarPassword
                obligatorio
                usuario={usuario}
                onListo={passwordActualizada}
                onCancelar={manejarLogout}
            />
        );
    }

    // Una vista de admin nunca se muestra a otro rol
    const vistaSegura = ['usuarios', 'lineas', 'respuestas'].includes(vista) && !esAdmin ? 'evaluacion' : vista;

    const renderVista = () => {
        if (vistaSegura === 'calendario') {
            return <Calendario usuario={usuario} />;
        }

        if (vistaSegura === 'respuestas') {
            return <Respuestas />;
        }

        if (vistaSegura === 'lineas') {
            return <Lineas />;
        }

        if (vistaSegura === 'usuarios') {
            return <Usuarios usuarioActual={usuario} onVerResultados={verResultadosDe} />;
        }

        if (vistaSegura === 'historial') {
            return (
                <Historial
                    usuario={usuario}
                    usuarioFiltro={usuarioFiltro}
                    onCambiarUsuarioFiltro={setUsuarioFiltro}
                    onVerEvaluacion={verEvaluacion}
                />
            );
        }

        if (vistaSegura === 'resultados') {
            return (
                <Resultados
                    usuario={usuario}
                    evaluacionId={evaluacionSeleccionada}
                    usuarioFiltro={usuarioFiltro}
                    onCambiarUsuarioFiltro={setUsuarioFiltro}
                />
            );
        }

        return <EvaluacionForm usuario={usuario} />;
    };

    return (
        <Layout
            vistaActual={vistaSegura}
            onCambiarVista={cambiarVista}
            usuario={usuario}
            onCerrarSesion={manejarLogout}
            onCambiarPassword={() => setMostrarCambioPassword(true)}
            onVerSesiones={() => setMostrarSesiones(true)}
        >
            <ErrorBoundary
                key={`${vistaSegura}-${evaluacionSeleccionada || ''}-${usuarioFiltro}`}
                onSalir={() => cambiarVista('evaluacion')}
            >
                {renderVista()}
            </ErrorBoundary>

            {mostrarCambioPassword && (
                <CambiarPassword
                    usuario={usuario}
                    onListo={passwordActualizada}
                    onCancelar={() => setMostrarCambioPassword(false)}
                />
            )}

            {mostrarSesiones && (
                <SesionesActivas
                    onCerrar={() => setMostrarSesiones(false)}
                    onSesionActualCerrada={sesionActualCerrada}
                />
            )}
        </Layout>
    );
}

export default App;
