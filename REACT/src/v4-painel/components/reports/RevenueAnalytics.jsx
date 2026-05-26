import { memo } from 'react';

function RevenueAnalytics({ revenue = null, performance = null }) {
  if (!revenue) {
    const history = performance?.history ?? [];
    const values = history.map((d) => d.receita);
    const hasData = values.length >= 2;

    return (
      <div className="v4p-surface-card v4p-medium-panel">
        <div className="v4p-medium-panel__header">
          <div className="v4p-card-title">Analytics de receita</div>
        </div>
        {!hasData ? (
          <div style={{ padding: '20px 0', color: 'var(--v4p-text-4)', fontSize: 12 }}>
            Sem dados de receita disponíveis.
          </div>
        ) : (() => {
          const w = 300; const h = 50; const pad = 4;
          const max = Math.max(...values, 1);
          const min = Math.min(...values, 0);
          const toX = (i) => pad + (i / (values.length - 1)) * (w - pad * 2);
          const toY = (v) => h - pad - ((v - min) / Math.max(max - min, 1)) * (h - pad * 2);
          const pathD = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(v)}`).join(' ');
          const areaD = `M${toX(0)},${h} ${values.map((v, i) => `L${toX(i)},${toY(v)}`).join(' ')} L${toX(values.length - 1)},${h} Z`;
          return (
            <div className="v4p-sparkline-block">
              <div className="v4p-section-label">Atividade no período (contratos)</div>
              <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="ra-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--v4p-success)" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="var(--v4p-success)" stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                <path d={areaD} fill="url(#ra-grad)" />
                <path d={pathD} fill="none" stroke="var(--v4p-success)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                <circle cx={toX(values.length - 1)} cy={toY(values[values.length - 1])} r={3.5} fill="var(--v4p-success)" />
              </svg>
            </div>
          );
        })()}
      </div>
    );
  }

  const { totalAno, mediasMensal, maiorMes, menorMes, crescimentoTotal, receitaRecorrente, receitaNova, churnEstimado } = revenue;
  const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v ?? 0);

  const history = performance?.history ?? [];
  const values = history.map((d) => d.receita);
  const hasSparkline = values.length >= 2;
  const w = 300; const h = 50; const pad = 4;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const toX = (i) => pad + (i / (values.length - 1)) * (w - pad * 2);
  const toY = (v) => h - pad - ((v - min) / Math.max(max - min, 1)) * (h - pad * 2);
  const pathD = hasSparkline ? values.map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(v)}`).join(' ') : '';
  const areaD = hasSparkline ? `M${toX(0)},${h} ${values.map((v, i) => `L${toX(i)},${toY(v)}`).join(' ')} L${toX(values.length - 1)},${h} Z` : '';

  return (
    <div className="v4p-surface-card v4p-medium-panel">
      <div className="v4p-medium-panel__header">
        <div className="v4p-card-title">Analytics de receita</div>
      </div>

      <div className="v4p-micro-kpi-grid" style={{ '--v4p-kpi-cols': 3 }}>
        {[
          { l: 'Total no período', v: revenue.totalAnoLabel ?? fmt(totalAno), c: 'var(--v4p-text-1)' },
          { l: 'Média mensal', v: revenue.mediasMensalLabel ?? fmt(mediasMensal), c: 'var(--v4p-accent)' },
          { l: 'Crescimento', v: crescimentoTotal ?? '—', c: 'var(--v4p-success)' },
          { l: 'Recorrente', v: revenue.receitaRecorrenteLabel ?? fmt(receitaRecorrente), c: 'var(--v4p-success)' },
          { l: 'Nova receita', v: revenue.receitaNovaLabel ?? fmt(receitaNova), c: 'var(--v4p-accent)' },
          { l: 'Churn estimado', v: revenue.churnEstimadoLabel ?? fmt(churnEstimado), c: 'var(--v4p-danger)' },
        ].map((s) => (
          <div key={s.l} className="v4p-micro-kpi" style={{ '--v4p-accent-dynamic': s.c }}>
            <div className="v4p-micro-kpi__value">{s.v}</div>
            <div className="v4p-micro-kpi__label">{s.l}</div>
          </div>
        ))}
      </div>

      {hasSparkline && (
        <div className="v4p-sparkline-block">
          <div className="v4p-section-label">Evolução de receita</div>
          <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" preserveAspectRatio="none">
            <defs>
              <linearGradient id="ra-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--v4p-success)" stopOpacity="0.25" />
                <stop offset="100%" stopColor="var(--v4p-success)" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <path d={areaD} fill="url(#ra-grad)" />
            <path d={pathD} fill="none" stroke="var(--v4p-success)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={toX(values.length - 1)} cy={toY(values[values.length - 1])} r={3.5} fill="var(--v4p-success)" />
          </svg>
        </div>
      )}

      {maiorMes && menorMes && (
        <div className="v4p-medium-grid v4p-medium-grid--2">
          <div className="v4p-accent-card v4p-accent-card--stack" style={{ '--v4p-accent-dynamic': 'var(--v4p-success)' }}>
            <div className="v4p-card-subtitle">Maior mês · {maiorMes.mes}</div>
            <div className="v4p-value-stack__main">{revenue.maiorMesLabel ?? fmt(maiorMes.valor)}</div>
          </div>
          <div className="v4p-micro-kpi">
            <div className="v4p-card-subtitle">Menor mês · {menorMes.mes}</div>
            <div className="v4p-micro-kpi__value">{revenue.menorMesLabel ?? fmt(menorMes.valor)}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(RevenueAnalytics);
