import { memo, useState } from 'react';
import { AlertsCenter } from '../../components/alerts/index.js';
import { AlertDetailsPanel } from '../../components/alerts/index.js';
import { AlertSeverityOverview } from '../../components/alerts/index.js';
import { AlertTimeline } from '../../components/alerts/index.js';
import { AlertRecommendations } from '../../components/alerts/index.js';
import AlertsProvider, { useAlerts } from '../../providers/AlertsProvider.jsx';
import { useRealtime } from '../../providers/RealtimeProvider.jsx';
import './AlertsPage.css';

const SOURCE_LABEL = {
  real: 'DADOS REAIS',
  fallback: 'FALLBACK',
  mock: 'PREVIEW',
};

function AlertsPageInner() {
  const { alerts, loading, error, source, refresh, dismissAlert, dismissAll } = useAlerts();
  const { connected, eventCount } = useRealtime();
  const [selectedAlert, setSelectedAlert] = useState(null);
  const unread = alerts.totals.open;
  const critical = alerts.totals.critical;

  const selectedFromList = selectedAlert
    ? alerts.alerts.find((item) => item.id === selectedAlert.id) ?? null
    : null;

  return (
    <div className="v4p-alrt-page">
      <div className="v4p-comm-topline">
        <span className={`v4p-comm-source v4p-comm-source--${source}`}>
          {loading ? 'CARREGANDO' : SOURCE_LABEL[source] ?? 'PREVIEW'}
        </span>
        <span className={`v4p-comm-source v4p-comm-source--${connected ? 'real' : 'fallback'}`}>
          {connected ? `LIVE · ${eventCount}` : 'LIVE OFF'}
        </span>
        {error && (
          <div className="v4p-comm-error" role="status">
            <span>{error}</span>
            <button type="button" onClick={refresh}>Atualizar</button>
          </div>
        )}
      </div>

      <header className="v4p-alrt-header">
        <div>
          <span className="v4p-alrt-eyebrow">Alertas</span>
          <h1 className="v4p-alrt-title">Central de ação operacional</h1>
          <p className="v4p-alrt-sub">Alertas críticos, recomendações e histórico de eventos do painel.</p>
        </div>
        <div className="v4p-alrt-hero-stats">
          <article>
            <span>Não lidos</span>
            <strong>{unread}</strong>
          </article>
          <article>
            <span>Críticos</span>
            <strong>{critical}</strong>
          </article>
          <article>
            <span>SLA médio</span>
            <strong>4h</strong>
          </article>
        </div>
        {unread > 0 && (
          <div className="v4p-alrt-live">
            <i />
            {unread} alerta{unread !== 1 ? 's' : ''} pendente{unread !== 1 ? 's' : ''}
          </div>
        )}
      </header>

      <section aria-labelledby="alrt-sev">
        <div id="alrt-sev" className="v4p-alrt-label">Distribuição por severidade</div>
        <AlertSeverityOverview severityOverview={alerts.severityOverview} totals={alerts.totals} />
      </section>

      <section aria-labelledby="alrt-center">
        <div id="alrt-center" className="v4p-alrt-label">Central de alertas</div>
        <div className="v4p-alrt-layout">
          <div className="v4p-alrt-main">
            <AlertsCenter
              alerts={alerts.alerts}
              selectedId={selectedFromList?.id}
              onSelect={setSelectedAlert}
              onDismissAlert={dismissAlert}
              onDismissAll={dismissAll}
            />
          </div>
          <div className="v4p-alrt-side">
            <AlertDetailsPanel alert={selectedFromList} />
          </div>
        </div>
      </section>

      <section aria-labelledby="alrt-bottom">
        <div id="alrt-bottom" className="v4p-alrt-label">Timeline e recomendações</div>
        <div className="v4p-alrt-bottom">
          <AlertTimeline timeline={alerts.timeline} />
          <AlertRecommendations recommendations={alerts.recommendations} />
        </div>
      </section>
    </div>
  );
}

function AlertsPage() {
  return (
    <AlertsProvider>
      <AlertsPageInner />
    </AlertsProvider>
  );
}

export default memo(AlertsPage);
