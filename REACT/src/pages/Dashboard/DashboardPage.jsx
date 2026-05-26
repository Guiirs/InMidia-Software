import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchDashboardOverview,
  fetchMostRentedBoards,
  fetchIdleBoards,
  fetchRegionPerformance,
  fetchSalesFunnel,
  fetchDashboardAlerts,
} from '../../services';
import { subscribe } from '../../services/syncService';
import { SYNC_EVENT_TYPES } from '../../contracts';
import OverviewCards from '../../components/dashboard/OverviewCards';
import MostRentedBoards from '../../components/dashboard/MostRentedBoards';
import IdleBoards from '../../components/dashboard/IdleBoards';
import RegionPerformanceTable from '../../components/dashboard/RegionPerformanceTable';
import SalesFunnelCards from '../../components/dashboard/SalesFunnelCards';
import SmartAlerts from '../../components/dashboard/SmartAlerts';
import './Dashboard.css';

function DashboardPage() {
  const queryClient = useQueryClient();

  const overviewQuery = useQuery({
    queryKey: ['dashboard', 'overview'],
    queryFn: fetchDashboardOverview,
    staleTime: 1000 * 60 * 2,
  });

  const mostRentedQuery = useQuery({
    queryKey: ['dashboard', 'mostRented'],
    queryFn: fetchMostRentedBoards,
    staleTime: 1000 * 60 * 2,
    placeholderData: [],
  });

  const idleBoardsQuery = useQuery({
    queryKey: ['dashboard', 'idleBoards'],
    queryFn: fetchIdleBoards,
    staleTime: 1000 * 60 * 2,
    placeholderData: [],
  });

  const regionPerformanceQuery = useQuery({
    queryKey: ['dashboard', 'regionPerformance'],
    queryFn: fetchRegionPerformance,
    staleTime: 1000 * 60 * 2,
    placeholderData: [],
  });

  const funnelQuery = useQuery({
    queryKey: ['dashboard', 'funnel'],
    queryFn: fetchSalesFunnel,
    staleTime: 1000 * 60 * 2,
  });

  const alertsQuery = useQuery({
    queryKey: ['dashboard', 'alerts'],
    queryFn: fetchDashboardAlerts,
    staleTime: 1000 * 60,
    placeholderData: [],
  });

  useEffect(() => {
    const invalidateDashboard = () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    };

    const unsubs = [
      subscribe(SYNC_EVENT_TYPES.PLACA_STATUS_CHANGED, invalidateDashboard),
      subscribe(SYNC_EVENT_TYPES.PLACA_CREATED, invalidateDashboard),
      subscribe(SYNC_EVENT_TYPES.PLACA_DELETED, invalidateDashboard),
      subscribe(SYNC_EVENT_TYPES.PLACA_UPDATED, invalidateDashboard),
      subscribe(SYNC_EVENT_TYPES.DASHBOARD_INVALIDATED, invalidateDashboard),
    ];

    return () => unsubs.forEach((fn) => fn());
  }, [queryClient]);

  const hasError =
    overviewQuery.isError ||
    mostRentedQuery.isError ||
    idleBoardsQuery.isError ||
    regionPerformanceQuery.isError ||
    funnelQuery.isError ||
    alertsQuery.isError;

  const errorMessage =
    overviewQuery.error?.message ||
    mostRentedQuery.error?.message ||
    idleBoardsQuery.error?.message ||
    regionPerformanceQuery.error?.message ||
    funnelQuery.error?.message ||
    alertsQuery.error?.message ||
    'Erro ao carregar dashboard';

  return (
    <div className="dashboard-page fdn-root">
      <OverviewCards data={overviewQuery.data} loading={overviewQuery.isLoading} />

      <section className="dashboard-section dashboard-card">
        <h3 className="dashboard-section__title">Ações rápidas</h3>
        <div className="quick-actions">
          <Link to="/empresa-settings/propostas" className="quick-actions__item">Cadastrar proposta</Link>
          <Link to="/placas?disponivel=true" className="quick-actions__item">Ver placas disponíveis</Link>
          <Link to="/empresa-settings/contratos" className="quick-actions__item">Gerar contrato</Link>
          <Link to="/placas" className="quick-actions__item">Filtrar placas por região</Link>
          <a href="#ranking-placas" className="quick-actions__item">Abrir ranking de placas</a>
        </div>
      </section>

      {hasError && (
        <div className="dashboard-page__error fdn-error-state">
          {errorMessage}
        </div>
      )}

      <SalesFunnelCards data={funnelQuery.data} loading={funnelQuery.isLoading} />

      <div id="ranking-placas">
        <MostRentedBoards data={mostRentedQuery.data} loading={mostRentedQuery.isLoading} />
      </div>

      <div className="dashboard-page__grid-2">
        <IdleBoards data={idleBoardsQuery.data} loading={idleBoardsQuery.isLoading} />
        <SmartAlerts data={alertsQuery.data} loading={alertsQuery.isLoading} />
      </div>

      <RegionPerformanceTable
        data={regionPerformanceQuery.data}
        loading={regionPerformanceQuery.isLoading}
      />
    </div>
  );
}

export default DashboardPage;
