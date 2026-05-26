import { memo } from 'react';
import { getStateMeta } from '../../foundation/operationalStates.js';

const STATE_ICON = {
  healthy:  'check_circle',
  warning:  'warning',
  critical: 'error',
  degraded: 'trending_down',
  syncing:  'sync',
  pending:  'hourglass_empty',
  offline:  'cloud_off',
  readonly: 'visibility',
};

/**
 * Card reutilizável de status operacional de um módulo ou serviço.
 *
 * Props:
 *   title        — nome do módulo/serviço (obrigatório)
 *   description  — descrição curta (opcional)
 *   status       — estado operacional: 'healthy' | 'warning' | 'critical' | 'degraded' | 'syncing' | 'pending' | 'offline'
 *   availability — porcentagem de disponibilidade (ex: "99,97%")
 *   responseTime — tempo de resposta (ex: "210ms")
 *   updatedAt    — quando foi atualizado (ex: "há 28s")
 *   trend        — tendência textual (ex: "estável", "lento")
 *   message      — mensagem complementar opcional
 */
function OperationalStatusCard({
  title,
  description,
  status = 'pending',
  availability,
  responseTime,
  updatedAt,
  trend,
  message,
}) {
  const meta = getStateMeta(status);
  const icon = STATE_ICON[status] ?? 'device_hub';
  const hasMetrics = availability || responseTime || updatedAt;

  return (
    <div
      className="v4p-op-status-card"
      style={{ '--v4p-accent-dynamic': meta.color }}
    >
      {/* Cabeçalho: título + badge de estado */}
      <div className="v4p-op-status-card__header">
        <div className="v4p-op-status-card__title-row">
          <span
            aria-hidden="true"
            className="v4p-icon v4p-icon--sm material-symbols-rounded"
          >
            {icon}
          </span>
          <span className="v4p-op-status-card__title">{title}</span>
        </div>
        <span
          className="v4p-status-pill v4p-status-pill--sm"
          style={{
            '--v4p-pill-color': meta.color,
            '--v4p-pill-border': `color-mix(in srgb, ${meta.color} 34%, transparent)`,
            '--v4p-pill-bg': `color-mix(in srgb, ${meta.color} 12%, transparent)`,
          }}
          aria-label={`Status: ${meta.label}`}
        >
          <span className="v4p-status-pill__dot" />
          {meta.label}
        </span>
      </div>

      {/* Descrição */}
      {description && (
        <p className="v4p-op-status-card__desc">{description}</p>
      )}

      {/* Métricas */}
      {hasMetrics && (
        <div className="v4p-op-status-card__metrics">
          {availability && (
            <div className="v4p-op-status-card__metric">
              <div className="v4p-micro-kpi__label">Disponibilidade</div>
              <div className="v4p-micro-kpi__value">{availability}</div>
            </div>
          )}
          {responseTime && (
            <div className="v4p-op-status-card__metric">
              <div className="v4p-micro-kpi__label">Resposta</div>
              <div className="v4p-micro-kpi__value">{responseTime}</div>
            </div>
          )}
          {updatedAt && (
            <div className="v4p-op-status-card__updated">
              <div className="v4p-micro-kpi__label">Atualizado há</div>
              <div className="v4p-card-subtitle">
                <span className="v4p-status-pill__dot" />
                {updatedAt}{trend ? ` · ${trend}` : ''}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mensagem opcional */}
      {message && (
        <div className="v4p-op-status-card__message">{message}</div>
      )}
    </div>
  );
}

export default memo(OperationalStatusCard);
