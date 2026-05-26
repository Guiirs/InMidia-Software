import { memo, useMemo } from 'react';
import NavigationSection from './NavigationSection.jsx';
import { NAVIGATION_GROUPS, meetsMinRole } from '../foundation/navigation.js';

const SHELL_GROUP_LABELS = {
  principal: 'Rotina operacional',
  comercial: 'Receita e contratos',
  gestao: 'Gestao e controle',
};

function canShowItem(item, permissions = [], userRole) {
  if (item.available === false) return false;
  if (!meetsMinRole(userRole, item.minRole)) return false;
  if (!permissions.length) return true;
  if (!item.permission) return true;
  return permissions.includes(item.permission);
}

function visibleGroupsForUser(user) {
  const permissions = user?.permissions ?? [];
  const userRole    = user?.role ?? 'visualizador';
  return NAVIGATION_GROUPS
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canShowItem(item, permissions, userRole)),
    }))
    .filter((group) => group.items.length > 0);
}

function Sidebar({
  collapsed = false,
  activeItemId,
  onSelect,
  onToggle,
  user = { name: 'Usuario', role: 'Operador', initials: 'IN', permissions: [] },
  companyName = 'InMidia',
}) {
  const visibleGroups = useMemo(() => visibleGroupsForUser(user), [user]);

  return (
    <aside
      className={`v4p-sidebar${collapsed ? ' v4p-sidebar--collapsed' : ''}`}
      aria-label="Navegacao principal"
      data-collapsed={collapsed ? 'true' : 'false'}
    >
      <div className="v4p-sidebar__brand">
        <div className="v4p-sidebar__brand-mark" aria-hidden="true">
          IN
        </div>
        <div className="v4p-sidebar__brand-text">
          <div className="v4p-sidebar__brand-name">{companyName}</div>
          <div className="v4p-sidebar__brand-sub">OOH Intelligence</div>
        </div>
        <button
          type="button"
          className="v4p-sidebar__toggle v4p-icon material-symbols-rounded"
          onClick={onToggle}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          {collapsed ? 'menu' : 'menu_open'}
        </button>
      </div>

      <div className="v4p-sidebar__nav">
        {visibleGroups.map(group => (
          <NavigationSection
            key={group.id}
            group={{ ...group, label: SHELL_GROUP_LABELS[group.id] ?? group.label }}
            activeItemId={activeItemId}
            collapsed={collapsed}
            onSelect={onSelect}
          />
        ))}
      </div>

      <div className="v4p-sidebar__footer">
        <div className="v4p-sidebar__ops-status" aria-label="Status da conexão">
          <span className="v4p-sidebar__ops-dot" />
          <div>
            <strong>Operacao ativa</strong>
            <p>Ambiente V4</p>
          </div>
        </div>
        <div className="v4p-sidebar__user" title={collapsed ? `${user.name} - ${user.role}` : undefined}>
          <div className="v4p-sidebar__avatar" aria-hidden="true">
            {user.initials}
          </div>
          <div className="v4p-sidebar__user-info">
            <div className="v4p-sidebar__user-name">{user.name}</div>
            <div className="v4p-sidebar__user-role">{user.role}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default memo(Sidebar);
