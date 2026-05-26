import React, { useEffect, useMemo, useState } from 'react';
import { PERMISSIONS } from '../../auth/permissions';
import { useAuth } from '../../context/AuthContext';
import { getAuditLogs } from '../../services/auditService';
import AuditEventDetails from './AuditEventDetails';
import AuditFilters from './AuditFilters';
import AuditTimeline from './AuditTimeline';
import './AuditPage.css';

const DEFAULT_FILTERS = {
  module: '',
  action: '',
  actorUserId: '',
  entityId: '',
  severity: '',
  since: '',
  until: '',
  limit: 25,
  page: 1,
};

function cleanFilters(filters) {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== '' && value !== null && value !== undefined));
}

function AuditPage() {
  const { hasPermission } = useAuth();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [events, setEvents] = useState([]);
  const [pagination, setPagination] = useState({});
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setStatus('loading');
    setError('');

    getAuditLogs(cleanFilters(filters))
      .then((result) => {
        if (!active) return;
        setEvents(result.data);
        setPagination(result.pagination || {});
        setSelected((current) => current && result.data.some((event) => event._id === current._id) ? current : result.data[0] || null);
        setStatus('ready');
      })
      .catch((err) => {
        if (!active) return;
        setStatus('error');
        setError(err?.message || 'Nao foi possivel carregar a auditoria.');
      });

    return () => {
      active = false;
    };
  }, [filters]);

  const total = useMemo(() => pagination.totalDocs ?? events.length, [pagination, events.length]);

  if (!hasPermission(PERMISSIONS.AUDIT_READ)) return null;

  return (
    <div className="audit-page" data-testid="audit-page">
      <header className="audit-page__header">
        <div>
          <span className="audit-page__eyebrow">Audit Log</span>
          <h2>Atividades do sistema</h2>
        </div>
        <strong>{total} eventos</strong>
      </header>

      <AuditFilters filters={filters} onChange={setFilters} />

      {status === 'error' && <div className="audit-page__error">{error}</div>}

      <section className="audit-page__content">
        <div className="audit-page__timeline-panel">
          {status === 'loading' ? (
            <p className="audit-page__empty">Carregando auditoria...</p>
          ) : (
            <AuditTimeline events={events} selectedId={selected?._id} onSelect={setSelected} />
          )}
        </div>
        <AuditEventDetails event={selected} />
      </section>
    </div>
  );
}

export default AuditPage;
