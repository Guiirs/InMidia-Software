export default function ActionMenuItem({
  label,
  hint,
  danger = false,
  active = false,
  disabled = false,
  onClick = null,
  className = ''
}) {
  const itemClass = [
    'v4-action-menu-item',
    danger ? 'v4-action-menu-item--danger' : '',
    active ? 'v4-action-menu-item--active' : '',
    disabled ? 'v4-action-menu-item--disabled' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <button className={itemClass} type="button" role="menuitem" disabled={disabled} onClick={onClick}>
      <span className="v4-action-menu-item__label">{label}</span>
      {hint && <span className="v4-action-menu-item__hint">{hint}</span>}
    </button>
  );
}
