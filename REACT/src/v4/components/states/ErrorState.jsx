export default function ErrorState({ icon = null, title = 'Erro ao carregar', description = '', action = null }) {
  return (
    <div className="v4-error-state">
      {icon && <div className="v4-error-state__icon">{icon}</div>}
      <h3 className="v4-error-state__title">{title}</h3>
      {description && <p className="v4-error-state__desc">{description}</p>}
      {action && <div className="v4-error-state__action">{action}</div>}
    </div>
  );
}
