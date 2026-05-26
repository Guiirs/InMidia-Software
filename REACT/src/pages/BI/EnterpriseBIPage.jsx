import React from 'react';
import { useEnterpriseBI } from './hooks/useEnterpriseBI';
import BIEmptyState from './components/BIEmptyState';
import BIErrorState from './components/BIErrorState';
import ExecutiveSummaryCards from './components/ExecutiveSummaryCards';
import RegionalPerformanceTable from './components/RegionalPerformanceTable';
import InventoryHealthPanel from './components/InventoryHealthPanel';
import QualityOverviewPanel from './components/QualityOverviewPanel';
import GovernanceOverviewPanel from './components/GovernanceOverviewPanel';
import ExportPanel from './components/ExportPanel';
import { formatDate } from './utils/biFormatters';

function SectionHeader({ title, description }) {
  return (
    <div className="bi-section-header">
      <h2 className="bi-section-header__title">{title}</h2>
      {description && <p className="bi-section-header__desc">{description}</p>}
    </div>
  );
}

function PanelCard({ title, children }) {
  return (
    <section className="bi-panel-card">
      <h3 className="bi-panel-card__title">{title}</h3>
      <div className="bi-panel-card__body">{children}</div>
    </section>
  );
}

export default function EnterpriseBIPage() {
  const {
    isLoading,
    hasError,
    firstError,
    isEmpty,
    snapshot,
    executive,
    regional,
    inventory,
    quality,
    governance,
  } = useEnterpriseBI();

  if (isLoading) {
    return (
      <div className="bi-page bi-page--loading" data-testid="bi-loading">
        <div className="bi-spinner" aria-label="Carregando dados BI…" />
        <p>Carregando dados de Business Intelligence…</p>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="bi-page bi-page--error" data-testid="enterprise-bi-page">
        <BIErrorState error={firstError} />
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="bi-page bi-page--empty" data-testid="enterprise-bi-page">
        <BIEmptyState />
      </div>
    );
  }

  return (
    <div className="bi-page" data-testid="enterprise-bi-page">
      <header className="bi-page__header">
        <h1 className="bi-page__title">Enterprise BI</h1>
        {snapshot && (
          <p className="bi-page__subtitle">
            Snapshot gerado em {formatDate(snapshot.generatedAt)} —{' '}
            {snapshot.datasetCount ?? '?'} datasets,{' '}
            {snapshot.rowCount ?? '?'} registros
          </p>
        )}
      </header>

      <div className="bi-page__content">
        <section className="bi-page__section" data-testid="section-executive">
          <SectionHeader
            title="Resumo Executivo"
            description="Indicadores consolidados de desempenho operacional."
          />
          <ExecutiveSummaryCards dataset={executive} />
        </section>

        <section className="bi-page__section" data-testid="section-regional">
          <SectionHeader
            title="Desempenho Regional"
            description="Comparação de indicadores por região."
          />
          <RegionalPerformanceTable dataset={regional} />
        </section>

        <div className="bi-page__panels">
          <PanelCard title="Saúde do Inventário">
            <InventoryHealthPanel dataset={inventory} />
          </PanelCard>

          <PanelCard title="Qualidade de Dados">
            <QualityOverviewPanel dataset={quality} />
          </PanelCard>

          <PanelCard title="Governança">
            <GovernanceOverviewPanel dataset={governance} />
          </PanelCard>
        </div>

        <section className="bi-page__section" data-testid="section-export">
          <SectionHeader
            title="Exportar"
            description="Gere relatórios em JSON ou CSV. PDF e XLSX estarão disponíveis em versões futuras."
          />
          <ExportPanel defaultProfile="executive-summary" />
        </section>
      </div>
    </div>
  );
}
