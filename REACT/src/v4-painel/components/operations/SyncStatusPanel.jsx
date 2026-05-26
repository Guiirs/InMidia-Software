import { memo } from 'react';
import { getStateMeta } from '../../foundation/operationalStates.js';

const SYNC_EMPTY = {
  estado: 'healthy',
  modo: '—',
  intervalo: '—',
  ultimaSyncLabel: '—',
  proximaSync: '—',
  totalPontos: 0,
  pontosAtualizados: 0,
  divergencias: 0,
  detalhes: [],
};

function SyncStatusPanel({ sync = SYNC_EMPTY }) {
  const s = { ...SYNC_EMPTY, ...sync, detalhes: Array.isArray(sync?.detalhes) ? sync.detalhes : [] };
  const meta  = getStateMeta(s.estado);
  const pctOk = Math.round(((s.pontosAtualizados ?? 0) / Math.max(s.totalPontos ?? 1, 1)) * 100);

  return (
    <div className="v4p-surface-card" style={{ padding: '14px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid var(--v4p-border-soft)' }}>
        <span aria-hidden="true" className="material-symbols-rounded" style={{ fontSize: 16, color: meta.color, animation: 'v4p-spin 1.5s linear infinite' }}>sync</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--v4p-text-2)' }}>Sincronização operacional</div>
          <div style={{ fontSize: 10, color: 'var(--v4p-text-4)' }}>Modo {s.modo} · intervalo de {s.intervalo}</div>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: meta.color }}>{meta.label}</span>
      </div>

      {/* Barra geral */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ fontSize: 11, color: 'var(--v4p-text-3)' }}>Pontos atualizados</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: pctOk >= 99 ? 'var(--v4p-success)' : 'var(--v4p-warning)' }}>{s.pontosAtualizados}/{s.totalPontos} ({pctOk}%)</span>
        </div>
        <div style={{ height: 6, borderRadius: 'var(--v4p-r-full)', background: 'var(--v4p-border)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pctOk}%`, background: pctOk >= 99 ? 'var(--v4p-success)' : 'var(--v4p-warning)', borderRadius: 'var(--v4p-r-full)', transition: 'width 0.8s' }} />
        </div>
      </div>

      {/* Info rápida */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
        {[
          { l: 'Última sync',  v: s.ultimaSyncLabel,          c: 'var(--v4p-text-2)' },
          { l: 'Próxima sync', v: s.proximaSync,              c: 'var(--v4p-accent)'  },
          { l: 'Divergências', v: `${s.divergencias} pontos`, c: s.divergencias > 0 ? 'var(--v4p-warning)' : 'var(--v4p-success)' },
        ].map(item => (
          <div key={item.l} style={{ padding: '8px', borderRadius: 'var(--v4p-r-md)', background: 'rgba(0,0,0,0.12)', border: '1px solid var(--v4p-border-soft)' }}>
            <div style={{ fontSize: 9, color: 'var(--v4p-text-4)', marginBottom: 3 }}>{item.l}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: item.c }}>{item.v}</div>
          </div>
        ))}
      </div>

      {/* Por região */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--v4p-text-4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Por região</div>
        {s.detalhes.length === 0 && (
          <div style={{ fontSize: 11, color: 'var(--v4p-text-4)', padding: '8px 0' }}>Sem dados de sincronização regional disponíveis.</div>
        )}
        {s.detalhes.map((d, i) => {
          const dMeta = getStateMeta(d.estado);
          const pct   = d.pontos > 0 ? Math.round((d.sincronizados / d.pontos) * 100) : 0;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', borderBottom: i < s.detalhes.length - 1 ? '1px solid var(--v4p-border-soft)' : 'none' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: dMeta.color, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'var(--v4p-text-2)', flex: 1 }}>{d.regiao}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--v4p-text-1)', fontVariantNumeric: 'tabular-nums' }}>{d.sincronizados}/{d.pontos}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: dMeta.color, minWidth: 36, textAlign: 'right' }}>{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default memo(SyncStatusPanel);
