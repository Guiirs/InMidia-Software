import { memo } from 'react';

function Sparkline({ meses }) {
  const valores = meses.map(m => m.valor);
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const w = 280;
  const h = 52;
  const pad = 4;

  const toX = (i) => pad + (i / (meses.length - 1)) * (w - pad * 2);
  const toY = (v) => h - pad - ((v - min) / (max - min)) * (h - pad * 2);

  const realPoints = meses.filter(m => !m.projetado);
  const projPoints = meses.filter((_, i) => i >= realPoints.length - 1);

  const areaPath = `M${toX(0)},${h} ${realPoints.map((m, i) => `L${toX(i)},${toY(m.valor)}`).join(' ')} L${toX(realPoints.length - 1)},${h} Z`;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" style={{ overflow: 'visible' }}>
      {/* Área preenchida (real) */}
      <defs>
        <linearGradient id="rev-area-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--v4p-accent)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--v4p-accent)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#rev-area-grad)" />

      {/* Linha real */}
      <polyline
        points={realPoints.map((m, i) => `${toX(i)},${toY(m.valor)}`).join(' ')}
        fill="none"
        stroke="var(--v4p-accent)"
        strokeWidth={1.8}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Linha projetada (tracejada) */}
      <polyline
        points={projPoints.map((m, i) => `${toX(realPoints.length - 1 + i)},${toY(m.valor)}`).join(' ')}
        fill="none"
        stroke="var(--v4p-accent)"
        strokeWidth={1.5}
        strokeDasharray="4 3"
        strokeLinecap="round"
        opacity={0.6}
      />

      {/* Ponto atual */}
      <circle
        cx={toX(realPoints.length - 1)}
        cy={toY(realPoints[realPoints.length - 1].valor)}
        r={3.5}
        fill="var(--v4p-accent)"
      />
    </svg>
  );
}

function RevenueProjectionCard({ projection = null }) {
  if (!projection) {
    return (
      <div className="v4p-surface-card" style={{ padding: '14px 16px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--v4p-text-2)', marginBottom: 8 }}>Projeção de receita</div>
        <div style={{ fontSize: 12, color: 'var(--v4p-text-4)' }}>Sem dados de projeção disponíveis.</div>
      </div>
    );
  }
  const { meta, atual, projetado, percentMeta, meses } = projection;
  const pctBar = Math.min(percentMeta, 1);

  const fmt = (v) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

  return (
    <div className="v4p-surface-card" style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid var(--v4p-border-soft)' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--v4p-text-2)' }}>Projeção de receita</div>
          <div style={{ fontSize: 10, color: 'var(--v4p-text-4)' }}>Jun 2025 — Mai 2026</div>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: pctBar >= 0.9 ? 'var(--v4p-success)' : 'var(--v4p-warning)' }}>
          {Math.round(percentMeta * 100)}% da meta
        </span>
      </div>

      {/* Valores */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--v4p-text-1)', lineHeight: 1 }}>{fmt(atual)}</div>
          <div style={{ fontSize: 10, color: 'var(--v4p-text-4)', marginTop: 3 }}>Receita atual</div>
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--v4p-accent)', lineHeight: 1 }}>{fmt(projetado)}</div>
          <div style={{ fontSize: 10, color: 'var(--v4p-text-4)', marginTop: 3 }}>Projeção</div>
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--v4p-text-3)', lineHeight: 1 }}>{fmt(meta)}</div>
          <div style={{ fontSize: 10, color: 'var(--v4p-text-4)', marginTop: 3 }}>Meta anual</div>
        </div>
      </div>

      {/* Progresso para meta */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 10, color: 'var(--v4p-text-4)' }}>
          <span>Atingimento da meta</span>
          <span style={{ color: pctBar >= 0.9 ? 'var(--v4p-success)' : 'var(--v4p-warning)', fontWeight: 600 }}>
            {Math.round(percentMeta * 100)}%
          </span>
        </div>
        <div style={{ height: 5, borderRadius: 'var(--v4p-r-full)', background: 'var(--v4p-border)', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${pctBar * 100}%`,
              background: pctBar >= 0.9 ? 'var(--v4p-success)' : 'var(--v4p-accent)',
              borderRadius: 'var(--v4p-r-full)',
              transition: 'width 0.6s var(--v4p-ease)',
            }}
          />
        </div>
      </div>

      {/* Gráfico sparkline */}
      <Sparkline meses={meses} />

      {/* Legenda */}
      <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--v4p-text-4)' }}>
          <div style={{ width: 16, height: 2, background: 'var(--v4p-accent)', borderRadius: 2 }} />
          Realizado
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--v4p-text-4)' }}>
          <div style={{ width: 16, height: 1, background: 'var(--v4p-accent)', borderRadius: 2, opacity: 0.6, borderTop: '1px dashed var(--v4p-accent)' }} />
          Projetado
        </div>
      </div>
    </div>
  );
}

export default memo(RevenueProjectionCard);
