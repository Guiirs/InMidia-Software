import { memo, useCallback, useState } from 'react';
import { useSyncResource } from '../../../core/sync-core/hooks/useSyncResource.js';
import { useFeatures } from '../../providers/FeatureFlagsProvider.jsx';

const DOMAIN_LABELS = {
  inventory:   'Inventário',
  dashboard:   'Dashboard',
  contracts:   'Contratos',
  commercial:  'Comercial',
  alerts:      'Alertas',
  operations:  'Operações',
  reports:     'Relatórios',
};

const STATUS_META = {
  loading:   { label: 'Carregando',    color: 'var(--v4p-accent)',   icon: 'hourglass_empty' },
  idle:      { label: 'Aguardando',    color: 'var(--v4p-text-4)',   icon: 'hourglass_empty' },
  success:   { label: 'Operacional',   color: 'var(--v4p-success)',  icon: 'check_circle' },
  stale:     { label: 'Desatualizado', color: 'var(--v4p-warning)',  icon: 'schedule' },
  error:     { label: 'Erro',          color: 'var(--v4p-danger)',   icon: 'error_outline' },
  offline:   { label: 'Offline',       color: 'var(--v4p-text-4)',   icon: 'cloud_off' },
  unauthorized: { label: 'Sem acesso', color: 'var(--v4p-warning)', icon: 'lock' },
  forbidden: { label: 'Bloqueado',     color: 'var(--v4p-danger)',   icon: 'block' },
  refreshing:{ label: 'Atualizando',   color: 'var(--v4p-accent)',   icon: 'sync' },
};

function getStatusMeta(status) {
  return STATUS_META[status] ?? STATUS_META.idle;
}

function ResourceRow({ resourceKey, label }) {
  const resource = useSyncResource(resourceKey);
  const meta = getStatusMeta(resource.status);

  return (
    <div
      className="v4p-health-row"
      style={{ '--v4p-accent-dynamic': meta.color }}
    >
      <span
        aria-hidden="true"
        className="material-symbols-rounded v4p-health-row__icon"
        style={{ fontSize: 14, color: meta.color }}
      >
        {meta.icon}
      </span>
      <span className="v4p-health-row__label">{label}</span>
      <span className="v4p-health-row__status" style={{ color: meta.color }}>
        {meta.label}
      </span>
    </div>
  );
}

function RealtimeRow({ connected, reconnecting }) {
  const status = reconnecting ? 'refreshing' : connected ? 'success' : 'offline';
  const meta = getStatusMeta(status);
  return (
    <div
      className="v4p-health-row"
      style={{ '--v4p-accent-dynamic': meta.color }}
    >
      <span
        aria-hidden="true"
        className="material-symbols-rounded v4p-health-row__icon"
        style={{ fontSize: 14, color: meta.color }}
      >
        {meta.icon}
      </span>
      <span className="v4p-health-row__label">Realtime</span>
      <span className="v4p-health-row__status" style={{ color: meta.color }}>
        {meta.label}
      </span>
    </div>
  );
}

function FeaturesRow() {
  const flags = useFeatures();
  const allOk = Object.values(flags).some((v) => v === true);
  const meta = allOk ? getStatusMeta('success') : getStatusMeta('idle');
  return (
    <div className="v4p-health-row" style={{ '--v4p-accent-dynamic': meta.color }}>
      <span
        aria-hidden="true"
        className="material-symbols-rounded v4p-health-row__icon"
        style={{ fontSize: 14, color: meta.color }}
      >
        {allOk ? 'toggle_on' : 'toggle_off'}
      </span>
      <span className="v4p-health-row__label">Feature flags</span>
      <span className="v4p-health-row__status" style={{ color: meta.color }}>
        {allOk ? 'Configurado' : 'Padrão'}
      </span>
    </div>
  );
}

/**
 * Painel de saúde do sistema V4 — mostra o status dos recursos críticos.
 * Destinado ao uso no cabeçalho da página de Operações ou no preview canário.
 */
function SystemHealthPanel({ realtimeConnected = false, realtimeReconnecting = false }) {
  const [expanded, setExpanded] = useState(false);

  const toggle = useCallback(() => setExpanded((v) => !v), []);

  const RESOURCE_ROWS = [
    { key: 'features.flags',     label: 'Feature flags' },
    { key: 'dashboard.kpis',     label: 'Dashboard' },
    { key: 'inventory.summary',  label: 'Inventário' },
    { key: 'contracts.summary',  label: 'Contratos' },
    { key: 'commercial.pipeline',label: 'Comercial' },
    { key: 'alerts.summary',     label: 'Alertas' },
    { key: 'operations.summary', label: 'Operações' },
    { key: 'reports.summary',    label: 'Relatórios' },
  ];

  return (
    <div className="v4p-system-health">
      <button
        type="button"
        className="v4p-system-health__toggle v4p-action-button v4p-action-button--ghost v4p-action-button--sm"
        onClick={toggle}
        aria-expanded={expanded}
      >
        <span aria-hidden="true" className="material-symbols-rounded" style={{ fontSize: 13 }}>
          monitor_heart
        </span>
        Saúde do sistema
        <span aria-hidden="true" className="material-symbols-rounded" style={{ fontSize: 13 }}>
          {expanded ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {expanded && (
        <div className="v4p-system-health__panel v4p-surface-card">
          <div className="v4p-panel-header" style={{ marginBottom: 8, paddingBottom: 6 }}>
            <div className="v4p-panel-title" style={{ fontSize: 'var(--v4p-fs-xs)' }}>
              Status dos recursos V4
            </div>
          </div>
          <div className="v4p-system-health__rows">
            {RESOURCE_ROWS.map(({ key, label }) => (
              <ResourceRow key={key} resourceKey={key} label={label} />
            ))}
            <RealtimeRow connected={realtimeConnected} reconnecting={realtimeReconnecting} />
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(SystemHealthPanel);
