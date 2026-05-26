import React from 'react';
import { formatPercent, formatCount, formatScore, metricValue, scoreClass } from '../utils/biFormatters';

function KPICard({ label, value, unit, className }) {
  return (
    <div className={`bi-kpi-card bi-kpi-card--${className ?? 'default'}`} data-testid="bi-kpi-card">
      <span className="bi-kpi-card__value">{value}</span>
      {unit && <span className="bi-kpi-card__unit">{unit}</span>}
      <span className="bi-kpi-card__label">{label}</span>
    </div>
  );
}

export default function ExecutiveSummaryCards({ dataset }) {
  if (!dataset) {
    return (
      <div className="bi-executive-cards bi-executive-cards--empty" data-testid="executive-summary-cards">
        <p className="bi-panel__empty">Resumo executivo indisponível.</p>
      </div>
    );
  }

  const metrics = dataset.metrics ?? [];
  const rows = dataset.rows ?? [];
  const firstRow = rows[0];

  const totalPlacas = metricValue(metrics, 'total_placas') ?? metricValue(metrics, 'totalPlacas');
  const occupancy = firstRow?.occupancyRate ?? metricValue(metrics, 'occupancy_rate') ?? metricValue(metrics, 'occupancyRate');
  const availability = metricValue(metrics, 'availability_rate') ?? metricValue(metrics, 'availabilityRate');
  const qualityScore = firstRow?.qualityScore ?? metricValue(metrics, 'quality_score') ?? metricValue(metrics, 'qualityScore');
  const regioesCount = metricValue(metrics, 'regioes_count') ?? metricValue(metrics, 'regioesCount');
  const conflicts = metricValue(metrics, 'conflicts') ?? metricValue(metrics, 'conflictsCount');
  const mediaValid = metricValue(metrics, 'media_valid_percent') ?? metricValue(metrics, 'mediaValidPercent');
  const governanceScore = firstRow?.governanceScore ?? metricValue(metrics, 'governance_score') ?? metricValue(metrics, 'governanceScore');

  const completeness = dataset.completeness ?? 'complete';

  return (
    <div className="bi-executive-cards" data-testid="executive-summary-cards">
      {completeness === 'partial' && (
        <div className="bi-panel__partial-notice" role="note">
          Dados parcialmente disponíveis — alguns indicadores podem estar incompletos.
        </div>
      )}
      <div className="bi-kpi-grid">
        <KPICard label="Total de Placas" value={formatCount(totalPlacas)} className="neutral" />
        <KPICard label="Taxa de Ocupação" value={formatPercent(occupancy)} className={scoreClass(100 - (occupancy ?? 0))} />
        <KPICard label="Disponibilidade" value={formatPercent(availability)} className={scoreClass(availability ?? 0)} />
        <KPICard label="Qualidade Média" value={formatScore(qualityScore)} unit="/100" className={scoreClass(qualityScore)} />
        <KPICard label="Regiões Cobertas" value={formatCount(regioesCount)} className="neutral" />
        <KPICard label="Conflitos" value={formatCount(conflicts)} className={conflicts > 0 ? 'warning' : 'good'} />
        <KPICard label="Mídia Válida" value={formatPercent(mediaValid)} className={scoreClass(mediaValid ?? 0)} />
        <KPICard label="Score de Governança" value={formatScore(governanceScore)} unit="/100" className={scoreClass(governanceScore)} />
      </div>
    </div>
  );
}
