import React from 'react';
import AuditEventCard from './AuditEventCard';

function AuditTimeline({ events = [], selectedId, onSelect }) {
  if (!events.length) {
    return <p className="audit-page__empty">Nenhuma atividade encontrada para os filtros atuais.</p>;
  }

  return (
    <ol className="audit-timeline" aria-label="Timeline de auditoria">
      {events.map((event) => (
        <li key={event._id || `${event.action}-${event.createdAt}`}>
          <AuditEventCard
            event={event}
            selected={String(selectedId || '') === String(event._id || '')}
            onSelect={onSelect}
          />
        </li>
      ))}
    </ol>
  );
}

export default AuditTimeline;
