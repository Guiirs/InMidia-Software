import { memo, useState } from 'react';
import { getSeverityMeta } from '../../foundation/severityLevels.js';
import { getStateMeta } from '../../foundation/operationalStates.js';

const SEV_ICON = { critical: 'crisis_alert', high: 'error', medium: 'warning', low: 'info', info: 'info' };

function AlertRow({ alert, onDismiss }) {
  const sevMeta   = getSeverityMeta(alert.severidade);
  const stateMeta = getStateMeta(alert.estado);
  const icon      = SEV_ICON[alert.severidade] ?? 'notifications';

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '20px 1fr auto',
        gap: 10,
        padding: '10px 0',
        borderBottom: '1px solid var(--v4p-border-soft)',
        opacity: alert.lido ? 0.5 : 1,
        transition: 'opacity var(--v4p-t-base)',
        alignItems: 'flex-start',
      }}
    >
      {/* Ícone */}
      <span
        aria-hidden="true"
        className="material-symbols-rounded"
        style={{
          fontSize: 16,
          color: sevMeta.color,
          lineHeight: 1.2,
          marginTop: 1,
        }}
      >
        {icon}
      </span>

      {/* Conteúdo */}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--v4p-text-1)', marginBottom: 2, lineHeight: 1.3 }}>
          {alert.titulo}
        </div>
        <div style={{ fontSize: 11, color: 'var(--v4p-text-3)', marginBottom: 5, lineHeight: 1.4 }}>
          {alert.descricao}
        </div>
        <div className="v4p-chip-row" style={{ gap: 5 }}>
          <span className="v4p-chip v4p-chip--sm" style={{ color: sevMeta.color, borderColor: `color-mix(in srgb, ${sevMeta.color} 34%, transparent)`, background: `color-mix(in srgb, ${sevMeta.color} 12%, transparent)` }}>
            {sevMeta.short}
          </span>
          {alert.sla && (
            <span className="v4p-chip v4p-chip--sm v4p-chip--neutral">SLA: {alert.sla}</span>
          )}
          <span className="v4p-chip v4p-chip--sm v4p-chip--neutral">{alert.owner}</span>
          <span className="v4p-status-pill v4p-status-pill--sm" style={{ color: stateMeta.color, borderColor: `color-mix(in srgb, ${stateMeta.color} 34%, transparent)`, background: `color-mix(in srgb, ${stateMeta.color} 12%, transparent)` }}>{alert.status}</span>
        </div>
        {alert.acao && (
          <div style={{ marginTop: 4, fontSize: 11, color: 'var(--v4p-accent)', fontStyle: 'italic' }}>
            → {alert.acao}
          </div>
        )}
      </div>

      {/* Dismiss */}
      {!alert.lido && (
        <button
          onClick={() => onDismiss(alert.id)}
          className="material-symbols-rounded"
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            color: 'var(--v4p-text-4)', fontSize: 13,
            lineHeight: 1, flexShrink: 0,
          }}
          title="Marcar como lido"
          aria-label="Marcar como lido"
        >
          close
        </button>
      )}
    </div>
  );
}

function SmartAlertsPanel({ alerts: initialAlerts = [] }) {
  const [alerts, setAlerts] = useState(initialAlerts);
  const unread = alerts.filter(a => !a.lido).length;

  const dismiss = (id) => setAlerts(prev => prev.map(a => a.id === id ? { ...a, lido: true } : a));
  const dismissAll = () => setAlerts(prev => prev.map(a => ({ ...a, lido: true })));

  return (
    <div className="v4p-surface-card" style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid var(--v4p-border-soft)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span aria-hidden="true" className="material-symbols-rounded" style={{ fontSize: 16, color: 'var(--v4p-danger)' }}>notifications_active</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--v4p-text-2)' }}>Alertas inteligentes</div>
            <div style={{ fontSize: 10, color: 'var(--v4p-text-4)' }}>{unread} não lido{unread !== 1 ? 's' : ''}</div>
          </div>
        </div>
        {unread > 0 && (
          <button
            onClick={dismissAll}
            style={{
              background: 'transparent', cursor: 'pointer', color: 'var(--v4p-text-3)',
              fontFamily: 'var(--v4p-font)',
            }}
            className="v4p-chip v4p-chip--sm"
          >
            <span aria-hidden="true" className="material-symbols-rounded" style={{ fontSize: 12 }}>done_all</span>
            Marcar todos
          </button>
        )}
      </div>

      <div>
        {alerts.map(alert => (
          <AlertRow key={alert.id} alert={alert} onDismiss={dismiss} />
        ))}
      </div>
    </div>
  );
}

export default memo(SmartAlertsPanel);
