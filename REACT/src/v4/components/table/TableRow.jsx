export default function TableRow({
  children,
  selected = false,
  hoverable = true,
  stale = false,
  degraded = false,
  className = '',
  onClick
}) {
  const rowClass = [
    'v4-table-row',
    selected ? 'v4-table-row--selected' : '',
    hoverable ? 'v4-table-row--hoverable' : '',
    stale ? 'v4-table-row--stale' : '',
    degraded ? 'v4-table-row--degraded' : '',
    onClick ? 'v4-table-row--clickable' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <tr className={rowClass} onClick={onClick}>
      {children}
    </tr>
  );
}
