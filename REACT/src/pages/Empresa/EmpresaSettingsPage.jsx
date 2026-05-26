// src/pages/Empresa/EmpresaSettingsPage.jsx
import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './EmpresaSettings.css';

function EmpresaSettingsPage() {
  const { canAccessRoute } = useAuth();
  const location = useLocation();
  const isRootPath = location.pathname === '/empresa-settings';
  const getNavLinkClass = ({ isActive }) => `empresa-settings-page__nav-link ${isActive ? 'active' : ''}`;
  const getDetalhesClass = ({ isActive }) => `empresa-settings-page__nav-link ${(isActive || isRootPath) ? 'active' : ''}`;

  return (
    <div className="empresa-settings-page">
      <div className="empresa-settings-page__nav">
        <NavLink to="detalhes" className={getDetalhesClass}>
          <i className="fas fa-building" />
          Detalhes
        </NavLink>

        {canAccessRoute('clientes') && (
          <NavLink to="clientes" className={getNavLinkClass}>
            <i className="fas fa-users" />
            Clientes
          </NavLink>
        )}

        {canAccessRoute('whatsapp') && (
          <NavLink to="whatsapp" className={getNavLinkClass}>
            <i className="fab fa-whatsapp" />
            WhatsApp
          </NavLink>
        )}

        {canAccessRoute('empresaApi') && (
          <NavLink to="api" className={getNavLinkClass}>
            <i className="fas fa-key" />
            API Key
          </NavLink>
        )}

        {canAccessRoute('propostas') && (
          <NavLink to="propostas" className={getNavLinkClass}>
            <i className="fas fa-file-invoice-dollar" />
            Gestao (PIs)
          </NavLink>
        )}

        {canAccessRoute('contratos') && (
          <NavLink to="contratos" className={getNavLinkClass}>
            <i className="fas fa-file-invoice" />
            Gestao (Contratos)
          </NavLink>
        )}
      </div>

      <div className="empresa-settings-page__content">
        <Outlet />
      </div>
    </div>
  );
}

export default EmpresaSettingsPage;
