import { memo, useState } from 'react';

function PercentBar({ pct, color }) {
  return (
    <div className="v4p-progress-row" style={{ '--v4p-progress': `${Math.min(pct * 100, 100)}%`, '--v4p-accent-dynamic': color, '--v4p-progress-h': '4px' }}>
      <div className="v4p-progress-row__track">
        <div className="v4p-progress-row__fill" />
      </div>
      <span className="v4p-progress-row__value">{Math.round(pct * 100)}%</span>
    </div>
  );
}

function RegionalTable({ regionalPerformance = [] }) {
  const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

  return (
    <div className="v4p-compact-list">
      {regionalPerformance.length === 0 && (
        <div className="v4p-list-item__copy">Nenhum desempenho regional encontrado.</div>
      )}
      {regionalPerformance.map(r => {
        const metColor = r.percent >= 1 ? 'var(--v4p-success)' : r.percent >= 0.9 ? 'var(--v4p-accent)' : 'var(--v4p-warning)';
        const tendIcon = r.tendencia === 'alta' ? '↑' : r.tendencia === 'queda' ? '↓' : '→';
        const tendColor = r.tendencia === 'alta' ? 'var(--v4p-success)' : r.tendencia === 'queda' ? 'var(--v4p-danger)' : 'var(--v4p-text-4)';

        return (
          <div key={r.id} className="v4p-list-item v4p-perf-row">
            <span className="v4p-list-item__meta">#{r.rank}</span>
            <span className="v4p-list-item__title">{r.regiao.split(' ')[0]}</span>
            <PercentBar pct={r.percent} color={metColor} />
            <span className="v4p-value-stack__main">{fmt(r.receita)}</span>
            <span className="v4p-list-item__meta" style={{ color: tendColor }}>{tendIcon} {r.crescimento}</span>
            <span className="v4p-list-item__meta">{r.responsavel.split(' ')[0]}</span>
          </div>
        );
      })}
    </div>
  );
}

function SellersTable({ sellersPerformance = [] }) {
  const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

  return (
    <div className="v4p-compact-list">
      {sellersPerformance.length === 0 && (
        <div className="v4p-list-item__copy">Nenhum desempenho de vendedor encontrado.</div>
      )}
      {sellersPerformance.map(s => {
        const color = s.percent >= 1 ? 'var(--v4p-success)' : s.percent >= 0.9 ? 'var(--v4p-accent)' : 'var(--v4p-warning)';

        return (
          <div key={s.nome} className="v4p-list-item v4p-seller-row">
            <span className="v4p-list-item__meta">#{s.rank}</span>
            <div className="v4p-list-item__content">
              <div className="v4p-list-item__title">{s.nome}</div>
              <div className="v4p-list-item__copy">{s.regiao} · {s.contratos} contratos</div>
            </div>
            <PercentBar pct={s.percent} color={color} />
            <span className="v4p-value-stack__main">{fmt(s.receita)}</span>
          </div>
        );
      })}
    </div>
  );
}

function CommercialPerformance({ regionalPerformance = [], sellersPerformance = [] }) {
  const [tab, setTab] = useState('regional');

  return (
    <div className="v4p-surface-card v4p-medium-panel">
      <div className="v4p-medium-panel__header">
        <div className="v4p-card-title">Desempenho comercial</div>
        <div className="v4p-segmented">
          {[['regional', 'Regiões'], ['sellers', 'Vendedores']].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`v4p-segmented__button${tab === id ? ' v4p-segmented__button--active' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {tab === 'regional' ? <RegionalTable regionalPerformance={regionalPerformance} /> : <SellersTable sellersPerformance={sellersPerformance} />}
    </div>
  );
}

export default memo(CommercialPerformance);
