import { memo } from 'react';
import { getStateMeta, OPERATIONAL_STATE } from '../../foundation/operationalStates.js';

const STATE_ICON = {
  [OPERATIONAL_STATE.HEALTHY]:  'check_circle',
  [OPERATIONAL_STATE.WARNING]:  'warning',
  [OPERATIONAL_STATE.CRITICAL]: 'error',
  [OPERATIONAL_STATE.DEGRADED]: 'trending_down',
  [OPERATIONAL_STATE.SYNCING]:  'sync',
  [OPERATIONAL_STATE.PENDING]:  'hourglass_empty',
  [OPERATIONAL_STATE.OFFLINE]:  'cloud_off',
};

function ModuleCard({ module }) {
  const meta = getStateMeta(module.estado);
  const icon = STATE_ICON[module.estado] ?? 'device_hub';
  const responseColor =
    module.estado === OPERATIONAL_STATE.DEGRADED ? 'var(--v4p-warning)'
    : module.estado === OPERATIONAL_STATE.WARNING  ? 'var(--v4p-warning)'
    : 'var(--v4p-text-1)';

  return (
    <div
      className="v4p-op-status-card"
      style={{ '--v4p-accent-dynamic': meta.color }}
    >
      {/* Header: título + badge de estado */}
      <div className="v4p-op-status-card__header">
        <div className="v4p-op-status-card__title-row">
          <span aria-hidden="true" className="v4p-icon v4p-icon--sm material-symbols-rounded">
            {icon}
          </span>
          <span className="v4p-op-status-card__title">{module.label}</span>
        </div>
        <span
          className="v4p-status-pill v4p-status-pill--sm"
          style={{
            '--v4p-pill-color': meta.color,
            '--v4p-pill-border': `color-mix(in srgb, ${meta.color} 34%, transparent)`,
            '--v4p-pill-bg': `color-mix(in srgb, ${meta.color} 12%, transparent)`,
          }}
        >
          <span className="v4p-status-pill__dot" />
          {meta.label}
        </span>
      </div>

      {/* Descrição */}
      <p className="v4p-op-status-card__desc">{module.descricao}</p>

      {/* Métricas */}
      <div className="v4p-op-status-card__metrics">
        <div className="v4p-op-status-card__metric">
          <div className="v4p-micro-kpi__label">Disponibilidade</div>
          <div className="v4p-micro-kpi__value">{module.uptime}</div>
        </div>
        <div className="v4p-op-status-card__metric" style={{ '--v4p-accent-dynamic': responseColor }}>
          <div className="v4p-micro-kpi__label">Resposta</div>
          <div className="v4p-micro-kpi__value">{module.tempoResposta}</div>
        </div>
        <div className="v4p-op-status-card__updated">
          <div className="v4p-micro-kpi__label">Atualizado há</div>
          <div className="v4p-card-subtitle">
            <span className="v4p-status-pill__dot" />
            {module.ultimaAtividade} · {module.tendencia}
          </div>
        </div>
      </div>
    </div>
  );
}

function RuntimeStatusBoard({ modules = [] }) {
  const healthy = modules.filter(m => m.estado === OPERATIONAL_STATE.HEALTHY).length;
  const total = modules.length;

  return (
    <div className="v4p-surface-card v4p-medium-panel">
      <div className="v4p-medium-panel__header">
        <div>
          <div className="v4p-card-title">Status dos módulos</div>
          <div className="v4p-card-subtitle">Disponibilidade e desempenho em tempo real</div>
        </div>
        <div className="v4p-card-subtitle">
          <strong>{healthy}</strong>/{total} operacionais
        </div>
      </div>
      <div className="v4p-op-status-grid">
        {modules.length === 0 ? (
          <div style={{ padding: '16px 0', color: 'var(--v4p-text-4)', fontSize: 12 }}>
            Monitoramento de módulos não configurado.
          </div>
        ) : (
          modules.map(m => <ModuleCard key={m.id} module={m} />)
        )}
      </div>
    </div>
  );
}

export default memo(RuntimeStatusBoard);
