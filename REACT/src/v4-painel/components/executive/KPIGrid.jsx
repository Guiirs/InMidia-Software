import { memo } from 'react';
import { getStateMeta } from '../../foundation/operationalStates.js';

function KPICard({ kpi }) {
  const meta = getStateMeta(kpi.state);
  const trendColor = kpi.trendUp ? 'var(--v4p-success)' : 'var(--v4p-danger)';
  const trendIcon  = kpi.trendUp ? 'trending_up' : 'trending_down';

  return (
    <article
      className="v4p-surface-card v4p-animate-in"
      style={{
        padding: '14px 16px',
        borderLeft: kpi.highlight ? `3px solid ${meta.color}` : '3px solid transparent',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        transition: 'border-color var(--v4p-t-base)',
      }}
    >
      {/* Linha superior: ícone + label */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span className="v4p-label">{kpi.label}</span>
        <span
          aria-hidden="true"
          className="material-symbols-rounded"
          style={{
            fontSize: 17,
            color: kpi.highlight ? meta.color : 'var(--v4p-text-4)',
            lineHeight: 1,
          }}
        >
          {kpi.icon}
        </span>
      </div>

      {/* Valor principal */}
      <div className="v4p-metric" style={{ color: kpi.highlight ? meta.color : 'var(--v4p-text-1)' }}>
        {kpi.value}
      </div>

      {/* Tendência + período */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 2,
            fontSize: 11,
            fontWeight: 600,
            color: trendColor,
          }}
        >
          <span
            aria-hidden="true"
            className="material-symbols-rounded"
            style={{ fontSize: 13 }}
          >
            {trendIcon}
          </span>
          {kpi.trend}
        </span>
        <span style={{ fontSize: 11, color: 'var(--v4p-text-4)' }}>{kpi.period}</span>
      </div>
    </article>
  );
}

function KPIGrid({ kpis = [] }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 10,
      }}
    >
      {kpis.map(kpi => (
        <KPICard key={kpi.id} kpi={kpi} />
      ))}
    </div>
  );
}

export default memo(KPIGrid);
