// src/layouts/MainLayout.jsx
import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../../components/Sidebar/Sidebar'; // Importa o componente real
import Header from '../../components/Header/Header';   // Importa o componente real
import './MainLayout.css';

// Mapeamento simples de caminhos para títulos (pode expandir)
const routeTitles = {
    '/dashboard': 'Dashboard',
    '/placas': 'Gestão de Placas',
    '/placas/novo': 'Adicionar Nova Placa',
    // Adicione outras rotas e títulos aqui...
    '/clientes': 'Gestão de Clientes',
    '/regioes': 'Gestão de Regiões',
    '/map': 'Mapa de Placas',
    '/relatorios': 'Relatórios',
    '/user': 'Meu Perfil',
    '/empresa-settings': 'Configurações da Empresa',
    '/admin-users': 'Gestão de Utilizadores',
    '/admin-sync': 'Sync Ops',
    '/audit': 'Auditoria',
};

// Função para obter título dinâmico (ex: Editar Placa XYZ)
const getDynamicTitle = (pathname) => {
    if (pathname.match(/^\/placas\/editar\/.+/)) return 'Editar Placa';
    if (pathname.match(/^\/placas\/.+/)) return 'Detalhes da Placa';
    // Adicione outras rotas dinâmicas
    return 'Página'; // Título padrão
}


function MainLayout() {
    const location = useLocation();
    // Tenta encontrar um título estático ou gera um dinâmico
    const pageTitle = routeTitles[location.pathname] || getDynamicTitle(location.pathname) || 'Dashboard';

    useEffect(() => {
      document.body.classList.add('foundation-theme');

      return () => {
        document.body.classList.remove('foundation-theme');
      };
    }, []);

  return (
    <div className="app-layout fdn-root"> {/* Mantenha classes CSS se aplicável */}
      <Sidebar /> {/* Usa o componente Sidebar real */}
      {/* A classe main-content é aplicada pelo CSS global com base na presença/ausência de sidebar-collapsed no body */}
      <div className="main-content fdn-stack-sm">
        <Header title={pageTitle} /> {/* Usa o componente Header real */}
        <main id="page-content">
          <Outlet /> {/* Renderiza o conteúdo da página */}
        </main>
      </div>
    </div>
  );
}

export default MainLayout;
