export default function ActionMenu({
  label = 'Acoes',
  children,
  open = false,
  align = 'right',
  className = ''
}) {
  const menuClass = [
    'v4-action-menu',
    `v4-action-menu--${align}`,
    open ? 'v4-action-menu--open' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={menuClass}>
      <button className="v4-action-menu__trigger" type="button" aria-haspopup="menu" aria-expanded={open}>
        {label}
      </button>
      {open && (
        <div className="v4-action-menu__panel" role="menu">
          {children}
        </div>
      )}
    </div>
  );
}
