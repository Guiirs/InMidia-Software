import { memo } from 'react';
import { getSeverityMeta } from '../../foundation/severityLevels.js';
import { getStateMeta } from '../../foundation/operationalStates.js';

const SEV_ICON = { critical: 'crisis_alert', high: 'error', medium: 'warning', low: 'info', info: 'info' };

function AlertDetailsPanel({ alert }) {
  if (!alert) {
    return (
      <div className="v4p-surface-card v4p-empty-medium">
        <span aria-hidden="true" className="v4p-icon v4p-icon--lg material-symbols-rounded">notifications</span>
        <p className="v4p-card-title">Selecione um alerta</p>
        <p className="v4p-card-subtitle">Clique em qualquer alerta para ver os detalhes e histórico.</p>
      </div>
    );
  }

  const sevMeta = getSeverityMeta(alert.severidade);
  const stateMeta = getStateMeta(alert.estado);
  const icon = SEV_ICON[alert.severidade] ?? 'notifications';
  const title = alert.title ?? alert.titulo;
  const description = alert.description ?? alert.descricao;
  const category = alert.category ?? alert.categoria;
  const impact = alert.impact ?? alert.impacto;
  const recommendation = alert.recommendation ?? alert.acao;
  const regions = alert.regioesAfetadas ?? (alert.region ? [alert.region] : ['Todos']);

  return (
    <div className="v4p-surface-card v4p-detail-card" style={{ '--v4p-accent-dynamic': sevMeta.color }}>
      <div className="v4p-card-header">
        <span aria-hidden="true" className="v4p-icon v4p-icon--lg material-symbols-rounded" style={{ color: sevMeta.color }}>{icon}</span>
        <div className="v4p-card-header__body">
          <div className="v4p-card-title">{title}</div>
          <div className="v4p-chip-row">
            <span className="v4p-chip v4p-chip--sm" style={{ '--v4p-pill-color': sevMeta.color, '--v4p-pill-border': `color-mix(in srgb, ${sevMeta.color} 34%, transparent)`, '--v4p-pill-bg': `color-mix(in srgb, ${sevMeta.color} 12%, transparent)` }}>{sevMeta.label}</span>
            <span className="v4p-status-pill v4p-status-pill--sm" style={{ '--v4p-pill-color': stateMeta.color, '--v4p-pill-border': `color-mix(in srgb, ${stateMeta.color} 34%, transparent)`, '--v4p-pill-bg': `color-mix(in srgb, ${stateMeta.color} 12%, transparent)` }}>{alert.status}</span>
            <span className="v4p-chip v4p-chip--sm v4p-chip--neutral">{category}</span>
          </div>
        </div>
      </div>

      <p className="v4p-detail-description">{description}</p>

      <div className="v4p-compact-list">
        {[
          { l: 'Impacto', v: impact, c: 'var(--v4p-warning)' },
          { l: 'Owner', v: alert.owner, c: 'var(--v4p-text-2)' },
          { l: 'SLA', v: alert.sla ?? 'Sem SLA', c: 'var(--v4p-text-2)' },
          { l: 'Regiões afetadas', v: regions.join(', '), c: 'var(--v4p-text-2)' },
        ].map(s => (
          <div key={s.l} className="v4p-detail-row">
            <span className="v4p-detail-row__label">{s.l}</span>
            <span className="v4p-detail-row__value" style={{ '--v4p-accent-dynamic': s.c }}>{s.v}</span>
          </div>
        ))}
      </div>

      {recommendation && (
        <div className="v4p-accent-card v4p-accent-card--stack" style={{ '--v4p-accent-dynamic': 'var(--v4p-accent)' }}>
          <div className="v4p-section-label">Ação em andamento</div>
          <div className="v4p-card-subtitle">{recommendation}</div>
        </div>
      )}

      {alert.historico && (
        <div>
          <div className="v4p-section-label">Histórico</div>
          <div className="v4p-timeline">
            {alert.historico.map((h, i) => (
              <div key={i} className="v4p-timeline-item">
                <span className="v4p-timeline-dot v4p-timeline-dot--sm" />
                <div className="v4p-timeline-content">
                  <span className="v4p-timeline-time">{h.tempo}</span>
                  <div className="v4p-timeline-title">{h.evento}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(AlertDetailsPanel);
