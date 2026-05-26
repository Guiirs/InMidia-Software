import { memo } from 'react';

function PerformanceAnalytics({ performance = null }) {
  const history = performance?.history ?? [];

  if (history.length === 0) {
    return (
      <div className="v4p-surface-card v4p-medium-panel">
        <div className="v4p-medium-panel__header">
          <div className="v4p-card-title">Evolução de desempenho · ciclo atual</div>
        </div>
        <div style={{ padding: '20px 0', color: 'var(--v4p-text-4)', fontSize: 12 }}>
          Sem histórico de desempenho disponível.
        </div>
      </div>
    );
  }

  const values = history.map((d) => d.receita);
  const maxVal = Math.max(...values, 1);
  const h = 80;
  const isCountData = maxVal < 1000;
  const fmt = isCountData
    ? (v) => `${v}`
    : (v) => `R$ ${(v / 1000).toFixed(0)}k`;

  return (
    <div className="v4p-surface-card v4p-medium-panel">
      <div className="v4p-medium-panel__header">
        <div className="v4p-card-title">Evolução de desempenho · ciclo atual</div>
      </div>

      <div className="v4p-chart-bars" style={{ '--v4p-chart-h': `${h + 20}px` }}>
        {history.map((d, i) => {
          const barH = (d.receita / maxVal) * h;
          const isLast = i === history.length - 1;
          return (
            <div key={d.mes} title={`${d.mes}: ${fmt(d.receita)}`} className="v4p-chart-bar">
              <span className="v4p-chart-label">{fmt(d.receita)}</span>
              <div
                className="v4p-chart-bar__fill"
                style={{
                  '--v4p-bar-h': `${barH}px`,
                  '--v4p-accent-dynamic': isLast ? 'var(--v4p-success)' : 'var(--v4p-accent)',
                  '--v4p-bar-opacity': isLast ? 1 : 0.75,
                  '--v4p-bar-border': isLast ? '1px solid var(--v4p-success-border)' : '0',
                }}
              />
              <span className="v4p-chart-label">{d.mes}</span>
            </div>
          );
        })}
      </div>

      <div className="v4p-micro-kpi-grid" style={{ '--v4p-kpi-cols': 4 }}>
        {[
          { l: 'Crescimento', v: performance?.growthLabel ?? '—', c: 'var(--v4p-success)' },
          { l: 'Pico do período', v: performance?.peakRevenueLabel ?? '—', c: 'var(--v4p-text-1)' },
          { l: 'Média', v: performance?.averageRevenueLabel ?? '—', c: 'var(--v4p-text-1)' },
          { l: 'Ocupação', v: performance?.occupancyLabel ?? '—', c: 'var(--v4p-accent)' },
        ].map((s) => (
          <div key={s.l} className="v4p-micro-kpi v4p-micro-kpi--center" style={{ '--v4p-accent-dynamic': s.c }}>
            <div className="v4p-micro-kpi__value v4p-micro-kpi__value--lg">{s.v}</div>
            <div className="v4p-micro-kpi__label">{s.l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(PerformanceAnalytics);
