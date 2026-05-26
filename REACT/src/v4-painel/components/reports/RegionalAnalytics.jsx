import { memo } from 'react';

function RegionalAnalytics({ regional = null }) {
  const ranking = regional?.ranking ?? [];

  if (ranking.length === 0) {
    return (
      <div className="v4p-surface-card v4p-medium-panel">
        <div className="v4p-medium-panel__header">
          <div className="v4p-card-title">Analytics regional · comparativo</div>
        </div>
        <div style={{ padding: '20px 0', color: 'var(--v4p-text-4)', fontSize: 12 }}>
          Sem dados regionais disponíveis.
        </div>
      </div>
    );
  }

  const maxOcupacao = Math.max(...ranking.map((r) => r.ocupacao), 0.01);
  const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

  return (
    <div className="v4p-surface-card v4p-medium-panel">
      <div className="v4p-medium-panel__header">
        <div className="v4p-card-title">Analytics regional · comparativo</div>
      </div>

      <div className="v4p-bar-list">
        {ranking.map((r) => {
          const barW = (r.ocupacao / maxOcupacao) * 100;
          const ocPct = Math.round(r.ocupacao * 100);
          const hasRevenue = r.receita > 0;
          const hasMeta = r.meta > 0;
          const metPct = hasMeta ? Math.round((r.receita / r.meta) * 100) : null;
          const metColor = metPct === null ? 'var(--v4p-accent)'
            : metPct >= 100 ? 'var(--v4p-success)'
            : metPct >= 85 ? 'var(--v4p-accent)'
            : 'var(--v4p-warning)';
          const tendColor = r.crescimento > 0 ? 'var(--v4p-success)'
            : r.crescimento < 0 ? 'var(--v4p-danger)'
            : 'var(--v4p-text-4)';

          return (
            <div key={r.regiao} className="v4p-bar-list__item" style={{ '--v4p-progress': `${barW}%`, '--v4p-accent-dynamic': metColor }}>
              <div className="v4p-bar-list__row">
                <span className="v4p-bar-list__label">{r.regiao.split(' ')[0]}</span>
                <div className="v4p-bar-list__track">
                  <div className="v4p-bar-list__fill" style={{ '--v4p-accent-dynamic': 'var(--v4p-accent)' }}>
                    <span className="v4p-bar-list__value">{hasRevenue ? fmt(r.receita) : `${ocPct}% ocup.`}</span>
                  </div>
                </div>
                <span className="v4p-bar-list__score">{metPct !== null ? `${metPct}%` : `${ocPct}%`}</span>
              </div>
              <div className="v4p-bar-list__meta">
                <span>Ocupação: <strong>{ocPct}%</strong></span>
                <span>Pontos: <strong>{r.pontos}</strong></span>
                {r.crescimento !== 0 && (
                  <span style={{ color: tendColor }}>{r.crescimento > 0 ? '+' : ''}{Math.round(r.crescimento * 100)}% MoM</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default memo(RegionalAnalytics);
