import React from 'react';

export function describeAuditEvent(event = {}) {
  const actor = event.actorName || event.actorEmail || 'Sistema';
  const label = event.entityLabel || event.entityId || event.entityType || 'registro';
  const moduleName = event.module || 'sistema';

  if (event.action === 'entity.created') return `${actor} criou ${label}`;
  if (event.action === 'entity.updated') return `${actor} alterou ${label}`;
  if (event.action === 'entity.deleted') return `${actor} removeu ${label}`;
  if (event.action === 'contract.approved') return `${actor} aprovou o contrato ${label}`;
  if (event.action === 'sensitive.access' && moduleName === 'sync') return `${actor} acessou diagnosticos do Sync`;
  if (event.action === 'permission.denied') return `${actor} teve acesso negado em ${label}`;
  if (event.action === 'login') return `${actor} iniciou sessao`;

  return `${actor} executou ${event.action || 'acao'} em ${moduleName}`;
}

function formatDate(value) {
  if (!value) return '-';
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function AuditEventCard({ event, selected, onSelect }) {
  return (
    <button
      type="button"
      className={`audit-event-card ${selected ? 'audit-event-card--selected' : ''}`}
      onClick={() => onSelect?.(event)}
    >
      <span className={`audit-event-card__severity audit-event-card__severity--${event.severity || 'info'}`}>
        {event.severity || 'info'}
      </span>
      <strong>{describeAuditEvent(event)}</strong>
      <small>{event.module || '-'} · {event.action || '-'} · {formatDate(event.createdAt)}</small>
    </button>
  );
}

export default AuditEventCard;
