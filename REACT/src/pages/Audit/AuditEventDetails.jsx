import React from 'react';

const SENSITIVE_PATTERN = /(password|senha|token|jwt|secret|api|authorization|cookie)/i;

function stripSensitive(value) {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(stripSensitive);
  return Object.entries(value).reduce((acc, [key, entry]) => {
    if (SENSITIVE_PATTERN.test(key)) return acc;
    acc[key] = stripSensitive(entry);
    return acc;
  }, {});
}

function JsonBlock({ title, value }) {
  if (value === undefined || value === null) {
    return (
      <div className="audit-details__block">
        <h4>{title}</h4>
        <p className="audit-page__empty">Sem dados.</p>
      </div>
    );
  }

  return (
    <div className="audit-details__block">
      <h4>{title}</h4>
      <pre>{JSON.stringify(stripSensitive(value), null, 2)}</pre>
    </div>
  );
}

function AuditEventDetails({ event }) {
  if (!event) {
    return (
      <aside className="audit-details">
        <h3>Detalhe do evento</h3>
        <p className="audit-page__empty">Selecione uma atividade para ver os detalhes.</p>
      </aside>
    );
  }

  return (
    <aside className="audit-details">
      <h3>Detalhe do evento</h3>
      <dl>
        <div><dt>Ator</dt><dd>{event.actorName || event.actorEmail || event.actorUserId || 'Sistema'}</dd></div>
        <div><dt>Modulo</dt><dd>{event.module || '-'}</dd></div>
        <div><dt>Entidade</dt><dd>{event.entityType || '-'} / {event.entityId || '-'}</dd></div>
        <div><dt>Correlation ID</dt><dd>{event.correlationId || '-'}</dd></div>
      </dl>
      <JsonBlock title="Antes" value={event.before} />
      <JsonBlock title="Depois" value={event.after} />
      <JsonBlock title="Metadata" value={event.metadata} />
    </aside>
  );
}

export { stripSensitive };
export default AuditEventDetails;
