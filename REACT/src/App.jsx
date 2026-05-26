// src/App.jsx
import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import FeatureFlagsProvider from './v4-painel/providers/FeatureFlagsProvider.jsx';

import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute';
import AdminRoute from './components/AdminRoute/AdminRoute.jsx';
import { RequirePermission } from './components/PermissionGuards/PermissionGuards';
import ToastNotification from './components/ToastNotification/ToastNotification';
import SessionWarningModal from './components/SessionWarningModal/SessionWarningModal';
import Spinner from './components/Spinner/Spinner';

import { useAuth } from './context/AuthContext';

// Páginas públicas — estáticas
import MainLayout from './layouts/MainLayout/MainLayout';
import ApiStatusPage from './pages/ApiStatus/ApiStatusPage';
import LoginPage from './pages/Login/LoginPage';
import RegisterPage from './pages/Register/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPassword/ForgotPasswordPage';
import LandingPage from './pages/Landing/LandingPage';

// V4 — shell principal do sistema (estático, não lazy — é o caminho crítico)
import V4PainelEntry from './v4-painel/V4PainelEntry.jsx';

// Páginas do shell legado (lazy — não são o caminho principal)
const NotFoundPage             = lazy(() => import('./pages/NotFound/NotFoundPage'));
const UserPage                 = lazy(() => import('./pages/User/UserPage'));
const AdminUsersPage           = lazy(() => import('./pages/Admin/AdminUsersPage'));
const AdminSyncDiagnosticsPage = lazy(() => import('./pages/Admin/AdminSyncDiagnosticsPage'));
const AuditPage                = lazy(() => import('./pages/Audit/AuditPage'));
const EmpresaSettingsPage      = lazy(() => import('./pages/Empresa/EmpresaSettingsPage'));
const EmpresaDetalhes          = lazy(() => import('./pages/Empresa/subpages/EmpresaDetalhes'));
const EmpresaApiKey            = lazy(() => import('./pages/Empresa/subpages/EmpresaApiKey'));
const EmpresaWhatsApp          = lazy(() => import('./pages/Empresa/subpages/EmpresaWhatsApp'));
const ClientesPage             = lazy(() => import('./pages/Clientes/ClientesPage'));
const PIsPage                  = lazy(() => import('./pages/PIs/PIsPage'));
const BiWeeksPage              = lazy(() => import('./pages/BiWeeks/BiWeeksPage'));
const DocsPage                 = lazy(() => import('./pages/Docs/DocsPage'));
const EnterpriseBIPage         = lazy(() => import('./pages/BI/EnterpriseBIPage'));
const MarketplacePage          = lazy(() => import('./pages/Marketplace/MarketplacePage'));

// Páginas legadas — carregadas só quando a flag está ativa
const LegacyPlacasPage       = lazy(() => import('./pages/Placas/PlacasPage'));
const LegacyPlacaFormPage    = lazy(() => import('./pages/PlacaFormPage/PlacaFormPage'));
const LegacyPlacaDetailsPage = lazy(() => import('./pages/PlacaDetailsPage/PlacaDetailsPage'));
const LegacyRegioesPage      = lazy(() => import('./pages/Regioes/RegioesPage'));
const LegacyMapPage          = lazy(() => import('./pages/Map/MapPage'));
const LegacyRelatoriosPage   = lazy(() => import('./pages/Relatorios/RelatoriosPage'));
const LegacyContratosPage    = lazy(() => import('./pages/Contratos/ContratosPage'));
const LegacyDashboardPage    = lazy(() => import('./pages/Dashboard/DashboardPage'));

const LEGACY_PANEL_ENABLED = import.meta.env.VITE_ENABLE_LEGACY_PANEL === 'true';

const FullPageSpinner = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'var(--bg-color)' }}>
    <Spinner message="A carregar página..." />
  </div>
);

/**
 * Renderiza V4Painel em tela cheia, SEM nenhum shell legado ao redor.
 * V4Painel carrega seu próprio AppShell (sidebar + topbar).
 */
function V4Route({ page, permission }) {
  return (
    <RequirePermission permission={permission}>
      <V4PainelEntry initialPage={page} />
    </RequirePermission>
  );
}

/**
 * Redirect inteligente na raiz "/":
 * - Enquanto carrega sessão → spinner
 * - Autenticado → /dashboard
 * - Visitante → /landing
 */
function SmartRootRedirect() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <FullPageSpinner />;
  return <Navigate to={isAuthenticated ? '/dashboard' : '/landing'} replace />;
}

/** Rota legada: só acessível quando VITE_ENABLE_LEGACY_PANEL=true. */
function LegacyRoute({ children }) {
  if (!LEGACY_PANEL_ENABLED) return <Navigate to="/dashboard" replace />;
  return (
    <Suspense fallback={<FullPageSpinner />}>
      {children}
    </Suspense>
  );
}

function App() {
  const { sessionWarning, renewSession, logout, dismissSessionWarning } = useAuth();

  return (
    <FeatureFlagsProvider>
      <Routes>

        {/* ══ ROTAS PÚBLICAS (sem autenticação) ══════════════════════════════ */}
        <Route path="/landing"          element={<LandingPage />} />
        <Route path="/status"           element={<ApiStatusPage />} />
        <Route path="/login"            element={<LoginPage />} />
        <Route path="/empresa-register" element={<RegisterPage />} />
        <Route path="/forgot-password"  element={<ForgotPasswordPage />} />

        {/* Raiz → landing (visitante) ou dashboard (autenticado) */}
        <Route path="/" element={<SmartRootRedirect />} />

        {/* Redirects de URLs antigas/alternativas */}
        <Route path="/v4-painel"     element={<Navigate to="/dashboard" replace />} />
        <Route path="/v4-painel/*"   element={<Navigate to="/dashboard" replace />} />
        <Route path="/dev/v4-preview" element={<Navigate to="/dashboard" replace />} />
        <Route path="/inventory-v4"  element={<Navigate to="/inventario" replace />} />
        <Route path="/placas"        element={<Navigate to="/inventario" replace />} />
        <Route path="/placas/:id"    element={<Navigate to="/inventario" replace />} />
        <Route path="/map"           element={<Navigate to="/mapa" replace />} />
        <Route path="/empresa-settings" element={<Navigate to="/empresa" replace />} />
        <Route path="/empresa-settings/*" element={<Navigate to="/empresa" replace />} />

        {/* ══ ROTAS PRIVADAS ══════════════════════════════════════════════════ */}
        <Route element={<ProtectedRoute />}>

          {/* ── GRUPO A: Rotas V4 canônicas — V4Painel é o shell completo ──
              NÃO estão dentro de MainLayout. V4Painel ocupa 100% do viewport.  */}
          <Route path="/dashboard"  element={<V4Route page="dashboard"    permission="dashboard.read"  />} />
          <Route path="/operacoes"  element={<V4Route page="operacoes"    permission="operations.read" />} />
          <Route path="/inventario" element={<V4Route page="inventario"   permission="inventory.read"  />} />
          <Route path="/regioes"    element={<V4Route page="regioes-mgmt" permission="regions.read"    />} />
          <Route path="/mapa"       element={<V4Route page="regioes"      permission="inventory.read"  />} />
          <Route path="/comercial"  element={<V4Route page="comercial"    permission="commercial.read" />} />
          <Route path="/contratos"  element={<V4Route page="contratos"  permission="contracts.read"  />} />
          <Route path="/campanhas"  element={<V4Route page="campanhas"  permission="campaigns.read"  />} />
          <Route path="/relatorios" element={<V4Route page="relatorios" permission="reports.read"    />} />
          <Route path="/alertas"    element={<V4Route page="alertas"    permission="alerts.read"     />} />
          <Route path="/atividade"  element={<V4Route page="atividade"  permission="activity.read"   />} />
          <Route path="/empresa"    element={<V4Route page="empresa"    permission="settings.manage" />} />

          {/* ── GRUPO B: Rotas legado/admin — mantêm o shell V3 (MainLayout) ──
              Só ficam aqui rotas sem equivalente V4 ainda.                      */}
          <Route
            element={
              <Suspense fallback={<FullPageSpinner />}>
                <MainLayout />
              </Suspense>
            }
          >
            {/* Perfil do usuário */}
            <Route path="/user" element={<Suspense fallback={<FullPageSpinner />}><UserPage /></Suspense>} />

            {/* Configurações da empresa */}
            <Route
              path="/empresa-settings"
              element={<RequirePermission routeKey="empresa"><Suspense fallback={<FullPageSpinner />}><EmpresaSettingsPage /></Suspense></RequirePermission>}
            >
              <Route index element={<Navigate to="detalhes" replace />} />
              <Route path="detalhes"  element={<RequirePermission routeKey="empresaDetalhes"><Suspense fallback={<FullPageSpinner />}><EmpresaDetalhes /></Suspense></RequirePermission>} />
              <Route path="clientes"  element={<RequirePermission routeKey="clientes"><Suspense fallback={<FullPageSpinner />}><ClientesPage /></Suspense></RequirePermission>} />
              <Route path="whatsapp"  element={<RequirePermission routeKey="whatsapp"><Suspense fallback={<FullPageSpinner />}><EmpresaWhatsApp /></Suspense></RequirePermission>} />
              <Route path="propostas" element={<RequirePermission routeKey="propostas"><Suspense fallback={<FullPageSpinner />}><PIsPage /></Suspense></RequirePermission>} />
              <Route path="contratos" element={<RequirePermission routeKey="contratos"><Suspense fallback={<FullPageSpinner />}><LegacyContratosPage /></Suspense></RequirePermission>} />
              <Route element={<AdminRoute />}>
                <Route path="api" element={<RequirePermission routeKey="empresaApi"><Suspense fallback={<FullPageSpinner />}><EmpresaApiKey /></Suspense></RequirePermission>} />
              </Route>
            </Route>

            {/* Administração */}
            <Route element={<AdminRoute />}>
              <Route path="/admin-users"   element={<RequirePermission routeKey="adminUsers"><Suspense fallback={<FullPageSpinner />}><AdminUsersPage /></Suspense></RequirePermission>} />
              <Route path="/audit"         element={<RequirePermission routeKey="audit"><Suspense fallback={<FullPageSpinner />}><AuditPage /></Suspense></RequirePermission>} />
              <Route path="/admin-sync"    element={<RequirePermission routeKey="syncOps"><Suspense fallback={<FullPageSpinner />}><AdminSyncDiagnosticsPage /></Suspense></RequirePermission>} />
              <Route path="/bi-weeks"      element={<RequirePermission routeKey="biWeeks"><Suspense fallback={<FullPageSpinner />}><BiWeeksPage /></Suspense></RequirePermission>} />
              <Route path="/documentacao"  element={<RequirePermission routeKey="docs"><Suspense fallback={<FullPageSpinner />}><DocsPage /></Suspense></RequirePermission>} />
              <Route path="/enterprise-bi" element={<RequirePermission routeKey="enterpriseBi"><Suspense fallback={<FullPageSpinner />}><EnterpriseBIPage /></Suspense></RequirePermission>} />
              <Route path="/marketplace"   element={<RequirePermission routeKey="marketplace"><Suspense fallback={<FullPageSpinner />}><MarketplacePage /></Suspense></RequirePermission>} />
            </Route>

            {/* Rotas legadas — só com VITE_ENABLE_LEGACY_PANEL=true */}
            <Route path="/legacy/dashboard"         element={<LegacyRoute><RequirePermission routeKey="dashboard"><LegacyDashboardPage /></RequirePermission></LegacyRoute>} />
            <Route path="/legacy/placas"            element={<LegacyRoute><RequirePermission routeKey="placas"><LegacyPlacasPage /></RequirePermission></LegacyRoute>} />
            <Route path="/legacy/placas/novo"       element={<LegacyRoute><RequirePermission routeKey="placaCreate"><LegacyPlacaFormPage /></RequirePermission></LegacyRoute>} />
            <Route path="/legacy/placas/editar/:id" element={<LegacyRoute><RequirePermission routeKey="placaEdit"><LegacyPlacaFormPage /></RequirePermission></LegacyRoute>} />
            <Route path="/legacy/placas/:id"        element={<LegacyRoute><RequirePermission routeKey="placaDetails"><LegacyPlacaDetailsPage /></RequirePermission></LegacyRoute>} />
            <Route path="/legacy/regioes"           element={<LegacyRoute><RequirePermission routeKey="regioes"><LegacyRegioesPage /></RequirePermission></LegacyRoute>} />
            <Route path="/legacy/map"               element={<LegacyRoute><RequirePermission routeKey="map"><LegacyMapPage /></RequirePermission></LegacyRoute>} />
            <Route path="/legacy/relatorios"        element={<LegacyRoute><RequirePermission routeKey="relatorios"><LegacyRelatoriosPage /></RequirePermission></LegacyRoute>} />

          </Route> {/* Fim do Grupo B (MainLayout) */}

        </Route> {/* Fim do ProtectedRoute */}

        {/* Not Found */}
        <Route path="*" element={<Suspense fallback={<FullPageSpinner />}><NotFoundPage /></Suspense>} />

      </Routes>

      <ToastNotification />
      {sessionWarning && (
        <SessionWarningModal
          onRenew={renewSession}
          onDismiss={() => {
            dismissSessionWarning();
            logout();
          }}
        />
      )}
    </FeatureFlagsProvider>
  );
}

export default App;
