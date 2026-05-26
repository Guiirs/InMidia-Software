import { memo } from 'react';

const CAT_COLOR = {
  success: 'var(--v4p-success)',
  warning: 'var(--v4p-warning)',
  info:    'var(--v4p-accent)',
  danger:  'var(--v4p-danger)',
};

function TimelineItem({ item, isLast }) {
  const color = CAT_COLOR[item.categoria] ?? 'var(--v4p-text-4)';

  return (
    <div style={{ display: 'flex', gap: 10, paddingBottom: isLast ? 0 : 12, position: 'relative' }}>
      {/* Linha vertical */}
      {!isLast && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 10, top: 22,
            width: 1,
            bottom: 0,
            background: 'var(--v4p-border-soft)',
          }}
        />
      )}

      {/* Ícone + dot */}
      <div style={{ flexShrink: 0, width: 22, display: 'flex', justifyContent: 'center', paddingTop: 2 }}>
        <div
          style={{
            width: 20, height: 20,
            borderRadius: 'var(--v4p-r-full)',
            background: `${color}18`,
            border: `1px solid ${color}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <span
            aria-hidden="true"
            className="material-symbols-rounded"
            style={{
              fontSize: 11,
              color, lineHeight: 1,
            }}
          >
            {item.icone}
          </span>
        </div>
      </div>

      {/* Conteúdo */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--v4p-text-2)', lineHeight: 1.4, fontWeight: 500 }}>
            {item.label}
          </span>
          <span style={{ fontSize: 10, color: 'var(--v4p-text-4)', flexShrink: 0, whiteSpace: 'nowrap' }}>
            {item.tempo}
          </span>
        </div>
        <span style={{ fontSize: 10, color: 'var(--v4p-text-4)' }}>{item.regiao}</span>
      </div>
    </div>
  );
}

function ActivityTimeline({ items = [], maxItems = 8 }) {
  const visible = items.slice(0, maxItems);

  return (
    <div className="v4p-surface-card" style={{ padding: '14px 16px' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--v4p-text-2)', marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid var(--v4p-border-soft)' }}>
        Atividade operacional
      </div>
      {visible.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--v4p-text-4)', padding: '12px 0' }}>Nenhuma atividade recente.</div>
      ) : (
        <div>
          {visible.map((item, i) => (
            <TimelineItem key={item.id} item={item} isLast={i === visible.length - 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default memo(ActivityTimeline);
