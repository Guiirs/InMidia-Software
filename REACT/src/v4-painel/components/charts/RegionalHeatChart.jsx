import { memo } from 'react';

/* Heatmap de desempenho regional — grid de células coloridas */
function RegionalHeatChart({ regions = [] }) {
  if (regions.length === 0) {
    return <div style={{ fontSize: 12, color: 'var(--v4p-text-4)', padding: '8px 0' }}>Sem dados regionais.</div>;
  }
  const MAX_HEAT = 5;

  const heatColor = (level) => {
    const palette = [
      'rgba(244,116,116,0.70)',
      'rgba(227,180,86,0.65)',
      'rgba(227,180,86,0.80)',
      'rgba(116,133,255,0.65)',
      'rgba(56,199,143,0.75)',
    ];
    return palette[level - 1] ?? palette[0];
  };

  return (
    <div>
      {/* Grid de regiões */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {regions.map(region => {
          const pct = Math.round(region.ocupacao * 100);
          return (
            <div
              key={region.id}
              style={{
                padding: '10px 10px',
                borderRadius: 'var(--v4p-r-md)',
                background: heatColor(region.heatLevel),
                border: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                cursor: 'default',
              }}
              title={`${region.label} — ${pct}% ocupado — ${region.receitaFormatada}`}
            >
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.02em' }}>
                {region.label}
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', lineHeight: 1 }}>
                {pct}%
              </div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.65)' }}>
                {region.receitaFormatada}
              </div>
            </div>
          );
        })}
      </div>

      {/* Escala */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
        <span style={{ fontSize: 10, color: 'var(--v4p-text-4)' }}>Ocupação</span>
        <div style={{ flex: 1, height: 4, borderRadius: 'var(--v4p-r-full)', background: 'linear-gradient(to right, var(--v4p-danger), var(--v4p-warning), var(--v4p-success))' }} />
        <span style={{ fontSize: 10, color: 'var(--v4p-text-4)' }}>Alta</span>
      </div>
    </div>
  );
}

export default memo(RegionalHeatChart);
