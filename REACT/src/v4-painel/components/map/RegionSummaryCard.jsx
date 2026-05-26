import { memo } from 'react';

function money(value) {
  if (value == null) return null;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function pct(value) {
  if (value == null) return null;
  const n = Number(value);
  return `${Math.round(n > 1 ? n : n * 100)}%`;
}

function percentValue(value) {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n > 1 ? n : n * 100);
}

function shortDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(date);
}

function slaHealthLabel(value) {
  if (value === 'CRITICAL') return 'Crítica';
  if (value === 'ATTENTION') return 'Atenção';
  if (value === 'HEALTHY') return 'Saudável';
  return 'Indefinida';
}

function MetricTile({ label, value }) {
  return (
    <div className="v4p-region-summary__tile">
      <strong className="v4p-region-summary__tile-val">
        {value != null ? value : <span className="v4p-region-summary__na">—</span>}
      </strong>
      <span className="v4p-region-summary__tile-label">{label}</span>
    </div>
  );
}

function RegionSummaryCard({ summary, regionName }) {
  if (!summary) return null;

  const occupancyRaw = percentValue(summary.occupancyRate);
  const occupancyPct = pct(summary.occupancyRate);
  const activeRevenue = money(summary.activeRevenue);
  const futureRevenue = money(summary.futureRevenue);

  return (
    <div className="v4p-region-summary" aria-label={`Resumo da regiao ${regionName ?? ''}`}>
      <div className="v4p-region-summary__context">
        <span className="v4p-region-summary__eyebrow">Resumo regional</span>
        {regionName && (
          <span className="v4p-region-summary__region-name">{regionName}</span>
        )}
      </div>

      {occupancyRaw != null && (
        <div className="v4p-region-summary__occ" aria-label={`${occupancyRaw}% ocupação`}>
          <div className="v4p-region-summary__occ-label">
            <span>Ocupação</span>
            <strong
              className={
                occupancyRaw >= 75
                  ? 'is-healthy'
                  : occupancyRaw >= 45
                    ? 'is-warning'
                    : 'is-critical'
              }
            >
              {occupancyRaw}%
            </strong>
          </div>
          <div className="v4p-region-summary__occ-track">
            <div
              className="v4p-region-summary__occ-fill"
              style={{ '--occ': `${occupancyRaw}%` }}
              role="presentation"
            />
          </div>
        </div>
      )}

      <div className="v4p-region-summary__groups">
        <div className="v4p-region-summary__group">
          <span className="v4p-region-summary__group-label">Disponibilidade</span>
          <div className="v4p-region-summary__tiles">
            <MetricTile label="Total" value={summary.totalPlates} />
            <MetricTile label="Disponíveis" value={summary.availablePlates} />
            <MetricTile label="Bloqueadas" value={summary.blockedPlates} />
          </div>
        </div>

        <div className="v4p-region-summary__group">
          <span className="v4p-region-summary__group-label">Comercial</span>
          <div className="v4p-region-summary__tiles">
            <MetricTile label="Reservadas" value={summary.reservedPlates} />
            <MetricTile label="Contratadas" value={summary.contractedPlates} />
            <MetricTile label="Receita ativa" value={activeRevenue} />
            <MetricTile label="Receita futura" value={futureRevenue} />
          </div>
        </div>

        <div className="v4p-region-summary__group">
          <span className="v4p-region-summary__group-label">Operacional</span>
          <div className="v4p-region-summary__tiles">
            <MetricTile label="Contratos ativos" value={summary.activeContracts} />
            <MetricTile label="Ops. pendentes" value={summary.pendingOperations} />
            <MetricTile label="Instalacoes" value={summary.pendingInstallations} />
            <MetricTile label="Raspagens" value={summary.pendingScrapings} />
            <MetricTile label="Manutencoes" value={summary.pendingMaintenances} />
            <MetricTile label="Vencendo" value={summary.endingContracts} />
            <MetricTile label="Saúde SLA" value={slaHealthLabel(summary.slaHealth)} />
            <MetricTile label="Backlog crítico" value={summary.criticalBacklog ?? 0} />
            <MetricTile label="Próximo prazo" value={shortDate(summary.nextSlaDueAt) ?? 'Sem prazo'} />
            {summary.alertsCount > 0 && (
              <MetricTile label="Alertas" value={summary.alertsCount} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(RegionSummaryCard);
