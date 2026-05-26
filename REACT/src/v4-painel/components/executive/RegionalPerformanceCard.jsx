import { memo } from 'react';

const HEAT_COLORS = [
  'var(--v4p-danger)',
  'var(--v4p-warning)',
  'var(--v4p-warning)',
  'var(--v4p-accent)',
  'var(--v4p-success)',
];

function RegionRow({ region, isLast }) {
  const pct        = Math.round(region.ocupacao * 100);
  const heatColor  = HEAT_COLORS[region.heatLevel - 1] ?? 'var(--v4p-text-4)';
  const barWidth   = `${pct}%`;
  const barColor   = pct >= 80
    ? 'var(--v4p-success)'
    : pct >= 70
    ? 'var(--v4p-accent)'
    : pct >= 60
    ? 'var(--v4p-warning)'
    : 'var(--v4p-danger)';

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '110px 1fr 90px 70px',
        alignItems: 'center',
        gap: 12,
        padding: '9px 0',
        borderBottom: isLast ? 'none' : '1px solid var(--v4p-border-soft)',
      }}
    >
      {/* Região */}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--v4p-text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {region.label}
        </div>
        <div style={{ fontSize: 10, color: 'var(--v4p-text-4)' }}>
          {region.placasTotal} pontos
        </div>
      </div>

      {/* Barra de ocupação */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 10, color: 'var(--v4p-text-4)' }}>{pct}% ocupado</span>
          <span style={{ fontSize: 10, color: 'var(--v4p-text-4)' }}>{region.disponibilidade} livres</span>
        </div>
        <div
          aria-label={`Ocupação: ${pct}%`}
          style={{
            height: 5,
            borderRadius: 'var(--v4p-r-full)',
            background: 'var(--v4p-border)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: barWidth,
              borderRadius: 'var(--v4p-r-full)',
              background: barColor,
              transition: 'width 0.6s var(--v4p-ease)',
            }}
          />
        </div>
      </div>

      {/* Receita */}
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--v4p-text-1)' }}>{region.receitaFormatada}</div>
        <div style={{ fontSize: 10, color: 'var(--v4p-text-4)' }}>{region.tendencia}</div>
      </div>

      {/* Heat / Risco */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            aria-hidden="true"
            style={{
              width: 5,
              height: 12 + i * 2,
              borderRadius: 2,
              background: i < region.heatLevel ? heatColor : 'var(--v4p-border)',
              display: 'inline-block',
              transition: 'background 0.3s',
            }}
          />
        ))}
      </div>
    </div>
  );
}

function RegionalPerformanceCard({ regions = [] }) {
  if (regions.length === 0) {
    return (
      <div className="v4p-surface-card" style={{ padding: '14px 16px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--v4p-text-2)', marginBottom: 8 }}>Desempenho regional</div>
        <div style={{ fontSize: 12, color: 'var(--v4p-text-4)' }}>Sem dados regionais disponíveis.</div>
      </div>
    );
  }
  return (
    <div className="v4p-surface-card" style={{ padding: '14px 16px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: 10,
          marginBottom: 4,
          borderBottom: '1px solid var(--v4p-border-soft)',
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--v4p-text-2)' }}>Desempenho regional</div>
          <div style={{ fontSize: 10, color: 'var(--v4p-text-4)' }}>Ocupação, receita e risco por região</div>
        </div>
        {/* Legenda de heat */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--v4p-text-4)' }}>
          <span>Baixo</span>
          {['var(--v4p-danger)', 'var(--v4p-warning)', 'var(--v4p-warning)', 'var(--v4p-accent)', 'var(--v4p-success)'].map((c, i) => (
            <span key={i} style={{ width: 4, height: 10 + i * 2, background: `var(--v4p-border)`, borderRadius: 2, display: 'inline-block' }} />
          ))}
          <span>Alto</span>
        </div>
      </div>

      <div>
        {regions.map((region, i) => (
          <RegionRow
            key={region.id}
            region={region}
            isLast={i === regions.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

export default memo(RegionalPerformanceCard);
