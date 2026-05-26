import { memo } from 'react';

const EMPTY_REVENUE_FORECAST = {
  metaAnual: 0,
  realizadoAnual: 0,
  projetadoAnual: 0,
  percentMeta: 0,
  receitaRecorrente: 0,
  crescimentoMoM: 0,
  trimestres: [],
  meses: [],
};

function QuarterRow({ q }) {
  const hasReal = q.realizado != null;
  const pct = hasReal ? Math.round((q.realizado / q.meta) * 100) : null;
  const value = hasReal ? q.realizado : q.projetado;
  const progress = Math.min((value / q.meta) * 100, 100);
  const fmt = (v) => `R$ ${(v / 1000).toFixed(0)}k`;
  const color = !hasReal ? 'var(--v4p-accent)' : pct >= 100 ? 'var(--v4p-success)' : 'var(--v4p-warning)';

  return (
    <div className="v4p-list-item v4p-forecast-row">
      <span className="v4p-list-item__title">{q.label}</span>
      <div className="v4p-progress-track" style={{ '--v4p-progress': `${progress}%`, '--v4p-accent-dynamic': color }}>
        <div className="v4p-progress-fill" />
      </div>
      <span className="v4p-value-stack__main" style={{ '--v4p-accent-dynamic': color }}>
        {hasReal ? fmt(q.realizado) : `~${fmt(q.projetado)}`}
      </span>
      <span className="v4p-list-item__meta">{pct != null ? `${pct}%` : 'proj.'}</span>
    </div>
  );
}

function MiniChart({ meses }) {
  const max = Math.max(...meses.map(m => m.valor), 1);

  return (
    <div className="v4p-chart-bars" style={{ '--v4p-chart-h': '50px' }}>
      {meses.map((m, i) => {
        const barH = (m.valor / max) * 38;
        const color = m.projetado ? 'rgba(116,133,255,0.35)' : 'var(--v4p-accent)';
        const aboveMeta = m.valor >= m.meta;
        return (
          <div key={i} title={`${m.label}: R$ ${(m.valor / 1000).toFixed(0)}k`} className="v4p-chart-bar">
            <div
              className="v4p-chart-bar__fill"
              style={{
                '--v4p-bar-h': `${barH}px`,
                '--v4p-accent-dynamic': color,
                '--v4p-bar-border': aboveMeta ? '1px solid var(--v4p-success)' : '0',
              }}
            />
            <span className="v4p-chart-label">{m.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function RevenueForecast({ forecast = EMPTY_REVENUE_FORECAST }) {
  const { metaAnual, realizadoAnual, projetadoAnual, percentMeta, receitaRecorrente, crescimentoMoM, trimestres, meses } = forecast;
  const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

  return (
    <div className="v4p-surface-card v4p-medium-panel">
      <div className="v4p-medium-panel__header">
        <div className="v4p-card-title">Projeção de receita</div>
      </div>

      <div className="v4p-micro-kpi-grid" style={{ '--v4p-kpi-cols': 3 }}>
        {[
          { l: 'Realizado', v: fmt(realizadoAnual), c: 'var(--v4p-text-1)' },
          { l: 'Projeção anual', v: fmt(projetadoAnual), c: 'var(--v4p-accent)' },
          { l: 'Meta anual', v: fmt(metaAnual), c: 'var(--v4p-text-3)' },
          { l: 'Atingimento', v: `${Math.round(percentMeta * 100)}%`, c: percentMeta >= 0.9 ? 'var(--v4p-success)' : 'var(--v4p-warning)' },
          { l: 'Recorrente', v: fmt(receitaRecorrente), c: 'var(--v4p-success)' },
          { l: 'Crescimento MoM', v: `+${Math.round(crescimentoMoM * 100)}%`, c: 'var(--v4p-success)' },
        ].map(s => (
          <div key={s.l} className="v4p-micro-kpi" style={{ '--v4p-accent-dynamic': s.c }}>
            <div className="v4p-micro-kpi__value">{s.v}</div>
            <div className="v4p-micro-kpi__label">{s.l}</div>
          </div>
        ))}
      </div>

      <div className="v4p-sparkline-block">
        <div className="v4p-section-label">Evolução mensal</div>
        {meses.length === 0 ? (
          <div className="v4p-list-item__copy">Nenhuma serie mensal encontrada.</div>
        ) : (
          <MiniChart meses={meses} />
        )}
        <div className="v4p-chart-legend">
          <div className="v4p-chart-legend__item"><span className="v4p-chart-legend__swatch" style={{ '--v4p-accent-dynamic': 'var(--v4p-accent)' }} />Realizado</div>
          <div className="v4p-chart-legend__item"><span className="v4p-chart-legend__swatch" style={{ '--v4p-accent-dynamic': 'rgba(116,133,255,0.35)', '--v4p-swatch-border': '1px dashed rgba(116,133,255,0.5)' }} />Projetado</div>
          <div className="v4p-chart-legend__item"><span className="v4p-chart-legend__swatch" style={{ '--v4p-accent-dynamic': 'transparent', '--v4p-swatch-border': '1px solid var(--v4p-success)' }} />Acima da meta</div>
        </div>
      </div>

      <div className="v4p-section-label">Por trimestre</div>
      <div className="v4p-compact-list">
        {trimestres.length === 0 && (
          <div className="v4p-list-item__copy">Nenhum trimestre encontrado.</div>
        )}
        {trimestres.map(q => <QuarterRow key={q.label} q={q} />)}
      </div>
    </div>
  );
}

export default memo(RevenueForecast);
