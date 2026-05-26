export default function TableLoadingState({
  rows = 8,
  columns = 6,
  density = 'default',
  className = ''
}) {
  const rowHeight = density === 'compact' ? 30 : 36;
  return (
    <div className={`v4-table-loading-state${className ? ` ${className}` : ''}`} aria-label="Carregando tabela">
      <div className="v4-table-loading-state__table" role="presentation">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            key={`row-${rowIndex}`}
            className="v4-table-loading-state__row"
            style={{ minHeight: `${rowHeight}px` }}
          >
            {Array.from({ length: columns }).map((__, columnIndex) => (
              <div key={`cell-${rowIndex}-${columnIndex}`} className="v4-table-loading-state__cell">
                <span className="v4-table-loading-state__bar" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
