import { memo } from 'react';

const EMPTY_SEVERITY_OVERVIEW = {
  critical: { count: 0, cor: 'var(--v4p-danger)',  label: 'Critico' },
  high:     { count: 0, cor: 'var(--v4p-warning)', label: 'Alto' },
  medium:   { count: 0, cor: 'var(--v4p-warning)', label: 'Medio' },
  low:      { count: 0, cor: 'var(--v4p-text-4)',  label: 'Baixo' },
  info:     { count: 0, cor: 'var(--v4p-info)',    label: 'Informativo' },
};

function AlertSeverityOverview({ severityOverview = EMPTY_SEVERITY_OVERVIEW, totals = null }) {
  const safeSev = severityOverview && typeof severityOverview === 'object' ? severityOverview : EMPTY_SEVERITY_OVERVIEW;
  const total = Object.values(safeSev).reduce((s, v) => s + (v?.count ?? 0), 0);

  return (
    <div className="v4p-surface-card v4p-medium-panel">
      <div className="v4p-medium-panel__header">
        <div className="v4p-card-title">Distribuição por severidade</div>
      </div>

      <div className="v4p-severity-strip">
        {Object.values(safeSev).map(sev => (
          sev?.count > 0 && (
            <div
              key={sev.label}
              title={`${sev.label}: ${sev.count}`}
              className="v4p-severity-strip__segment"
              style={{ '--v4p-segment-flex': sev.count, '--v4p-accent-dynamic': sev.cor }}
            />
          )
        ))}
        {total === 0 && (
          <div className="v4p-severity-strip__segment v4p-severity-strip__segment--empty" style={{ '--v4p-segment-flex': 1, '--v4p-accent-dynamic': 'var(--v4p-border)' }} />
        )}
      </div>

      <div className="v4p-micro-kpi-grid" style={{ '--v4p-kpi-cols': 3 }}>
        {Object.entries(safeSev).map(([key, sev]) => (
          <div key={key} className="v4p-micro-kpi" style={{ '--v4p-accent-dynamic': sev?.cor }}>
            <div className="v4p-micro-kpi__value v4p-micro-kpi__value--lg">{sev?.count ?? 0}</div>
            <div className="v4p-chip v4p-chip--sm" style={{ '--v4p-pill-color': sev?.cor, '--v4p-pill-border': `color-mix(in srgb, ${sev?.cor} 34%, transparent)`, '--v4p-pill-bg': `color-mix(in srgb, ${sev?.cor} 12%, transparent)` }}>{sev?.label}</div>
          </div>
        ))}
      </div>

      <div className="v4p-card-header v4p-alert-summary">
        <span>Total: <strong>{total} alerta{total !== 1 ? 's' : ''}</strong></span>
        <span>Não lidos: <strong>{totals?.open ?? 0}</strong></span>
      </div>
    </div>
  );
}

export default memo(AlertSeverityOverview);
