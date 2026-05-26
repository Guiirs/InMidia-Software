export default function FilterGroup({
  label,
  children,
  collapsible = false,
  collapsed = false,
  className = ''
}) {
  const groupClass = [
    'v4-filter-group',
    collapsible ? 'v4-filter-group--collapsible' : '',
    collapsed ? 'v4-filter-group--collapsed' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={groupClass}>
      {label && <span className="v4-filter-group__label">{label}</span>}
      {!collapsed && <div className="v4-filter-group__controls">{children}</div>}
    </div>
  );
}
