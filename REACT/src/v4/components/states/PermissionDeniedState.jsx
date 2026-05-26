export default function PermissionDeniedState({ icon = null, title = 'Acesso negado', description = 'Você não tem permissão para acessar este conteúdo.', action = null }) {
  return (
    <div className="v4-permission-denied-state">
      {icon && <div className="v4-permission-denied-state__icon">{icon}</div>}
      <h3 className="v4-permission-denied-state__title">{title}</h3>
      {description && <p className="v4-permission-denied-state__desc">{description}</p>}
      {action && <div className="v4-permission-denied-state__action">{action}</div>}
    </div>
  );
}
