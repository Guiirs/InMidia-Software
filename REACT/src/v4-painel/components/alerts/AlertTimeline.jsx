import { memo } from 'react';

const CAT_COLOR = { danger: 'var(--v4p-danger)', warning: 'var(--v4p-warning)', success: 'var(--v4p-success)', info: 'var(--v4p-accent)' };

function AlertTimeline({ timeline = [] }) {
  const safeTimeline = Array.isArray(timeline) ? timeline : [];

  return (
    <div className="v4p-surface-card" style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid var(--v4p-border-soft)' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--v4p-success)', display: 'inline-block', animation: 'v4p-pulse-warning 2s infinite' }} />
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--v4p-text-2)' }}>Timeline de alertas</div>
      </div>

      {safeTimeline.length === 0 ? (
        <div style={{ padding: '12px 0', color: 'var(--v4p-text-4)', fontSize: 12 }}>
          Nenhum evento de alerta registrado.
        </div>
      ) : (
        <div>
          {safeTimeline.map((item, i) => {
            const color = CAT_COLOR[item.tipo] ?? 'var(--v4p-text-4)';
            return (
              <div key={item.id ?? i} style={{ display: 'flex', gap: 10, paddingBottom: i < safeTimeline.length - 1 ? 10 : 0, position: 'relative' }}>
                {i < safeTimeline.length - 1 && <div style={{ position: 'absolute', left: 10, top: 22, width: 1, bottom: 0, background: 'var(--v4p-border-soft)' }} />}
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: `${color}18`, border: `1px solid ${color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--v4p-text-2)', lineHeight: 1.4, fontWeight: 500 }}>{item.evento}</span>
                    <span style={{ fontSize: 10, color: 'var(--v4p-text-4)', flexShrink: 0, whiteSpace: 'nowrap' }}>{item.tempo}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default memo(AlertTimeline);
