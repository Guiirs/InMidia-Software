import { memo } from 'react';

function NavItemBadge({ badge, collapsed }) {
  if (!badge) return null;

  return (
    <span
      className="v4p-nav-item__badge"
      aria-label={`${badge.count} alertas`}
      aria-hidden={collapsed ? 'true' : undefined}
    >
      {collapsed ? '' : badge.count}
    </span>
  );
}

function NavItem({ item, isActive, collapsed, onSelect }) {
  return (
    <button
      className={`v4p-nav-item${isActive ? ' v4p-nav-item--active' : ''}`}
      type="button"
      onClick={() => onSelect(item)}
      title={collapsed ? item.label : undefined}
      aria-label={collapsed ? item.label : undefined}
      aria-current={isActive ? 'page' : undefined}
    >
      <span className="v4p-nav-item__icon v4p-icon material-symbols-rounded" aria-hidden="true">
        {item.icon}
      </span>
      <span className="v4p-nav-item__label">{item.label}</span>
      <NavItemBadge badge={item.badge} collapsed={collapsed} />
    </button>
  );
}

function NavigationSection({ group, activeItemId, collapsed, onSelect }) {
  return (
    <nav className="v4p-nav-section" aria-label={group.label}>
      <div className="v4p-nav-section__label" aria-hidden={collapsed ? 'true' : undefined}>
        {group.label}
      </div>
      {group.items.map(item => (
        <NavItem
          key={item.id}
          item={item}
          isActive={item.id === activeItemId}
          collapsed={collapsed}
          onSelect={onSelect}
        />
      ))}
    </nav>
  );
}

export default memo(NavigationSection);
