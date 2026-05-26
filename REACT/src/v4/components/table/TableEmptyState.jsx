export default function TableEmptyState({
  title = 'Nenhum resultado encontrado',
  description = 'Ajuste filtros ou tente novamente mais tarde.',
  action = null,
  className = ''
}) {
  return (
    <div className={`v4-table-empty-state${className ? ` ${className}` : ''}`}>
      <h3 className="v4-table-empty-state__title">{title}</h3>
      <p className="v4-table-empty-state__description">{description}</p>
      {action && <div className="v4-table-empty-state__action">{action}</div>}
    </div>
  );
}
