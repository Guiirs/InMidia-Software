import { memo } from 'react';

const SEVERITY_LABEL = {
  CRITICAL: 'Critico',
  WARNING: 'Aviso',
  INFO: 'Info',
};

function formatDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);
}

function RegionAlertsPanel({ alerts = [], summary, loading, error }) {
  const counts = summary ?? { total: alerts.length, critical: 0, warning: 0, temporal: 0 };

  return (
    <section className="v4p-region-alerts" aria-label="Alertas regionais">
      <header className="v4p-region-panel-header">
        <div>
          <span className="material-symbols-rounded" aria-hidden="true">notification_important</span>
          <h4>Alertas regionais</h4>
        </div>
        <span>{counts.critical ?? 0} criticos</span>
      </header>

      <div className="v4p-region-alerts__metrics">
        <div><strong>{counts.total ?? 0}</strong><span>Total</span></div>
        <div><strong>{counts.critical ?? 0}</strong><span>Criticos</span></div>
        <div><strong>{counts.warning ?? 0}</strong><span>Avisos</span></div>
        <div><strong>{counts.temporal ?? 0}</strong><span>Temporais</span></div>
      </div>

      {loading && <div className="v4p-region-panel-state">Carregando alertas territoriais.</div>}
      {!loading && error && <div className="v4p-region-panel-state is-error">{error}</div>}
      {!loading && !error && alerts.length === 0 && (
        <div className="v4p-region-panel-state">Nenhum alerta critico nesta regiao.</div>
      )}
      {!loading && !error && alerts.length > 0 && (
        <div className="v4p-region-alerts__list">
          {alerts.slice(0, 5).map((alert) => {
            const severity = alert.severity ?? 'INFO';
            return (
              <article key={alert.id} className="v4p-region-alert-card">
                <span className={`v4p-region-alert-card__severity is-${severity.toLowerCase()}`}>
                  {SEVERITY_LABEL[severity] ?? severity}
                </span>
                <strong>{alert.message}</strong>
                <div>
                  <span>{alert.source === 'TEMPORAL_EVENT' ? 'Temporal Engine' : 'Alertas V4'}</span>
                  {formatDate(alert.createdAt) && <span>{formatDate(alert.createdAt)}</span>}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default memo(RegionAlertsPanel);
