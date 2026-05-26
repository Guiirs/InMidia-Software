import { memo, useState } from 'react';
import { getSeverityMeta } from '../../foundation/severityLevels.js';
import { getStateMeta } from '../../foundation/operationalStates.js';

const SEV_ICON = { critical: 'crisis_alert', high: 'error', medium: 'warning', low: 'info', info: 'info' };

function AlertRow({ alert, isSelected, onClick, onDismiss }) {
  const sevMeta = getSeverityMeta(alert.severidade);
  const stateMeta = getStateMeta(alert.estado);
  const icon = SEV_ICON[alert.severidade] ?? 'notifications';

  return (
    <div
      onClick={() => onClick(alert)}
      className={`v4p-alert-row${isSelected ? ' v4p-alert-row--selected' : ''}`}
      style={{ '--v4p-accent-dynamic': stateMeta.color, '--v4p-row-opacity': alert.lido ? 0.55 : 1 }}
    >
      <span aria-hidden="true" className="v4p-icon v4p-icon--sm material-symbols-rounded" style={{ color: sevMeta.color }}>{icon}</span>
      <div className="v4p-list-item__content">
        <div className="v4p-list-item__title">{alert.titulo}</div>
        <div className="v4p-chip-row">
          <span className="v4p-chip v4p-chip--sm" style={{ '--v4p-pill-color': sevMeta.color, '--v4p-pill-border': `color-mix(in srgb, ${sevMeta.color} 34%, transparent)`, '--v4p-pill-bg': `color-mix(in srgb, ${sevMeta.color} 12%, transparent)` }}>{sevMeta.short}</span>
          {alert.sla && <span className="v4p-chip v4p-chip--sm v4p-chip--neutral">SLA {alert.sla}</span>}
          <span className="v4p-chip v4p-chip--sm v4p-chip--neutral">{alert.owner}</span>
          <span className="v4p-status-pill v4p-status-pill--sm" style={{ '--v4p-pill-color': stateMeta.color, '--v4p-pill-border': `color-mix(in srgb, ${stateMeta.color} 34%, transparent)`, '--v4p-pill-bg': `color-mix(in srgb, ${stateMeta.color} 12%, transparent)` }}>{alert.status}</span>
        </div>
        {alert.acao && <div className="v4p-alert-row__action">→ {alert.acao}</div>}
      </div>
      {!alert.lido && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onDismiss(alert.id); }}
          className="v4p-icon-button material-symbols-rounded"
          title="Marcar como lido"
          aria-label="Marcar alerta como lido"
        >
          close
        </button>
      )}
    </div>
  );
}

function AlertsCenter({ alerts = [], selectedId, onSelect, onDismissAlert, onDismissAll }) {
  const [filter, setFilter] = useState('Todos');
  const unread = alerts.filter(a => !a.lido).length;
  const filters = ['Todos', 'operacional', 'comercial', 'sistema', 'regional', 'contrato', 'manutenção'];
  const filtered = filter === 'Todos' ? alerts : alerts.filter(a => a.categoria === filter);

  return (
    <div className="v4p-surface-card v4p-alerts-panel">
      <div className="v4p-medium-panel__header v4p-alerts-panel__header">
        <div className="v4p-medium-panel__title-row">
          <span aria-hidden="true" className="v4p-icon v4p-icon--sm material-symbols-rounded" style={{ color: 'var(--v4p-danger)' }}>notifications_active</span>
          <div>
            <div className="v4p-card-title">Central de alertas</div>
            <div className="v4p-card-subtitle">{unread} não lido{unread !== 1 ? 's' : ''}</div>
          </div>
        </div>
        {unread > 0 && (
          <button type="button" onClick={onDismissAll} className="v4p-chip v4p-chip--sm v4p-chip--neutral v4p-clickable-chip">
            <span aria-hidden="true" className="v4p-icon v4p-icon--sm material-symbols-rounded">done_all</span>
            Marcar todos
          </button>
        )}
      </div>

      <div className="v4p-alerts-panel__filters">
        {filters.map(f => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`v4p-chip v4p-chip--sm v4p-clickable-chip${filter === f ? ' v4p-chip--accent' : ''}`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="v4p-alerts-panel__list">
        {filtered.map(alert => (
          <AlertRow key={alert.id} alert={alert} isSelected={alert.id === selectedId} onClick={onSelect} onDismiss={onDismissAlert} />
        ))}
        {filtered.length === 0 && (
          <div className="v4p-empty-list">Nenhum alerta nesta categoria.</div>
        )}
      </div>
    </div>
  );
}

export default memo(AlertsCenter);
