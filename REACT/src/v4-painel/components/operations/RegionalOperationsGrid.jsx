import { memo } from 'react';
import { getStateMeta } from '../../foundation/operationalStates.js';

function RegionCard({ region }) {
  const meta = getStateMeta(region.estado);
  const pct = Math.round(region.ocupacao * 100);
  const barColor = pct >= 80 ? 'var(--v4p-success)' : pct >= 70 ? 'var(--v4p-accent)' : pct >= 60 ? 'var(--v4p-warning)' : 'var(--v4p-danger)';
  const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
  const trendColor = region.tendencia === 'crescimento' ? 'var(--v4p-success)' : region.tendencia === 'queda' ? 'var(--v4p-danger)' : 'var(--v4p-text-4)';
  const trendIcon = region.tendencia === 'crescimento' ? '↑' : region.tendencia === 'queda' ? '↓' : '→';

  return (
    <div className="v4p-surface-card v4p-accent-card v4p-accent-card--stack v4p-accent-card--top" style={{ '--v4p-accent-dynamic': meta.color }}>
      <div className="v4p-card-header">
        <div className="v4p-list-item__content">
          <div className="v4p-region-title">
            <span className="v4p-region-title__sigla">{region.sigla}</span>
            <span className="v4p-list-item__title">{region.label}</span>
          </div>
          <div className="v4p-list-item__copy">{region.responsavel} · sync {region.ultimaSync}</div>
        </div>
        {region.alertas > 0 && (
          <span className="v4p-chip v4p-chip--sm v4p-chip--danger">
            {region.alertas} alerta{region.alertas !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="v4p-progress-row" style={{ '--v4p-progress': `${pct}%`, '--v4p-accent-dynamic': barColor }}>
        <span className="v4p-detail-row__label">Ocupação</span>
        <div className="v4p-progress-row__track">
          <div className="v4p-progress-row__fill" />
        </div>
        <span className="v4p-progress-row__value">{pct}%</span>
      </div>

      <div className="v4p-micro-kpi-grid" style={{ '--v4p-kpi-cols': 3 }}>
        {[
          { l: 'Ativos', v: region.ativos },
          { l: 'Livres', v: region.disponiveis },
          { l: 'Manutenção', v: region.emManutencao },
        ].map(s => (
          <div key={s.l} className="v4p-micro-kpi v4p-micro-kpi--center">
            <div className="v4p-micro-kpi__value">{s.v}</div>
            <div className="v4p-micro-kpi__label">{s.l}</div>
          </div>
        ))}
      </div>

      <div className="v4p-card-header">
        <span className="v4p-value-stack__main">{fmt(region.receitaAtiva)}</span>
        <span className="v4p-list-item__meta" style={{ color: trendColor }}>{trendIcon} {region.tendencia}</span>
      </div>
    </div>
  );
}

function RegionalOperationsGrid({ regions = [] }) {
  return (
    <div>
      <div className="v4p-medium-panel__header">
        <div>
          <div className="v4p-card-title">Operações por região</div>
          <div className="v4p-card-subtitle">Ocupação, disponibilidade e receita em tempo real</div>
        </div>
      </div>
      {regions.length === 0 ? (
        <div style={{ padding: '20px 0', color: 'var(--v4p-text-4)', fontSize: 12 }}>
          Sem dados de desempenho regional disponíveis.
        </div>
      ) : (
        <div className="v4p-medium-grid v4p-medium-grid--3">
          {regions.map(r => <RegionCard key={r.id} region={r} />)}
        </div>
      )}
    </div>
  );
}

export default memo(RegionalOperationsGrid);
