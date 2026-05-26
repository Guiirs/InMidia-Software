import { memo } from 'react';

function DonutRing({ value, color, size = 80, stroke = 7 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * value;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--v4p-border)" strokeWidth={stroke} />
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeDashoffset={circ * 0.25}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.6s var(--v4p-ease)' }}
      />
    </svg>
  );
}

function CategoryBar({ item, isLast }) {
  const pct = Math.round(item.ocupacao * 100);
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '90px 1fr 52px 44px',
        alignItems: 'center',
        gap: 10,
        padding: '7px 0',
        borderBottom: isLast ? 'none' : '1px solid var(--v4p-border-soft)',
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--v4p-text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {item.label}
      </span>
      <div
        style={{
          height: 4,
          borderRadius: 'var(--v4p-r-full)',
          background: 'var(--v4p-border)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            borderRadius: 'var(--v4p-r-full)',
            background: item.cor,
            transition: 'width 0.6s var(--v4p-ease)',
          }}
        />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: item.cor, textAlign: 'right' }}>{pct}%</span>
      <span style={{ fontSize: 10, color: 'var(--v4p-text-4)', textAlign: 'right' }}>{item.ocupados}/{item.total}</span>
    </div>
  );
}

function OccupancyOverviewCard({ categories = [] }) {
  if (categories.length === 0) {
    return (
      <div className="v4p-surface-card" style={{ padding: '14px 16px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--v4p-text-2)', marginBottom: 8 }}>Visão de ocupação por categoria</div>
        <div style={{ fontSize: 12, color: 'var(--v4p-text-4)' }}>Sem dados de ocupação disponíveis.</div>
      </div>
    );
  }
  const total    = categories.reduce((s, c) => s + c.total, 0);
  const ocupados = categories.reduce((s, c) => s + c.ocupados, 0);
  const pctGlobal = ocupados / total;

  return (
    <div className="v4p-surface-card" style={{ padding: '14px 16px' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--v4p-text-2)', marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid var(--v4p-border-soft)' }}>
        Visão de ocupação por categoria
      </div>

      {/* Donut + resumo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
        <div style={{ position: 'relative', flexShrink: 0, width: 80, height: 80 }}>
          <DonutRing value={pctGlobal} color="var(--v4p-accent)" size={80} stroke={7} />
          <div
            style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--v4p-text-1)', lineHeight: 1 }}>
              {Math.round(pctGlobal * 100)}%
            </span>
            <span style={{ fontSize: 9, color: 'var(--v4p-text-4)', marginTop: 1 }}>global</span>
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--v4p-text-1)', lineHeight: 1 }}>{ocupados}</div>
              <div style={{ fontSize: 10, color: 'var(--v4p-text-4)', marginTop: 2 }}>Ocupadas</div>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--v4p-warning)', lineHeight: 1 }}>{total - ocupados}</div>
              <div style={{ fontSize: 10, color: 'var(--v4p-text-4)', marginTop: 2 }}>Disponíveis</div>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--v4p-text-1)', lineHeight: 1 }}>{total}</div>
              <div style={{ fontSize: 10, color: 'var(--v4p-text-4)', marginTop: 2 }}>Total</div>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--v4p-success)', lineHeight: 1 }}>91,7%</div>
              <div style={{ fontSize: 10, color: 'var(--v4p-text-4)', marginTop: 2 }}>Premium A+</div>
            </div>
          </div>
        </div>
      </div>

      {/* Barras por categoria */}
      <div>
        {categories.map((item, i) => (
          <CategoryBar key={item.label} item={item} isLast={i === categories.length - 1} />
        ))}
      </div>
    </div>
  );
}

export default memo(OccupancyOverviewCard);
