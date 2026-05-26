export default function StaleState({ icon = null, title = 'Dados desatualizados', description = 'Os dados podem estar desatualizados. Tente recarregar.', action = null }) {
  return (
    <div className="v4-stale-state">
      {icon && <div className="v4-stale-state__icon">{icon}</div>}
      <h3 className="v4-stale-state__title">{title}</h3>
      {description && <p className="v4-stale-state__desc">{description}</p>}
      {action && <div className="v4-stale-state__action">{action}</div>}
    </div>
  );
}
