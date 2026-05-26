export default function TablePagination({
  page = 1,
  totalPages = 1,
  pageSize = 20,
  totalItems = 0,
  onPrev = null,
  onNext = null,
  onPageSizeChange = null,
  pageSizeOptions = [20, 50, 100],
  className = ''
}) {
  return (
    <div className={`v4-table-pagination${className ? ` ${className}` : ''}`}>
      <div className="v4-table-pagination__summary">
        <span>{totalItems} itens</span>
      </div>

      <div className="v4-table-pagination__controls">
        <label className="v4-table-pagination__page-size-label">
          Linhas
          <select
            className="v4-table-pagination__page-size"
            value={pageSize}
            onChange={(event) => onPageSizeChange && onPageSizeChange(Number(event.target.value))}
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>

        <button
          className="v4-table-pagination__button"
          type="button"
          disabled={page <= 1}
          onClick={onPrev}
        >
          Anterior
        </button>

        <span className="v4-table-pagination__page-indicator">
          Pagina {page} de {totalPages}
        </span>

        <button
          className="v4-table-pagination__button"
          type="button"
          disabled={page >= totalPages}
          onClick={onNext}
        >
          Proxima
        </button>
      </div>
    </div>
  );
}
