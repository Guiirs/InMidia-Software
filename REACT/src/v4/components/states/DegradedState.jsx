export default function DegradedState({ icon = null, title = 'Serviço em modo reduzido', description = 'Alguns dados podem não estar disponíveis no momento.', action = null }) {
  return (
    <div className="v4-degraded-state">
      {icon && <div className="v4-degraded-state__icon">{icon}</div>}
      <h3 className="v4-degraded-state__title">{title}</h3>
      {description && <p className="v4-degraded-state__desc">{description}</p>}
      {action && <div className="v4-degraded-state__action">{action}</div>}
    </div>
  );
}
