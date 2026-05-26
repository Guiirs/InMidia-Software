import React, { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { normalizeRole, PERMISSIONS, ROLES } from '../../auth/permissions';
import useSyncDiagnostics from '../../hooks/useSyncDiagnostics';
import './AdminSyncDiagnostics.css';

const EMPTY_ARRAY = [];

const isAdminRole = (role) => [ROLES.ADMIN_EMPRESA, ROLES.SUPERADMIN].includes(normalizeRole(role));

function formatMetric(value, suffix = '') {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '0';
  return `${value}${suffix}`;
}

function AdminSyncDiagnosticsPage() {
  const { hasPermission } = useAuth();
  const diagnostics = useSyncDiagnostics();
  const [filters, setFilters] = useState({ empresaId: '', type: '', severity: '' });

  const degradedReasons = diagnostics.degradedReason
    ? [diagnostics.degradedReason]
    : (diagnostics.degraded ? ['TRANSPORT_DEGRADED'] : []);
  const recentEvents = diagnostics.recentEvents ?? EMPTY_ARRAY;
  const timeline = diagnostics.incidentsTimeline ?? diagnostics.timeline ?? EMPTY_ARRAY;
  const reconnectEvents = diagnostics.reconnectEvents ?? EMPTY_ARRAY;
  const replayFailures = diagnostics.replayFailures ?? EMPTY_ARRAY;
  const degradedTransitions = diagnostics.degradedTransitionsLog ?? diagnostics.degradedTransitions ?? EMPTY_ARRAY;
  const score = diagnostics.healthScore ?? (diagnostics.degraded ? 60 : 100);
  const status = diagnostics.healthStatus ?? diagnostics.transportHealth ?? 'unknown';
  const filteredTimeline = useMemo(
    () => filterItems(timeline, filters),
    [timeline, filters],
  );
  const filteredReconnectEvents = useMemo(
    () => filterItems(reconnectEvents, filters),
    [reconnectEvents, filters],
  );
  const filteredReplayFailures = useMemo(
    () => filterItems(replayFailures, filters),
    [replayFailures, filters],
  );
  const filteredDegradedTransitions = useMemo(
    () => filterItems(degradedTransitions, filters),
    [degradedTransitions, filters],
  );

  if (!hasPermission(PERMISSIONS.SYNC_OPS_VIEW)) return null;

  return (
    <div className="admin-sync-page" data-testid="admin-sync-panel">
      <div className={`admin-sync-page__status admin-sync-page__status--${diagnostics.transportHealth}`}>
        <div>
          <span className="admin-sync-page__eyebrow">Operational Sync Layer</span>
          <h2>Status do Sync</h2>
        </div>
        <div className="admin-sync-page__score" data-testid="health-score">
          <strong>{score}</strong>
          <span>{status}</span>
        </div>
      </div>

      {diagnostics.legacyCursorDetected && (
        <div className="admin-sync-page__warning" data-testid="legacy-warning">
          Legacy cursor ainda em uso. Acompanhe o contador antes da remocao planejada.
        </div>
      )}

      <section className="admin-sync-page__grid" aria-label="Metricas do Sync">
        <Metric label="Transporte" value={diagnostics.transportMode} />
        <Metric label="Redis conectado" value={diagnostics.redisConnected ? 'sim' : 'nao'} />
        <Metric label="SSE clients" value={formatMetric(diagnostics.sseClientsConnected ?? (diagnostics.sseConnected ? 1 : 0))} />
        <Metric label="latestLagMs" value={formatMetric(diagnostics.latestLagMs, 'ms')} />
        <Metric label="averageLagMs" value={formatMetric(diagnostics.averageLagMs, 'ms')} />
        <Metric label="replayFailures" value={formatMetric(diagnostics.replayFailureCount)} />
        <Metric label="snapshotRecoveries" value={formatMetric(diagnostics.snapshotRecoveries)} />
        <Metric label="legacyCursor usage" value={formatMetric(diagnostics.legacyCursorUses ?? (diagnostics.legacyCursorDetected ? 1 : 0))} />
        <Metric label="reconnect storm" value={diagnostics.reconnectStorm ? 'sim' : 'nao'} />
      </section>

      <section className="admin-sync-page__filters" aria-label="Filtros basicos">
        <input type="text" placeholder="empresaId" aria-label="empresaId" value={filters.empresaId} onChange={(event) => setFilters({ ...filters, empresaId: event.target.value })} />
        <input type="text" placeholder="type" aria-label="type" value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })} />
        <input type="text" placeholder="severity" aria-label="severity" value={filters.severity} onChange={(event) => setFilters({ ...filters, severity: event.target.value })} />
      </section>

      <section className="admin-sync-page__section">
        <h3>Degraded Reasons</h3>
        {degradedReasons.length === 0 ? (
          <p className="admin-sync-page__empty">Nenhuma degradacao ativa.</p>
        ) : (
          <ul>
            {degradedReasons.map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
        )}
      </section>

      <section className="admin-sync-page__section">
        <h3>Recent Events</h3>
        {recentEvents.length === 0 ? (
          <p className="admin-sync-page__empty">Sem eventos recentes nesta sessao.</p>
        ) : (
          <table className="admin-sync-page__table">
            <thead>
              <tr><th>Tipo</th><th>Empresa</th><th>Horario</th></tr>
            </thead>
            <tbody>
              {recentEvents.slice(0, 10).map((event) => (
                <tr key={event.id}>
                  <td>{event.type}</td>
                  <td>{event.empresaId}</td>
                  <td>{event.occurredAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="admin-sync-page__section">
        <h3>Incident Timeline</h3>
        {filteredTimeline.length === 0 ? (
          <p className="admin-sync-page__empty">Sem incidentes recentes.</p>
        ) : (
          <Timeline items={filteredTimeline} />
        )}
      </section>

      <section className="admin-sync-page__columns">
        <DiagnosticList title="Reconnect Events" items={filteredReconnectEvents} empty="Sem reconnect storm." />
        <DiagnosticList title="Replay Failures" items={filteredReplayFailures} empty="Sem falhas recentes." />
        <DiagnosticList title="Degraded Transitions" items={filteredDegradedTransitions} empty="Sem transicoes recentes." />
      </section>
    </div>
  );
}

function filterItems(items, filters) {
  return items.filter((item) => {
    if (filters.empresaId && !String(item.empresaId ?? '').includes(filters.empresaId)) return false;
    if (filters.type && !String(item.type ?? '').includes(filters.type)) return false;
    if (filters.severity && !String(item.severity ?? '').includes(filters.severity)) return false;
    return true;
  });
}

function Metric({ label, value }) {
  return (
    <div className="admin-sync-page__metric">
      <span>{label}</span>
      <strong>{value ?? '-'}</strong>
    </div>
  );
}

function Timeline({ items }) {
  return (
    <ol className="admin-sync-page__timeline">
      {items.slice(0, 12).map((item, index) => (
        <li key={`${item.at}-${item.type}-${index}`}>
          <strong>{item.type}</strong>
          <span>{item.severity ?? 'info'}</span>
          <small>{item.reason ?? item.message ?? item.at}</small>
        </li>
      ))}
    </ol>
  );
}

function DiagnosticList({ title, items, empty }) {
  return (
    <section className="admin-sync-page__section admin-sync-page__section--compact">
      <h3>{title}</h3>
      {items.length === 0 ? (
        <p className="admin-sync-page__empty">{empty}</p>
      ) : (
        <Timeline items={items} />
      )}
    </section>
  );
}

export { isAdminRole };
export default AdminSyncDiagnosticsPage;
