// src/components/Sidebar/Sidebar.jsx
import React, { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useConfirmation } from '../../context/ConfirmationContext';
import './Sidebar.css';

const navClass = ({ isActive }) => `sidebar__nav-link ${isActive ? 'sidebar__nav-link--active' : ''}`;
const storageAvailable = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

function Sidebar() {
  const { canAccessRoute, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const showConfirmation = useConfirmation();
  const [theme, setTheme] = useState(() => {
    const savedTheme = storageAvailable() ? window.localStorage.getItem('theme') : null;
    if (savedTheme) {
      if (typeof document !== 'undefined') {
        document.body.classList.toggle('light-theme', savedTheme === 'light');
      }
    }
    return savedTheme || 'dark';
  });

  useEffect(() => {
    document.body.classList.remove('light-theme');
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    }
    if (storageAvailable()) {
      window.localStorage.setItem('theme', theme);
    }
  }, [theme]);

  const handleLogout = async (event) => {
    event.preventDefault();
    try {
      await showConfirmation({
        message: 'Tem a certeza de que deseja sair da sua conta?',
        title: 'Confirmar Logout',
        confirmText: 'Sair',
        cancelText: 'Cancelar',
        confirmButtonType: 'red',
      });
      logout();
      navigate('/login', { replace: true });
    } catch (error) {
      if (error.message !== 'Acao cancelada pelo usuario.') {
        console.error('Erro no modal de confirmacao:', error);
      }
    }
  };

  const isEmpresaActive = location.pathname.startsWith('/empresa-settings');
  const themeIconClass = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';

  return (
    <aside className="sidebar fdn-root">
      <div className="sidebar__header">
        <NavLink to="/dashboard" className="sidebar__logo-container" data-link>
          <img src="/assets/img/logo 244.png" alt="Logo InMidia" className="sidebar__logo-img" />
          <span className="sidebar__logo-text">InMidia</span>
        </NavLink>
      </div>

      <nav className="sidebar__nav-container">
        <ul className="sidebar__nav">
          {canAccessRoute('dashboard') && <li><NavLink to="/dashboard" className={navClass} data-link><i className="fas fa-home" /> <span>Dashboard</span></NavLink></li>}
          {canAccessRoute('placas') && <li><NavLink to="/placas" end={false} className={navClass} data-link><i className="fas fa-th-large" /> <span>Placas</span></NavLink></li>}
          {canAccessRoute('regioes') && <li><NavLink to="/regioes" className={navClass} data-link><i className="fas fa-map-marked-alt" /> <span>Regioes</span></NavLink></li>}
          {canAccessRoute('map') && <li><NavLink to="/map" className={navClass} data-link><i className="fas fa-map" /> <span>Mapa</span></NavLink></li>}
          {canAccessRoute('relatorios') && <li><NavLink to="/relatorios" className={navClass} data-link><i className="fas fa-chart-pie" /> <span>Relatorios</span></NavLink></li>}
          {canAccessRoute('adminUsers') && <li><NavLink to="/admin-users" className={navClass} data-link><i className="fas fa-shield-alt" /> <span>Admin</span></NavLink></li>}
          {canAccessRoute('audit') && <li><NavLink to="/audit" className={navClass} data-link><i className="fas fa-history" /> <span>Auditoria</span></NavLink></li>}
          {canAccessRoute('syncOps') && <li><NavLink to="/admin-sync" className={navClass} data-link><i className="fas fa-heartbeat" /> <span>Sync Ops</span></NavLink></li>}
          {canAccessRoute('biWeeks') && <li><NavLink to="/bi-weeks" className={navClass} data-link><i className="fas fa-calendar-alt" /> <span>Bi-Semanas</span></NavLink></li>}
        </ul>
      </nav>

      <div className="sidebar__footer">
        <NavLink to="/user" className={navClass} data-link><i className="fas fa-user" /> <span>Meu Perfil</span></NavLink>

        {canAccessRoute('empresa') && (
          <NavLink
            to="/empresa-settings"
            className={`sidebar__nav-link ${isEmpresaActive ? 'sidebar__nav-link--active' : ''}`}
            data-link
          >
            <i className="fas fa-cog" /> <span>Empresa</span>
          </NavLink>
        )}

        <div className="sidebar__theme-switcher">
          <i className={themeIconClass} />
          <span>Modo Claro</span>
          <label className="switch">
            <input
              type="checkbox"
              id="theme-toggle"
              checked={theme === 'light'}
              onChange={(event) => setTheme(event.target.checked ? 'light' : 'dark')}
            />
            <span className="slider" />
          </label>
        </div>
        <a href="#" className="sidebar__nav-link" id="logout-button" onClick={handleLogout}>
          <i className="fas fa-sign-out-alt" /> <span>Sair</span>
        </a>
      </div>
    </aside>
  );
}

export default Sidebar;
