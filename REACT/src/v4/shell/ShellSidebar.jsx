export default function ShellSidebar({
  navGroups,
  activeItemId,
  onSelect,
  companyName = 'INMIDIA OPERACOES',
  companyCode = 'TENANT-DEMO'
}) {
  return (
    <aside className="v4-shell-sidebar" aria-label="Navegação shell v4">
      <div className="v4-shell-sidebar__brand">
        <p className="v4-shell-sidebar__brand-name">{companyName}</p>
        <p className="v4-shell-sidebar__brand-code">{companyCode}</p>
      </div>

      <nav className="v4-shell-sidebar__nav" aria-label="Menu principal v4">
        {navGroups.map((group) => (
          <section key={group.groupId} className="v4-shell-sidebar__group">
            <h2 className="v4-shell-sidebar__group-title">{group.groupLabel}</h2>
            <div className="v4-shell-sidebar__items">
              {group.items.map((item) => {
                const isActive = item.id === activeItemId;

                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`v4-shell-sidebar__item${isActive ? ' v4-shell-sidebar__item--active' : ''}`}
                    onClick={() => onSelect && onSelect(item)}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <span className="v4-shell-sidebar__item-label">{item.label}</span>
                    <span className="v4-shell-sidebar__item-route">{item.futureRoute}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </nav>
    </aside>
  );
}
