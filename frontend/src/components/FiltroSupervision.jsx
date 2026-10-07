/*
 * Filtro del administrador: evaluador y área.
 * Solo se muestra cuando el usuario es admin.
 */
function FiltroSupervision({
    evaluadores,
    usuarioFiltro,
    onCambiarUsuario,
    areaFiltro,
    onCambiarArea
}) {
    const areas = [...new Set(evaluadores.map((evaluador) => evaluador.area).filter(Boolean))].sort();

    return (
        <div className="glass filtro-supervision">
            <span className="filtro-supervision-titulo">Supervisión · Administrador</span>

            <label className="selector-evaluacion">
                Evaluador
                <select
                    className="form-select"
                    value={usuarioFiltro}
                    onChange={(evento) => onCambiarUsuario(evento.target.value)}
                >
                    <option value="">Todos los evaluadores ({evaluadores.length})</option>
                    {evaluadores
                        .filter((evaluador) => !areaFiltro || evaluador.area === areaFiltro)
                        .map((evaluador) => (
                            <option key={evaluador.id} value={evaluador.id}>
                                {evaluador.nombre} — {evaluador.area}
                            </option>
                        ))}
                </select>
            </label>

            <label className="selector-evaluacion">
                Área del evaluador
                <select
                    className="form-select"
                    value={areaFiltro}
                    onChange={(evento) => onCambiarArea(evento.target.value)}
                >
                    <option value="">Todas las áreas</option>
                    {areas.map((area) => (
                        <option key={area} value={area}>{area}</option>
                    ))}
                </select>
            </label>
        </div>
    );
}

export default FiltroSupervision;
