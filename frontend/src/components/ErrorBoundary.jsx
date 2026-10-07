import { Component } from 'react';

/*
 * =========================================================
 * BARRERA DE ERRORES
 *
 * Si una vista lanza un error al renderizar, se muestra
 * un aviso en lugar de dejar la pantalla en blanco.
 * El resto de la aplicación (menú, sesión) sigue activo.
 * =========================================================
 */

class ErrorBoundary extends Component {
    constructor(props) {
        super(props);

        this.state = {
            error: null
        };
    }

    static getDerivedStateFromError(error) {
        return {
            error
        };
    }

    componentDidCatch(error, info) {
        console.error(
            'Error en la vista:',
            error,
            info?.componentStack
        );
    }

    reintentar = () => {
        this.setState({
            error: null
        });
    };

    render() {
        const { error } = this.state;

        if (!error) {
            return this.props.children;
        }

        return (
            <div className="oma-evaluation">
                <div className="glass error-card">
                    <div className="error-icon">
                        !
                    </div>

                    <div>
                        <strong>
                            Esta sección no se pudo mostrar
                        </strong>

                        <p>
                            Ocurrió un error inesperado al
                            mostrar la información. Puedes
                            intentarlo de nuevo o ir a otra
                            sección desde el menú.
                        </p>

                        {import.meta.env.DEV && (
                            <p
                                style={{
                                    fontFamily: 'monospace',
                                    fontSize: '.8rem',
                                    color: 'var(--txt3)'
                                }}
                            >
                                {String(error.message || error)}
                            </p>
                        )}

                        <div
                            style={{
                                display: 'flex',
                                gap: '10px',
                                marginTop: '12px',
                                flexWrap: 'wrap'
                            }}
                        >
                            <button
                                type="button"
                                className="btn-primary"
                                onClick={this.reintentar}
                            >
                                Reintentar
                            </button>

                            {this.props.onSalir && (
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => {
                                        this.reintentar();
                                        this.props.onSalir();
                                    }}
                                >
                                    Ir a Evaluación
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

export default ErrorBoundary;
