import React from 'react';

const MODULES = ['', 'placas', 'propostas', 'contratos', 'admin', 'sync', 'auth', 'rbac'];
const SEVERITIES = ['', 'info', 'warning', 'critical'];

function AuditFilters({ filters, onChange }) {
  const setFilter = (key, value) => onChange({ ...filters, [key]: value, page: 1 });

  return (
    <section className="audit-filters" aria-label="Filtros de auditoria">
      <select aria-label="Modulo" value={filters.module || ''} onChange={(event) => setFilter('module', event.target.value)}>
        {MODULES.map((moduleName) => (
          <option key={moduleName || 'all'} value={moduleName}>{moduleName || 'Todos os modulos'}</option>
        ))}
      </select>
      <input aria-label="Acao" placeholder="Acao" value={filters.action || ''} onChange={(event) => setFilter('action', event.target.value)} />
      <input aria-label="Usuario" placeholder="actorUserId" value={filters.actorUserId || ''} onChange={(event) => setFilter('actorUserId', event.target.value)} />
      <input aria-label="Entidade" placeholder="entityId" value={filters.entityId || ''} onChange={(event) => setFilter('entityId', event.target.value)} />
      <select aria-label="Severidade" value={filters.severity || ''} onChange={(event) => setFilter('severity', event.target.value)}>
        {SEVERITIES.map((severity) => (
          <option key={severity || 'all'} value={severity}>{severity || 'Todas severidades'}</option>
        ))}
      </select>
      <input aria-label="Desde" type="datetime-local" value={filters.since || ''} onChange={(event) => setFilter('since', event.target.value)} />
      <input aria-label="Ate" type="datetime-local" value={filters.until || ''} onChange={(event) => setFilter('until', event.target.value)} />
    </section>
  );
}

export default AuditFilters;
