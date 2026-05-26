export default function TableHeader({ columns = [], children, className = '' }) {
  return (
    <thead className={`v4-table-header${className ? ` ${className}` : ''}`}>
      {children || (
        <tr className="v4-table-header__row">
          {columns.map((column) => (
            <th
              key={column.key || column.label}
              className={`v4-table-header__cell${column.numeric ? ' v4-table-header__cell--numeric' : ''}`}
              scope="col"
              title={column.label}
            >
              <span className="v4-table-header__label">{column.label}</span>
              {column.sortable && <span className="v4-table-header__sort-hint" aria-hidden="true">::</span>}
            </th>
          ))}
        </tr>
      )}
    </thead>
  );
}
