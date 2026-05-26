import { memo } from 'react';
import { ExecutiveReportsGrid } from '../../components/reports/index.js';
import { PerformanceAnalytics } from '../../components/reports/index.js';
import { RevenueAnalytics } from '../../components/reports/index.js';
import { RegionalAnalytics } from '../../components/reports/index.js';
import { OccupancyAnalytics } from '../../components/reports/index.js';
import { ExportCenter } from '../../components/reports/index.js';
import ReportsProvider, { useReports } from '../../providers/ReportsProvider.jsx';
import './ReportsPage.css';

const SOURCE_LABEL = {
  real: 'DADOS REAIS',
  fallback: 'FALLBACK',
  mock: 'PREVIEW',
  stale: 'STALE',
  refreshing: 'ATUALIZANDO',
  error: 'ERRO',
  unauthorized: 'NAO AUTORIZADO',
  forbidden: 'SEM PERMISSAO',
  offline: 'OFFLINE',
};

function ReportsPageInner() {
  const { reports, loading, refreshing, stale, error, source, refresh, createExport } = useReports();

  return (
    <div className="v4p-rep-page">
      <div className="v4p-rep-topline">
        <span className={`v4p-rep-source v4p-rep-source--${source}`}>
          {loading ? 'CARREGANDO' : SOURCE_LABEL[source] ?? 'PREVIEW'}
        </span>
        {(refreshing || stale) && (
          <span className="v4p-rep-source v4p-rep-source--fallback">
            {refreshing ? 'ATUALIZANDO' : 'DADOS ANTERIORES'}
          </span>
        )}
        {error && (
          <div className="v4p-rep-error" role="status">
            <span>{error}</span>
            <button type="button" onClick={refresh}>Atualizar</button>
          </div>
        )}
      </div>

      <header className="v4p-rep-header">
        <div>
          <span className="v4p-rep-eyebrow">Relatórios</span>
          <h1 className="v4p-rep-title">Analytics executivo</h1>
          <p className="v4p-rep-sub">Performance, receita, ocupação e exportações operacionais.</p>
        </div>
        <div className="v4p-rep-hero-stats">
          <article>
            <span>Relatórios</span>
            <strong>{reports.executiveReports.length}</strong>
          </article>
          <article>
            <span>Exportações</span>
            <strong>{reports.exports.length}</strong>
          </article>
          <article>
            <span>Qualidade</span>
            <strong>{reports.source === 'real' ? '100%' : reports.source === 'stale' ? '92%' : '—'}</strong>
          </article>
        </div>
      </header>

      <section aria-labelledby="rep-grid">
        <div id="rep-grid" className="v4p-rep-label">Relatórios disponíveis</div>
        <ExecutiveReportsGrid reports={reports.executiveReports} onExport={createExport} />
      </section>

      <section aria-labelledby="rep-analytics">
        <div id="rep-analytics" className="v4p-rep-label">Análise de desempenho e receita</div>
        <div className="v4p-rep-grid">
          <PerformanceAnalytics performance={reports.performance} />
          <RevenueAnalytics revenue={reports.revenue} performance={reports.performance} />
        </div>
      </section>

      <section aria-labelledby="rep-regional">
        <div id="rep-regional" className="v4p-rep-label">Analytics regionais e de ocupação</div>
        <div className="v4p-rep-grid">
          <RegionalAnalytics regional={reports.regional} />
          <OccupancyAnalytics occupancy={reports.occupancy} />
        </div>
      </section>

      <section aria-labelledby="rep-export">
        <div id="rep-export" className="v4p-rep-label">Central de exportação</div>
        <ExportCenter onExport={createExport} />
      </section>
    </div>
  );
}

function ReportsPage() {
  return (
    <ReportsProvider>
      <ReportsPageInner />
    </ReportsProvider>
  );
}

export default memo(ReportsPage);
