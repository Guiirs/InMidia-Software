import { memo } from 'react';

/*
 * DataSourceBadge — indica a origem e frescor dos dados exibidos.
 *
 * source:
 *   'realtime'   — dados em tempo real via websocket
 *   'synced'     — dados sincronizados recentemente (< 5 min)
 *   'cached'     — dados em cache (> 5 min, < 1h)
 *   'stale'      — dados desatualizados (> 1h)
 *   'demo'       — dados demonstrativos (sem produção)
 *   'offline'    — sem conexão com servidor
 *
 * Linguagem operacional — nunca técnica.
 * Não usar: "mock", "websocket", "sync provider", "cache hit".
 */
export const DATA_SOURCE = {
  REALTIME: 'realtime',
  SYNCED:   'synced',
  CACHED:   'cached',
  STALE:    'stale',
  DEMO:     'demo',
  OFFLINE:  'offline',
};

const SOURCE_CONFIG = {
  realtime: {
    label:  'Atualizado agora',
    icon:   'sensors',
    status: 'success',
  },
  synced: {
    label:  'Dados sincronizados',
    icon:   'cloud_done',
    status: 'success',
  },
  cached: {
    label:  'Atualização pendente',
    icon:   'schedule',
    status: 'warning',
  },
  stale: {
    label:  'Dados desatualizados',
    icon:   'sync_problem',
    status: 'warning',
  },
  demo: {
    label:  'Dados demonstrativos',
    icon:   'experiment',
    status: 'neutral',
  },
  offline: {
    label:  'Sem conexão',
    icon:   'cloud_off',
    status: 'danger',
  },
};

function DataSourceBadge({ source = 'synced', label, updatedAt, compact = false }) {
  const config = SOURCE_CONFIG[source] ?? SOURCE_CONFIG.synced;
  const displayLabel = label ?? config.label;

  return (
    <span
      className={`v4p-datasource-badge v4p-datasource-badge--${source} v4p-datasource-badge--${config.status}${compact ? ' v4p-datasource-badge--compact' : ''}`}
      title={updatedAt ? `Última atualização: ${updatedAt}` : displayLabel}
      aria-label={`Fonte dos dados: ${displayLabel}${updatedAt ? `, atualizado em ${updatedAt}` : ''}`}
    >
      <span
        className={`v4p-datasource-icon material-symbols-rounded`}
        aria-hidden="true"
      >
        {config.icon}
      </span>
      {!compact && <span className="v4p-datasource-label">{displayLabel}</span>}
      {!compact && updatedAt && (
        <span className="v4p-datasource-time" aria-hidden="true">· {updatedAt}</span>
      )}
    </span>
  );
}

export default memo(DataSourceBadge);
