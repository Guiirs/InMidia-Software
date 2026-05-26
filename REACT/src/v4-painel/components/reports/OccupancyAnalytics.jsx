import { memo } from 'react';

function OccupancyAnalytics({ occupancy = null }) {
  if (!occupancy) {
    return (
      <div className="v4p-surface-card v4p-medium-panel">
        <div className="v4p-medium-panel__header">
          <div className="v4p-card-title">Analytics de ocupação · histórico e sazonalidade</div>
        </div>
        <div style={{ padding: '20px 0', color: 'var(--v4p-text-4)', fontSize: 12 }}>
          Sem histórico de ocupação disponível.
        </div>
      </div>
    );
  }

  const { historico = [], sazonalidade = [] } = occupancy;

  const cats = [
    { key: 'global',    label: 'Global',    color: 'var(--v4p-accent)'   },
    { key: 'premiumA',  label: 'Premium A', color: 'var(--v4p-success)'  },
    { key: 'standardB', label: 'Standard B',color: 'var(--v4p-warning)'  },
    { key: 'economico', label: 'Econômico', color: 'var(--v4p-danger)'   },
  ];

  return (
    <div className="v4p-surface-card v4p-medium-panel">
      <div className="v4p-medium-panel__header">
        <div className="v4p-card-title">Analytics de ocupação · histórico e sazonalidade</div>
      </div>

      {historico.length > 0 ? (
        <div className="v4p-table-scroll">
          <table className="v4p-compact-table">
            <thead>
              <tr>
                <th>Mês</th>
                {cats.map((c) => (
                  <th key={c.key} style={{ '--v4p-cell-align': 'right', '--v4p-table-head-color': c.color }}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {historico.map((row, i) => (
                <tr key={row.mes} className={i === historico.length - 1 ? 'v4p-compact-table__highlight' : undefined}>
                  <td>{row.mes}</td>
                  {cats.map((c) => (
                    <td key={c.key} style={{ '--v4p-cell-align': 'right', '--v4p-cell-color': c.color }}>
                      {Math.round((row[c.key] ?? 0) * 100)}%
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ padding: '12px 0', color: 'var(--v4p-text-4)', fontSize: 12 }}>Sem histórico.</div>
      )}

      {sazonalidade.length > 0 && (
        <div>
          <div className="v4p-section-label">Índice de sazonalidade</div>
          <div className="v4p-chart-bars" style={{ '--v4p-chart-h': '36px' }}>
            {sazonalidade.map((s) => {
              const barH = Math.max(((s.fator - 0.85) / 0.25) * 30, 4);
              const color = s.fator >= 1.02 ? 'var(--v4p-success)' : s.fator >= 0.95 ? 'var(--v4p-accent)' : 'var(--v4p-warning)';
              return (
                <div key={s.mes} title={`${s.mes}: ${s.fator} · ${s.nota}`} className="v4p-chart-bar">
                  <div className="v4p-chart-bar__fill" style={{ '--v4p-bar-h': `${barH}px`, '--v4p-accent-dynamic': color }} />
                  <span className="v4p-chart-label">{s.mes}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(OccupancyAnalytics);
