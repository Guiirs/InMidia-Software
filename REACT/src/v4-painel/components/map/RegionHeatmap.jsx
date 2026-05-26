import { memo } from 'react';
import { getStateMeta } from '../../foundation/operationalStates.js';

function RegionHeatmap({ regions = [], onSelectRegion, selectedId }) {
  const fmt = (v) => v > 0
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)
    : '-';

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--v4p-text-3)', marginBottom: 8 }}>Mapa de calor - ocupacao por regiao</div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
        gap: 6,
      }}>
        {regions.filter((r) => r.placas > 0).map((region) => {
          const meta = getStateMeta(region.estado);
          const pct = Math.round(region.ocupacao * 100);
          const isSelected = selectedId === region.id;

          return (
            <div
              key={region.id}
              onClick={() => onSelectRegion?.(region)}
              style={{
                padding: '10px 8px',
                borderRadius: 'var(--v4p-r-md)',
                background: region.cor,
                border: isSelected ? `2px solid ${meta.color}` : '1px solid rgba(255,255,255,0.08)',
                cursor: 'pointer',
                transition: 'transform var(--v4p-t-fast), border-color var(--v4p-t-fast)',
                display: 'flex', flexDirection: 'column', gap: 3,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.04)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
              title={`${region.label}: ${pct}% ocupado`}
            >
              <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{region.sigla}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: meta.color, lineHeight: 1 }}>{pct}%</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)' }}>{region.placas} pontos</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>{fmt(region.receita)}</div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
        <span style={{ fontSize: 9, color: 'var(--v4p-text-4)' }}>Baixa ocupacao</span>
        <div style={{ flex: 1, height: 3, borderRadius: 'var(--v4p-r-full)', background: 'linear-gradient(to right, var(--v4p-danger), var(--v4p-warning), var(--v4p-accent), var(--v4p-success))' }} />
        <span style={{ fontSize: 9, color: 'var(--v4p-text-4)' }}>Alta ocupacao</span>
      </div>
    </div>
  );
}

export default memo(RegionHeatmap);
