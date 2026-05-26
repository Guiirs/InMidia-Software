import { memo } from 'react';
import V4EmptyState from './V4EmptyState.jsx';
import V4Skeleton from './V4Skeleton.jsx';

function valueFor(row, column) {
  if (typeof column.render === 'function') {
    return column.render(row);
  }
  return row?.[column.key] ?? '-';
}

function V4DataTable({
  columns = [],
  rows = [],
  loading = false,
  emptyMessage = 'Nenhum registro encontrado.',
  className = '',
  rowKey = 'id',
  ...props
}) {
  const classes = ['v4-ui-data-table', className].filter(Boolean).join(' ');

  if (loading) {
    return (
      <div className={classes} {...props}>
        <V4Skeleton variant="table" rows={5} />
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className={classes} {...props}>
        <V4EmptyState title={emptyMessage} compact />
      </div>
    );
  }

  return (
    <div className={classes} {...props}>
      <table className="v4-ui-data-table__table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                style={{ width: column.width }}
                className={column.align ? `v4-ui-data-table__cell--${column.align}` : undefined}
              >
                {column.header ?? column.label ?? column.key}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => {
            const key = row?.[rowKey] ?? rowIndex;
            return (
              <tr key={key}>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={[
                      column.align ? `v4-ui-data-table__cell--${column.align}` : '',
                      column.className ?? '',
                    ].filter(Boolean).join(' ') || undefined}
                  >
                    {valueFor(row, column)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default memo(V4DataTable);
