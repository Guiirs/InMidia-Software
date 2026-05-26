export default function ColumnVisibilityMenu({
  columns = [],
  open = false,
  onToggleColumn = null,
  onClose = null,
  className = ''
}) {
  return (
    <div className={`v4-column-visibility${className ? ` ${className}` : ''}`}>
      <button className="v4-column-visibility__trigger" type="button">
        Colunas
      </button>

      {open && (
        <div className="v4-column-visibility__menu" role="menu" aria-label="Visibilidade de colunas">
          <header className="v4-column-visibility__header">
            <span>Exibir colunas</span>
            <button type="button" onClick={onClose}>Fechar</button>
          </header>
          <ul className="v4-column-visibility__list">
            {columns.map((column) => (
              <li key={column.key || column.label} className="v4-column-visibility__item">
                <label>
                  <input
                    type="checkbox"
                    checked={column.visible !== false}
                    onChange={() => onToggleColumn && onToggleColumn(column.key || column.label)}
                  />
                  <span>{column.label}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
