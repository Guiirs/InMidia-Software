export default function EmptyState({ icon = null, title = 'Sem dados', description = '', action = null }) {
  return (
    <div className="v4-empty-state">
      {icon && <div className="v4-empty-state__icon">{icon}</div>}
      <h3 className="v4-empty-state__title">{title}</h3>
      {description && <p className="v4-empty-state__desc">{description}</p>}
      {action && <div className="v4-empty-state__action">{action}</div>}
    </div>
  );
}
