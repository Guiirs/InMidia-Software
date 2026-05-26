import { memo } from 'react';

function RevenueChart({ meses = [], height = 100 }) {
  if (meses.length === 0) {
    return <div style={{ fontSize: 12, color: 'var(--v4p-text-4)', padding: '8px 0' }}>Sem historico de receita.</div>;
  }

  const valores = meses.map((m) => m.valor);
  const max = Math.max(...valores);
  const fmt = (v) => `R$ ${(v / 1000).toFixed(0)}k`;

  return (
    <div style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height }}>
        {meses.map((m, i) => {
          const h = (m.valor / max) * (height - 20);
          return (
            <div
              key={i}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                height: '100%',
                justifyContent: 'flex-end',
              }}
            >
              <div style={{ fontSize: 9, color: 'var(--v4p-text-4)', whiteSpace: 'nowrap', marginBottom: 2 }}>
                {fmt(m.valor)}
              </div>
              <div
                style={{
                  width: '100%',
                  height: h,
                  background: m.projetado
                    ? 'rgba(116,133,255,0.25)'
                    : 'var(--v4p-accent)',
                  borderRadius: '3px 3px 0 0',
                  border: m.projetado ? '1px dashed rgba(116,133,255,0.5)' : 'none',
                  borderBottom: 'none',
                  transition: 'height 0.6s var(--v4p-ease)',
                  position: 'relative',
                }}
                title={`${m.label}: ${fmt(m.valor)}${m.projetado ? ' (projetado)' : ''}`}
              />
              <div style={{ fontSize: 9, color: 'var(--v4p-text-4)', marginTop: 2 }}>{m.label}</div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--v4p-text-4)' }}>
          <div style={{ width: 10, height: 10, background: 'var(--v4p-accent)', borderRadius: 2 }} />
          Realizado
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--v4p-text-4)' }}>
          <div style={{ width: 10, height: 10, background: 'rgba(116,133,255,0.25)', border: '1px dashed rgba(116,133,255,0.5)', borderRadius: 2 }} />
          Projetado
        </div>
      </div>
    </div>
  );
}

export default memo(RevenueChart);
