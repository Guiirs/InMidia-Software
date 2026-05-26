import React, { useMemo, useState } from 'react';
import { PERMISSIONS } from '../../auth/permissions';
import { useAuth } from '../../context/AuthContext';
import useEntityAudit from '../../hooks/useEntityAudit';
import AuditEventDetails from '../../pages/Audit/AuditEventDetails';
import { describeAuditEvent } from '../../pages/Audit/AuditEventCard';
import './EntityActivityTimeline.css';

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

function summarizeEvent(event = {}) {
  const keys = [
    ...Object.keys(event.before || {}),
    ...Object.keys(event.after || {}),
    ...Object.keys(event.metadata || {}),
  ];
  const uniqueKeys = [...new Set(keys)].filter((key) => !/(password|senha|token|jwt|secret|api|authorization|cookie)/i.test(key));
  if (!uniqueKeys.length) return event.entityLabel || event.entityId || 'Sem resumo adicional';
  return `Campos: ${uniqueKeys.slice(0, 4).join(', ')}`;
}

function EntityActivityTimeline({ entityType, entityId, title = 'Historico', limit = 8 }) {
  const { hasPermission } = useAuth();
  const [selectedEvent, setSelectedEvent] = useState(null);
  const canReadAudit = hasPermission(PERMISSIONS.AUDIT_READ);
  const { data, isLoading, isError } = useEntityAudit(entityType, entityId, { limit });
  const events = data?.events || [];

  const selected = useMemo(
    () => selectedEvent && events.some((event) => String(event._id) === String(selectedEvent._id))
      ? selectedEvent
      : null,
    [events, selectedEvent],
  );

  if (!canReadAudit) return null;

  return (
    <section className="entity-activity" data-testid="entity-activity-timeline">
      <div className="entity-activity__header">
        <h3>{title}</h3>
        <span>{events.length} evento(s)</span>
      </div>

      {isLoading && <p className="entity-activity__empty">Carregando atividades...</p>}
      {isError && <p className="entity-activity__empty">Nao foi possivel carregar o historico.</p>}
      {!isLoading && !isError && events.length === 0 && (
        <p className="entity-activity__empty">Ainda não há atividades registradas.</p>
      )}

      {!isLoading && !isError && events.length > 0 && (
        <ol className="entity-activity__list">
          {events.map((event) => (
            <li key={event._id || `${event.action}-${event.createdAt}`} className="entity-activity__item">
              <div>
                <strong>{describeAuditEvent(event)}</strong>
                <small>{event.actorName || event.actorEmail || 'Sistema'} · {formatDate(event.createdAt)}</small>
                <span>{summarizeEvent(event)}</span>
              </div>
              <button type="button" onClick={() => setSelectedEvent(event)}>
                Detalhes
              </button>
            </li>
          ))}
        </ol>
      )}

      {selected && (
        <div className="entity-activity__details" data-testid="entity-activity-details">
          <button type="button" className="entity-activity__close" onClick={() => setSelectedEvent(null)}>
            Fechar detalhes
          </button>
          <AuditEventDetails event={selected} />
        </div>
      )}
    </section>
  );
}

export { summarizeEvent };
export default EntityActivityTimeline;
