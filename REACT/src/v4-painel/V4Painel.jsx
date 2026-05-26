import { useCallback, useEffect, useState } from 'react';
import { RuntimeProvider } from './providers/RuntimeProvider.jsx';
import AppShell from './shell/AppShell.jsx';
import { NAV_ITEM_ID } from './foundation/navigation.js';
import V4DebugPanel from './debug/V4DebugPanel.jsx';

import { DashboardPage } from './pages/dashboard/index.js';
import { OperationsPage } from './pages/operations/index.js';
import { InventoryPage } from './pages/inventory/index.js';
import { MapPage } from './pages/map/index.js';
import { RegionsPage } from './pages/regions/index.js';
import { CommercialPage } from './pages/commercial/index.js';
import { ContractsPage } from './pages/contracts/index.js';
import { ReportsPage } from './pages/reports/index.js';
import { AlertsPage } from './pages/alerts/index.js';
import { ActivityPage } from './pages/activity/index.js';
import { CampaignsPage } from './pages/campaigns/index.js';
import EmpresaSettingsV4 from './pages/empresa/EmpresaSettingsV4.jsx';

export default function V4Painel({ initialPage = NAV_ITEM_ID.DASHBOARD, density = 'default' }) {
  const [activeItemId, setActiveItemId] = useState(initialPage);
  const [mapFocusBoard, setMapFocusBoard] = useState(null);

  useEffect(() => {
    setActiveItemId(initialPage);
    if (initialPage !== NAV_ITEM_ID.REGIOES) {
      setMapFocusBoard(null);
    }
  }, [initialPage]);

  const handleNavigateToMap = useCallback((board) => {
    setMapFocusBoard(board);
    setActiveItemId(NAV_ITEM_ID.REGIOES);
  }, []);

  const handleClearMapFocus = useCallback(() => {
    setMapFocusBoard(null);
  }, []);

  const handleNavigateWithClear = useCallback((itemId) => {
    if (itemId !== NAV_ITEM_ID.REGIOES) setMapFocusBoard(null);
    setActiveItemId(itemId);
  }, []);

  function renderPage() {
    switch (activeItemId) {
      case NAV_ITEM_ID.DASHBOARD:
        return <DashboardPage />;
      case NAV_ITEM_ID.OPERACOES:
        return <OperationsPage />;
      case NAV_ITEM_ID.INVENTARIO:
        return <InventoryPage onNavigateToMap={handleNavigateToMap} />;
      case NAV_ITEM_ID.REGIOES_MGMT:
        return <RegionsPage />;
      case NAV_ITEM_ID.REGIOES:
        return <MapPage focusBoard={mapFocusBoard} onClearFocus={handleClearMapFocus} />;
      case NAV_ITEM_ID.COMERCIAL:
        return <CommercialPage />;
      case NAV_ITEM_ID.CONTRATOS:
        return <ContractsPage />;
      case NAV_ITEM_ID.RELATORIOS:
        return <ReportsPage />;
      case NAV_ITEM_ID.CAMPANHAS:
        return <CampaignsPage />;
      case NAV_ITEM_ID.ALERTAS:
        return <AlertsPage />;
      case NAV_ITEM_ID.ATIVIDADE:
        return <ActivityPage />;
      case NAV_ITEM_ID.EMPRESA:
        return <EmpresaSettingsV4 />;
      default:
        return <DashboardPage />;
    }
  }

  return (
    <RuntimeProvider density={density}>
      <AppShell
        activeId={activeItemId}
        onNavigate={handleNavigateWithClear}
      >
        {renderPage()}
      </AppShell>
      {import.meta.env.DEV && <V4DebugPanel />}
    </RuntimeProvider>
  );
}
