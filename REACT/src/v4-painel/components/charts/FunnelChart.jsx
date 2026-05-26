import { memo } from 'react';

/* Funil visual em forma de pirâmide invertida */
function FunnelChart({ stages = [], compact = false }) {
  if (stages.length === 0) {
    return <div style={{ fontSize: 12, color: 'var(--v4p-text-4)', padding: '8px 0' }}>Sem dados de funil.</div>;
  }
  const max = stages[0].count;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      {stages.map((stage, i) => {
        const widthPct = 40 + (stage.count / max) * 60;
        const isLast = i === stages.length - 1;

        return (
          <div key={stage.id} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            {/* Bloco do funil */}
            <div
              style={{
                width: `${widthPct}%`,
                padding: compact ? '6px 10px' : '8px 12px',
                background: stage.cor,
                borderRadius: 'var(--v4p-r-sm)',
                opacity: 0.85,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'width 0.6s var(--v4p-ease)',
              }}
            >
              <span style={{ fontSize: compact ? 10 : 11, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {stage.label}
              </span>
              <span style={{ fontSize: compact ? 11 : 13, fontWeight: 800, color: '#fff', flexShrink: 0, marginLeft: 6 }}>
                {stage.count}
              </span>
            </div>

            {/* Conversão entre etapas */}
            {!isLast && stage.conversao && (
              <div style={{ fontSize: 9, color: 'var(--v4p-text-4)', display: 'flex', alignItems: 'center', gap: 3 }}>
                <span aria-hidden="true" className="material-symbols-rounded" style={{ fontSize: 10 }}>south</span>
                {Math.round(stage.conversao * 100)}%
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default memo(FunnelChart);
