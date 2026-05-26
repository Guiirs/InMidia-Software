import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSyncResource } from '../../core/sync-core/hooks/useSyncResource.js';
import { findNavItem, getNavContext, NAV_ITEM_ID } from '../foundation/navigation.js';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';
import '../styles/globals.css';
import './ShellLayout.css';

// Mapa de NAV_ITEM_ID → rota canônica do App.jsx
const NAV_ID_TO_PATH = {
  [NAV_ITEM_ID.DASHBOARD]:    '/dashboard',
  [NAV_ITEM_ID.OPERACOES]:    '/operacoes',
  [NAV_ITEM_ID.INVENTARIO]:   '/inventario',
  [NAV_ITEM_ID.REGIOES_MGMT]: '/regioes',
  [NAV_ITEM_ID.REGIOES]:      '/mapa',
  [NAV_ITEM_ID.COMERCIAL]:    '/comercial',
  [NAV_ITEM_ID.CONTRATOS]:    '/contratos',
  [NAV_ITEM_ID.CAMPANHAS]:    '/campanhas',
  [NAV_ITEM_ID.RELATORIOS]:   '/relatorios',
  [NAV_ITEM_ID.ALERTAS]:      '/alertas',
  [NAV_ITEM_ID.ATIVIDADE]:    '/atividade',
  [NAV_ITEM_ID.EMPRESA]:      '/empresa',
};

function initialsFromName(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'IN';
  return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function shellUserFromSession(auth, session) {
  const user = session ?? auth.user ?? {};
  const name = user.nome ?? user.name ?? user.email ?? 'Usuario';
  return {
    id: user.id ?? user.userId ?? auth.userId ?? null,
    name,
    role: user.role ?? auth.role ?? 'Operador',
    initials: user.initials ?? initialsFromName(name),
    permissions: user.permissions ?? auth.permissions ?? [],
    tenantId: user.tenantId ?? user.empresaId ?? auth.empresaId ?? null,
  };
}

export function AppShell({
  initialActiveId = NAV_ITEM_ID.DASHBOARD,
  activeId = null,
  onNavigate = null,
  children,
}) {
  const auth = useAuth();
  const navigate = useNavigate();
  const sessionResource = useSyncResource('users.session');
  const [internalActiveId, setInternalActiveId] = useState(initialActiveId);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const shellUser = useMemo(() => (
    shellUserFromSession(auth, sessionResource.data)
  ), [auth, sessionResource.data]);

  const resolvedActiveId = activeId ?? internalActiveId;
  const activeItem = useMemo(() => findNavItem(resolvedActiveId), [resolvedActiveId]);

  const handleNavigate = useCallback((item) => {
    if (!item?.id) return;
    const path = NAV_ID_TO_PATH[item.id];
    if (path) {
      // Navega para a rota canônica — atualiza URL e remonta a página correta.
      // V4PainelEntry receberá o initialPage correto via App.jsx.
      navigate(path);
    } else {
      if (activeId == null) setInternalActiveId(item.id);
      onNavigate?.(item.id, item);
    }
  }, [activeId, onNavigate, navigate]);

  const handleToggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => !prev);
  }, []);

  const pageTitle = activeItem?.label ?? 'Painel';
  const pageSubtitle = getNavContext(resolvedActiveId);

  return (
    <div
      className="v4p-root v4p-shell"
      data-density="default"
      data-sidebar={sidebarCollapsed ? 'collapsed' : 'expanded'}
    >
      <Sidebar
        collapsed={sidebarCollapsed}
        activeItemId={resolvedActiveId}
        onSelect={handleNavigate}
        onToggle={handleToggleSidebar}
        user={shellUser}
        companyName="InMidia"
      />

      <div className="v4p-shell__main">
        <Topbar
          title={pageTitle}
          subtitle={pageSubtitle}
          user={shellUser}
        />

        <main
          className="v4p-shell__page"
          aria-label={`Area de conteudo - ${pageTitle}`}
        >
          {children ?? (
            <div className="v4p-shell__empty">
              <span className="v4p-shell__empty-icon material-symbols-rounded" aria-hidden="true">
                layers
              </span>
              <p className="v4p-shell__empty-title">
                Shell operacional ativo
              </p>
              <p className="v4p-shell__empty-copy">
                Navegacao ativa: <strong>{pageTitle}</strong>.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default AppShell;
