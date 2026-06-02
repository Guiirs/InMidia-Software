import { memo } from 'react';

const RAIL_ITEMS = [
  { value: 'Todos',      label: 'Todas',      color: null,      distKey: null           },
  { value: 'Ocupado',    label: 'Ocupadas',   color: 'var(--v4p-success)', distKey: 'occupied'     },
  { value: 'Disponivel', label: 'Disponíveis',color: 'var(--v4p-accent)',  distKey: 'available'    },
  { value: 'Reservado',  label: 'Reservadas', color: 'var(--v4p-info)',    distKey: 'reserved'     },
  { value: 'Manutencao', label: 'Manutenção', color: 'var(--v4p-warning)', distKey: 'maintenance'  },
  { value: 'Critico',    label: 'Críticas',   color: 'var(--v4p-danger)',  distKey: 'critical'     },
];

function resolveCount(distKey, distribution, total) {
  if (!distKey) return total ?? 0;
  if (!distribution) return 0;
  if (Array.isArray(distribution)) {
    return distribution.find((d) => d.status === distKey)?.count ?? 0;
  }
  return distribution[distKey] ?? 0;
}

function InventoryStatusRail({
  value        = 'Todos',
  onChange,
  distribution = null,
  total        = 0,
  loading      = false,
}) {
  return (
    <nav className="inv-status-rail" aria-label="Filtrar por status operacional">
      {RAIL_ITEMS.map((item) => {
        const count  = resolveCount(item.distKey, distribution, total);
        const active = value === item.value;

        return (
          <button
            key={item.value}
            type="button"
            className={`inv-status-pill${active ? ' inv-status-pill--active' : ''}`}
            onClick={() => onChange?.(item.value)}
            style={item.color ? { '--isp-color': item.color } : undefined}
            aria-pressed={active}
          >
            {item.color && (
              <span
                className="inv-status-pill__dot"
                aria-hidden="true"
              />
            )}
            {item.label}
            <span className="inv-status-pill__count">
              {loading ? '…' : count}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

export default memo(InventoryStatusRail);
