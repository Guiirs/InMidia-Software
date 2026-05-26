import { memo, useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSyncResource } from '../../core/sync-core/hooks/useSyncResource.js';
import { useOperationalState } from '../providers/OperationalStateProvider.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { V4Badge, V4Button } from '../components/ui/index.js';

function UserMenu({ user, onClose }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleProfile = useCallback(() => {
    onClose();
    navigate('/user');
  }, [onClose, navigate]);

  const handleEmpresa = useCallback(() => {
    onClose();
    navigate('/empresa');
  }, [onClose, navigate]);

  const handleLogout = useCallback(async () => {
    onClose();
    await logout();
  }, [onClose, logout]);

  return (
    <div
      ref={menuRef}
      className="v4p-topbar__user-menu"
      role="menu"
      aria-label="Menu do usuario"
    >
      <div className="v4p-topbar__user-menu-header">
        <div className="v4p-topbar__user-menu-name">{user.name}</div>
        <div className="v4p-topbar__user-menu-role">{user.role}</div>
      </div>
      <div className="v4p-topbar__user-menu-divider" />
      <button
        type="button"
        className="v4p-topbar__user-menu-item"
        role="menuitem"
        onClick={handleProfile}
      >
        <span className="v4p-icon material-symbols-rounded" aria-hidden="true">person</span>
        Meu perfil
      </button>
      <button
        type="button"
        className="v4p-topbar__user-menu-item"
        role="menuitem"
        onClick={handleEmpresa}
      >
        <span className="v4p-icon material-symbols-rounded" aria-hidden="true">business</span>
        Configurações da empresa
      </button>
      <div className="v4p-topbar__user-menu-divider" />
      <button
        type="button"
        className="v4p-topbar__user-menu-item v4p-topbar__user-menu-item--danger"
        role="menuitem"
        onClick={handleLogout}
      >
        <span className="v4p-icon material-symbols-rounded" aria-hidden="true">logout</span>
        Sair
      </button>
    </div>
  );
}

function Topbar({
  title = 'Dashboard',
  subtitle,
  user = { name: 'Usuario', role: 'Operador', initials: 'IN' },
}) {
  const { globalState, stateMeta, unreadCount, lastSyncLabel } = useOperationalState();
  const regionsResource = useSyncResource('inventory.regions');
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const isHealthy = globalState === 'healthy' || globalState === 'syncing';
  const statusVariant = isHealthy ? 'success' : globalState === 'critical' ? 'danger' : 'warning';
  const regionCount = Array.isArray(regionsResource.data?.regions)
    ? regionsResource.data.regions.length
    : null;

  const handleToggleMenu = useCallback(() => setMenuOpen((prev) => !prev), []);
  const handleCloseMenu = useCallback(() => setMenuOpen(false), []);
  const handleOpenAlerts = useCallback(() => navigate('/alertas'), [navigate]);

  return (
    <header className="v4p-topbar" role="banner">
      <div className="v4p-topbar__title-group">
        <div className="v4p-topbar__title">{title}</div>
        {subtitle && <div className="v4p-topbar__subtitle">{subtitle}</div>}
      </div>

      <div className="v4p-topbar__controls">
        <div
          className="v4p-topbar__status"
          data-status={statusVariant}
          title={stateMeta.description}
          aria-label={`Status: ${stateMeta.label}`}
        >
          <span
            className="v4p-topbar__status-dot"
            style={!isHealthy ? { background: stateMeta.color } : undefined}
          />
          {stateMeta.label}
        </div>

        <V4Badge variant="muted" size="sm" className="v4p-topbar__sync-badge">
          {lastSyncLabel}
        </V4Badge>

        {regionCount !== null && (
          <V4Badge variant="info" size="sm" className="v4p-topbar__region-badge">
            {regionCount} regioes
          </V4Badge>
        )}

        <V4Button
          variant={unreadCount > 0 ? 'danger' : 'ghost'}
          size="sm"
          className="v4p-topbar__alert-action"
          aria-label={`Alertas${unreadCount > 0 ? `, ${unreadCount} nao lidos` : ''}`}
          title="Ver alertas"
          onClick={handleOpenAlerts}
        >
          <span className="v4p-icon v4p-icon--sm material-symbols-rounded" aria-hidden="true">notifications</span>
          {unreadCount > 0 && <span>{unreadCount}</span>}
        </V4Button>

        <div className="v4p-topbar__user-wrapper">
          <div
            className={`v4p-topbar__avatar${menuOpen ? ' v4p-topbar__avatar--active' : ''}`}
            role="button"
            tabIndex={0}
            aria-label={`Usuario: ${user.name}. Abrir menu`}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            title={user.name}
            onClick={handleToggleMenu}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleToggleMenu()}
          >
            {user.initials}
          </div>
          {menuOpen && (
            <UserMenu user={user} onClose={handleCloseMenu} />
          )}
        </div>
      </div>
    </header>
  );
}

export default memo(Topbar);
