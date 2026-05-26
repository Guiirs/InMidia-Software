export default function BulkActionBar({
  selectedCount = 0,
  actions = null,
  onClear = null,
  className = ''
}) {
  return (
    <div className={`v4-bulk-action-bar${className ? ` ${className}` : ''}`}>
      <div className="v4-bulk-action-bar__summary">
        <strong>{selectedCount}</strong>
        <span>itens selecionados</span>
      </div>
      <div className="v4-bulk-action-bar__actions">
        {actions}
      </div>
      <button
        className="v4-bulk-action-bar__clear"
        type="button"
        onClick={onClear}
      >
        Limpar selecao
      </button>
    </div>
  );
}
