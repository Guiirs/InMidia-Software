/* Cartão de alerta operacional */
import { memo } from 'react';
import { getSeverityMeta } from '../../foundation/severityLevels.js';

const ICON_BY_SEVERITY = {
  info:     'info',
  low:      'info',
  medium:   'warning',
  high:     'error',
  critical: 'crisis_alert',
};

function AlertCard({ alert, onMarkRead, compact = false }) {
  const severityMeta = getSeverityMeta(alert.severity);
  const icon         = ICON_BY_SEVERITY[alert.severity] ?? 'notifications';

  return (
    <article
      className={`v4p-surface-card v4p-alert-card${compact ? ' v4p-alert-card--compact' : ''} v4p-state-${alert.state}-border`}
      style={{
        '--v4p-alert-color': severityMeta.color,
        '--v4p-alert-opacity': alert.read ? 0.6 : 1,
      }}
    >
      <span
        aria-hidden="true"
        className={`v4p-icon${compact ? '' : ' v4p-icon--lg'} v4p-alert-card__icon material-symbols-rounded`}
      >
        {icon}
      </span>

      <div className="v4p-alert-card__content">
        <div className="v4p-card-header v4p-alert-card__title-row">
          <p
            className="v4p-card-title"
          >
            {alert.title}
          </p>
          {!alert.read && onMarkRead && (
            <button
              className="v4p-icon-button material-symbols-rounded"
              onClick={() => onMarkRead(alert.id)}
              title="Marcar como lido"
              aria-label="Marcar alerta como lido"
            >
              close
            </button>
          )}
        </div>
        {!compact && (
          <p className="v4p-alert-card__body">
            {alert.body}
          </p>
        )}
        <div className="v4p-alert-card__meta">
          <span
            className="v4p-badge v4p-badge--sm"
            style={{
              '--v4p-pill-color': severityMeta.color,
              '--v4p-pill-border': `${severityMeta.color}44`,
              '--v4p-pill-bg': `${severityMeta.color}14`,
            }}
          >
            {severityMeta.short}
          </span>
          <span className="v4p-card-subtitle">
            {alert.timestamp
              ? new Date(alert.timestamp).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
              : '—'
            }
          </span>
        </div>
      </div>
    </article>
  );
}

export default memo(AlertCard);
