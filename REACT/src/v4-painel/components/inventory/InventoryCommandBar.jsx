import { memo } from 'react';

const SYNC_META = {
  real:         { label: 'Sincronizado',          icon: 'check_circle', variant: 'ok'      },
  refreshing:   { label: 'Atualizando…',           icon: 'sync',         variant: 'sync'    },
  stale:        { label: 'Desatualizado',           icon: 'schedule',     variant: 'warn'    },
  empty:        { label: 'Sem ativos cadastrados', icon: 'inbox',        variant: 'neutral' },
  error:        { label: 'Erro de sincronização',  icon: 'wifi_off',     variant: 'error'   },
  unauthorized: { label: 'Sessão necessária',      icon: 'lock',         variant: 'error'   },
  forbidden:    { label: 'Sem permissão',          icon: 'block',        variant: 'error'   },
  offline:      { label: 'Sem conexão',            icon: 'wifi_off',     variant: 'error'   },
};

function SyncIndicator({ source, loading }) {
  if (loading) {
    return (
      <span className="inv-cmd__sync inv-cmd__sync--sync">
        <span className="material-symbols-rounded inv-cmd__sync-icon" aria-hidden="true">sync</span>
        Carregando…
      </span>
    );
  }
  const meta = SYNC_META[source] ?? SYNC_META.empty;
  return (
    <span className={`inv-cmd__sync inv-cmd__sync--${meta.variant}`}>
      <span className="material-symbols-rounded inv-cmd__sync-icon" aria-hidden="true">{meta.icon}</span>
      {meta.label}
    </span>
  );
}

function KpiChip({ label, value, accent, loading }) {
  return (
    <div className="inv-cmd__kpi">
      <span
        className="inv-cmd__kpi-value"
        style={accent ? { color: accent } : undefined}
      >
        {loading ? '…' : value}
      </span>
      <span className="inv-cmd__kpi-label">{label}</span>
    </div>
  );
}

function InventoryCommandBar({
  summary       = {},
  source,
  loading       = false,
  filteredCount = null,
  canCreate     = false,
  onCreateBoard,
  actionLoading = false,
  mapSplitOpen  = false,
  onToggleMap,
}) {
  const total      = summary?.total ?? 0;
  const ocupadas   = summary?.ocupadas ?? null;
  const available  = summary?.disponiveis ?? null;
  const critical   = summary?.criticas ?? null;
  const occupancy  = summary?.taxaOcupacao != null
    ? `${Math.round(summary.taxaOcupacao * 100)}%`
    : null;

  const displayTotal = filteredCount !== null && filteredCount !== total
    ? `${filteredCount} / ${total}`
    : total;

  return (
    <header className="inv-cmd">
      <div className="inv-cmd__identity">
        <span className="inv-cmd__eyebrow">Inventário OOH</span>
        <h1 className="inv-cmd__title">Operação de placas</h1>
      </div>

      <div className="inv-cmd__kpis" aria-label="Indicadores operacionais">
        <KpiChip label="ativos" value={displayTotal} loading={loading} />
        {occupancy && (
          <KpiChip label="ocupação" value={occupancy} loading={loading} />
        )}
        {available !== null && (
          <KpiChip label="disponíveis" value={available} accent="#06b6d4" loading={loading} />
        )}
        {critical !== null && critical > 0 && (
          <KpiChip label="críticas" value={critical} accent="#ef4444" loading={loading} />
        )}
      </div>

      <div className="inv-cmd__right">
        <SyncIndicator source={source} loading={loading} />
        <button
          type="button"
          className={`inv-cmd__map-toggle${mapSplitOpen ? ' inv-cmd__map-toggle--active' : ''}`}
          onClick={onToggleMap}
          title={mapSplitOpen ? 'Fechar mapa lateral' : 'Abrir mapa lateral'}
          aria-pressed={mapSplitOpen}
          aria-label="Alternar mapa lateral"
        >
          <span className="material-symbols-rounded" aria-hidden="true">
            {mapSplitOpen ? 'close_fullscreen' : 'map'}
          </span>
          {mapSplitOpen ? 'Fechar mapa' : 'Mapa lateral'}
        </button>
        {canCreate && (
          <button
            type="button"
            className="inv-cmd__cta"
            onClick={onCreateBoard}
            disabled={actionLoading}
            aria-label="Criar nova placa"
          >
            <span className="material-symbols-rounded" aria-hidden="true">add</span>
            Nova placa
          </button>
        )}
      </div>
    </header>
  );
}

export default memo(InventoryCommandBar);
