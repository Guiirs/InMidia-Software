import { memo } from 'react';
import { EXECUTIVE_SUMMARY } from '../../pages/dashboard/dashboardInsights.js';
import { getStateMeta } from '../../foundation/operationalStates.js';

const STATE_ICON = {
  healthy: 'check_circle',
  warning: 'warning',
  critical: 'error',
};

function SummaryBlock({ block }) {
  const meta = getStateMeta(block.estado);
  const icon = STATE_ICON[block.estado] ?? 'info';

  return (
    <div
      style={{
        padding: '12px 14px',
        borderRadius: 'var(--v4p-r-md)',
        background: 'rgba(0,0,0,0.12)',
        border: `1px solid ${meta.colorSoft}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          aria-hidden="true"
          className="material-symbols-rounded"
          style={{
            fontSize: 15,
            color: meta.color,
            lineHeight: 1,
          }}
        >
          {icon}
        </span>
        <span className="v4p-chip v4p-chip--sm" style={{ color: meta.color, borderColor: `color-mix(in srgb, ${meta.color} 34%, transparent)`, background: `color-mix(in srgb, ${meta.color} 12%, transparent)` }}>
          {block.titulo}
        </span>
      </div>

      {block.texto ? (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--v4p-text-2)', lineHeight: 1.6 }}>
          {block.texto}
        </p>
      ) : (
        <ul style={{ margin: 0, padding: '0 0 0 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {block.itens?.map((item, i) => (
            <li key={i} style={{ fontSize: 12, color: 'var(--v4p-text-2)', lineHeight: 1.55 }}>
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ExecutiveSummary() {
  const blocks = [
    EXECUTIVE_SUMMARY.situacao,
    EXECUTIVE_SUMMARY.riscos,
    EXECUTIVE_SUMMARY.oportunidades,
    EXECUTIVE_SUMMARY.recomendacoes,
  ];

  return (
    <div
      className="v4p-surface-card"
      style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 10, borderBottom: '1px solid var(--v4p-border-soft)' }}>
        <span
          aria-hidden="true"
          className="material-symbols-rounded"
          style={{ fontSize: 16, color: 'var(--v4p-intelligence)' }}
        >
          insights
        </span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--v4p-text-2)' }}>Análise executiva</div>
          <div style={{ fontSize: 10, color: 'var(--v4p-text-4)' }}>Inteligência operacional automatizada — 19 Mai 2026</div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <span className="v4p-chip v4p-chip--sm" style={{ background: 'var(--v4p-intelligence-soft)', borderColor: 'var(--v4p-border-accent)', color: 'var(--v4p-intelligence)' }}>
            <span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--v4p-intelligence)', display: 'inline-block' }} />
            INTELIGÊNCIA ATIVA
          </span>
        </div>
      </div>

      {/* Blocos 2x2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {blocks.map((block, i) => (
          <SummaryBlock key={i} block={block} />
        ))}
      </div>
    </div>
  );
}

export default memo(ExecutiveSummary);
