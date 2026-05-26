import { memo } from 'react';
import { OPERATIONAL_RECOMMENDATIONS } from '../../pages/dashboard/dashboardInsights.js';
import { getStateMeta } from '../../foundation/operationalStates.js';

const TIPO_BADGE_COLOR = {
  urgente:    'var(--v4p-danger)',
  comercial:  'var(--v4p-accent)',
  renovacao:  'var(--v4p-warning)',
  regional:   'var(--v4p-info)',
  estrategico:'var(--v4p-intelligence)',
};

function RecCard({ rec }) {
  const stateMeta  = getStateMeta(rec.estado);
  const tipoColor  = TIPO_BADGE_COLOR[rec.tipo] ?? 'var(--v4p-text-4)';

  return (
    <div
      style={{
        padding: '12px 14px',
        borderRadius: 'var(--v4p-r-md)',
        background: 'rgba(0,0,0,0.12)',
        border: `1px solid ${stateMeta.colorSoft}`,
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
      }}
    >
      {/* Ícone */}
      <div
        style={{
          width: 32, height: 32,
          borderRadius: 'var(--v4p-r-md)',
          background: `${tipoColor}18`,
          border: `1px solid ${tipoColor}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <span
          aria-hidden="true"
          className="material-symbols-rounded"
          style={{
            fontSize: 16,
            color: tipoColor, lineHeight: 1,
          }}
        >
          {rec.icone}
        </span>
      </div>

      {/* Conteúdo */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--v4p-text-1)', lineHeight: 1.3 }}>
            {rec.titulo}
          </span>
          <span className="v4p-chip v4p-chip--sm" style={{
            color: tipoColor,
            borderColor: `color-mix(in srgb, ${tipoColor} 34%, transparent)`,
            background: `color-mix(in srgb, ${tipoColor} 12%, transparent)`,
          }}>
            {rec.tipo}
          </span>
        </div>
        <p style={{ margin: '0 0 6px', fontSize: 11, color: 'var(--v4p-text-3)', lineHeight: 1.5 }}>
          {rec.descricao}
        </p>
        <div className="v4p-chip-row" style={{ gap: 5 }}>
          <span className="v4p-chip v4p-chip--sm v4p-chip--success">{rec.impacto}</span>
          <span className="v4p-chip v4p-chip--sm v4p-chip--neutral">Prazo: {rec.prazo}</span>
          <span className="v4p-chip v4p-chip--sm v4p-chip--neutral" style={{ textTransform: 'capitalize' }}>{rec.categoria}</span>
        </div>
      </div>
    </div>
  );
}

function OperationalRecommendations() {
  return (
    <div className="v4p-surface-card" style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid var(--v4p-border-soft)' }}>
        <span aria-hidden="true" className="material-symbols-rounded" style={{ fontSize: 16, color: 'var(--v4p-intelligence)' }}>auto_awesome</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--v4p-text-2)' }}>Recomendações</div>
          <div style={{ fontSize: 10, color: 'var(--v4p-text-4)' }}>Ações prioritárias identificadas automaticamente</div>
        </div>
        <span className="v4p-chip v4p-chip--sm" style={{
          marginLeft: 'auto',
          background: 'var(--v4p-intelligence-soft)', color: 'var(--v4p-intelligence)',
          borderColor: 'rgba(139,92,246,0.25)',
        }}>
          IA ATIVA
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {OPERATIONAL_RECOMMENDATIONS.map(rec => (
          <RecCard key={rec.id} rec={rec} />
        ))}
      </div>
    </div>
  );
}

export default memo(OperationalRecommendations);
