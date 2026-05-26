export default function TableToolbar({
  leftSlot = null,
  filterSlot = null,
  rightSlot = null,
  children = null,
  className = ''
}) {
  return (
    <div className={`v4-table-toolbar${className ? ` ${className}` : ''}`}>
      <div className="v4-table-toolbar__left">
        {leftSlot}
      </div>
      <div className="v4-table-toolbar__filters">
        {filterSlot}
      </div>
      <div className="v4-table-toolbar__right">
        {rightSlot}
      </div>
      {children && <div className="v4-table-toolbar__extra">{children}</div>}
    </div>
  );
}
