import { memo } from 'react';

/* Gráfico de barras horizontais de ocupação por categoria */
function OccupancyChart({ categories = [], compact = false }) {
  if (categories.length === 0) {
    return <div style={{ fontSize: 12, color: 'var(--v4p-text-4)', padding: '8px 0' }}>Sem dados de ocupação.</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 6 : 9 }}>
      {categories.map(item => {
        const pct = Math.round(item.ocupacao * 100);
        return (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: compact ? 80 : 95, fontSize: 11, color: 'var(--v4p-text-3)', flexShrink: 0, textAlign: 'right', fontWeight: 500 }}>
              {item.label}
            </span>
            <div style={{ flex: 1, height: compact ? 14 : 18, background: 'var(--v4p-border-soft)', borderRadius: 'var(--v4p-r-sm)', overflow: 'hidden', position: 'relative' }}>
              <div
                style={{
                  height: '100%',
                  width: `${pct}%`,
                  background: item.cor,
                  borderRadius: 'var(--v4p-r-sm)',
                  transition: 'width 0.7s var(--v4p-ease)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  paddingRight: 5,
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>{pct}%</span>
              </div>
            </div>
            <span style={{ width: 36, fontSize: 10, color: 'var(--v4p-text-4)', textAlign: 'right', flexShrink: 0 }}>
              {item.ocupados}/{item.total}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default memo(OccupancyChart);
