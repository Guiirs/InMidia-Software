import { memo } from 'react';

function FunnelStage({ stage, maxCount, isLast }) {
  const widthPct = (stage.count / maxCount) * 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {/* Barra do funil */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 80, flexShrink: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--v4p-text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {stage.label}
          </div>
          {stage.conversao && (
            <div style={{ fontSize: 10, color: 'var(--v4p-text-4)' }}>
              {Math.round(stage.conversao * 100)}% conv.
            </div>
          )}
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, height: 28, background: 'var(--v4p-border-soft)', borderRadius: 'var(--v4p-r-sm)', overflow: 'hidden', position: 'relative' }}>
            <div
              style={{
                height: '100%',
                width: `${widthPct}%`,
                background: stage.cor,
                opacity: 0.85,
                borderRadius: 'var(--v4p-r-sm)',
                display: 'flex',
                alignItems: 'center',
                paddingLeft: 8,
                transition: 'width 0.7s var(--v4p-ease)',
                minWidth: 32,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>
                {stage.count}
              </span>
            </div>
          </div>
          <div style={{ width: 80, textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--v4p-text-1)' }}>
              {stage.valor ?? '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Seta de conversão */}
      {!isLast && stage.conversao && (
        <div style={{ paddingLeft: 90, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            aria-hidden="true"
            className="material-symbols-rounded"
            style={{ fontSize: 12, color: 'var(--v4p-text-4)' }}
          >
            south
          </span>
          <span style={{ fontSize: 10, color: 'var(--v4p-text-4)' }}>
            {Math.round(stage.conversao * 100)}% conversão
          </span>
        </div>
      )}
    </div>
  );
}

function CommercialFunnelCard({ stages = [] }) {
  if (stages.length === 0) {
    return (
      <div className="v4p-surface-card" style={{ padding: '14px 16px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--v4p-text-2)', marginBottom: 8 }}>Funil comercial</div>
        <div style={{ fontSize: 12, color: 'var(--v4p-text-4)' }}>Sem dados de pipeline disponíveis.</div>
      </div>
    );
  }
  const maxCount = stages[0].count;
  const totalPotencial = 'R$ —';
  const convGlobal = Math.round((stages[stages.length - 1].count / maxCount) * 100);

  return (
    <div className="v4p-surface-card" style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid var(--v4p-border-soft)' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--v4p-text-2)' }}>Funil comercial</div>
          <div style={{ fontSize: 10, color: 'var(--v4p-text-4)' }}>Conversão e receita potencial do pipeline</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--v4p-accent)' }}>{totalPotencial}</div>
          <div style={{ fontSize: 10, color: 'var(--v4p-text-4)' }}>em negociação</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {stages.map((stage, i) => (
          <FunnelStage
            key={stage.id}
            stage={stage}
            maxCount={maxCount}
            isLast={i === stages.length - 1}
          />
        ))}
      </div>

      <div
        style={{
          marginTop: 14,
          padding: '8px 12px',
          background: 'rgba(0,0,0,0.12)',
          borderRadius: 'var(--v4p-r-md)',
          border: '1px solid var(--v4p-border-soft)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: 11, color: 'var(--v4p-text-3)' }}>Taxa de conversão global (Lead → Fechado)</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--v4p-success)' }}>{convGlobal}%</span>
      </div>
    </div>
  );
}

export default memo(CommercialFunnelCard);
