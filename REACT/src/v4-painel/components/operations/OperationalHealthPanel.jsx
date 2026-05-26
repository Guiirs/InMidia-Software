import { memo } from 'react';
import { getStateMeta, OPERATIONAL_STATE } from '../../foundation/operationalStates.js';

/* Painel de saúde geral — todas as dimensões de um relance */
function HealthDimension({ label, value, subValue, estado, icon }) {
  const meta = getStateMeta(estado);
  return (
    <div style={{
      padding: '10px 12px', borderRadius: 'var(--v4p-r-md)',
      background: meta.colorSoft, border: `1px solid ${meta.colorSoft}`,
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span aria-hidden="true" className="material-symbols-rounded" style={{ fontSize: 14, color: meta.color, lineHeight: 1 }}>{icon}</span>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--v4p-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: meta.color, lineHeight: 1 }}>{value}</div>
      {subValue && <div style={{ fontSize: 10, color: 'var(--v4p-text-4)' }}>{subValue}</div>}
    </div>
  );
}

function OperationalHealthPanel({ modules = [], health = null }) {
  const healthy  = modules.filter(m => m.estado === OPERATIONAL_STATE.HEALTHY).length;
  const degraded = modules.filter(m => m.estado === OPERATIONAL_STATE.DEGRADED || m.estado === OPERATIONAL_STATE.WARNING).length;
  const syncing  = modules.filter(m => m.estado === OPERATIONAL_STATE.SYNCING).length;
  const total    = modules.length;

  const globalState = health?.status ?? (degraded > 1 ? OPERATIONAL_STATE.DEGRADED
    : degraded === 1 ? OPERATIONAL_STATE.WARNING
    : syncing > 0    ? OPERATIONAL_STATE.SYNCING
    : OPERATIONAL_STATE.HEALTHY);

  const globalMeta = getStateMeta(globalState);

  return (
    <div className="v4p-surface-card" style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid var(--v4p-border-soft)' }}>
        <span aria-hidden="true" className="material-symbols-rounded" style={{ fontSize: 16, color: globalMeta.color }}>health_and_safety</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--v4p-text-2)' }}>Saúde operacional geral</div>
          <div style={{ fontSize: 10, color: 'var(--v4p-text-4)' }}>{total} módulos monitorados</div>
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: globalMeta.color }}>{globalMeta.label}</span>
      </div>

      {/* Dimensões */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 12 }}>
        <HealthDimension label="Módulos operacionais" value={`${healthy}/${total}`} subValue={total > 0 ? `${Math.round((healthy/total)*100)}% de disponibilidade` : '—'} estado={total === 0 || healthy === total ? OPERATIONAL_STATE.HEALTHY : OPERATIONAL_STATE.WARNING} icon="check_circle" />
        <HealthDimension label="Em atenção"           value={health?.warningCount ?? degraded}             subValue="requer monitoramento"           estado={degraded > 0 ? OPERATIONAL_STATE.WARNING : OPERATIONAL_STATE.HEALTHY} icon="warning" />
        <HealthDimension label="Sincronizando"        value={syncing}              subValue="operação em andamento"          estado={syncing > 0 ? OPERATIONAL_STATE.SYNCING : OPERATIONAL_STATE.HEALTHY} icon="sync" />
        <HealthDimension label="Disponibilidade geral"value={`${health?.score ?? 99}%`}               subValue="score operacional"               estado={globalState} icon="show_chart" />
      </div>

      {/* Mini lista de módulos com indicador */}
      <div>
        {modules.map((m, i) => {
          const mMeta = getStateMeta(m.estado);
          return (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: i < modules.length - 1 ? '1px solid var(--v4p-border-soft)' : 'none' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: mMeta.color, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'var(--v4p-text-2)', flex: 1 }}>{m.label}</span>
              <span style={{ fontSize: 10, color: mMeta.color, fontWeight: 600 }}>{m.uptime}</span>
              <span style={{ fontSize: 10, color: 'var(--v4p-text-4)', minWidth: 55, textAlign: 'right' }}>{m.tempoResposta}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default memo(OperationalHealthPanel);
