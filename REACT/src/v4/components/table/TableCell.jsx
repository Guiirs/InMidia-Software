export default function TableCell({
  children,
  as = 'td',
  align = 'left',
  numeric = false,
  isId = false,
  nowrap = false,
  truncate = false,
  className = '',
  colSpan,
  rowSpan
}) {
  const Tag = as;
  const resolvedAlign = numeric ? 'right' : align;

  const cellClass = [
    'v4-table-cell',
    `v4-table-cell--align-${resolvedAlign}`,
    numeric ? 'v4-table-cell--numeric' : '',
    isId ? 'v4-table-cell--id' : '',
    nowrap ? 'v4-table-cell--nowrap' : '',
    truncate ? 'v4-table-cell--truncate' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <Tag className={cellClass} colSpan={colSpan} rowSpan={rowSpan}>
      {children}
    </Tag>
  );
}
