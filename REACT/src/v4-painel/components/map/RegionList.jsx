import { memo } from 'react';
import { getRegionStatusMeta } from '../../utils/regionUtils.js';

function RegionListItem({ region, selected, onSelect }) {
  const color = region.color || region.cor || '#22d3ee';
  const name = region.name || region.nome || '—';
  const code = region.code ?? null;
  const city = region.city || region.cidade || '';
  const state = region.state || region.uf || '';
  const location = [city, state].filter(Boolean).join(', ') || null;
  const statusMeta = getRegionStatusMeta(region.status ?? 'ACTIVE');
  const totalPlates = region.totalPlates ?? region.totalBoards ?? region.placas ?? null;

  const occupancyRaw = region.occupancyRate != null
    ? Math.round(Number(region.occupancyRate) * 100)
    : region.ocupacao != null
      ? Number(region.ocupacao)
      : null;

  return (
    <button
      type="button"
      className={`v4p-territory-item${selected ? ' is-selected' : ''}`}
      style={{ '--c': color }}
      onClick={() => onSelect(region)}
      aria-pressed={selected}
    >
      <span className="v4p-territory-item__dot" aria-hidden="true" />
      <div className="v4p-territory-item__body">
        <div className="v4p-territory-item__name-row">
          <span className="v4p-territory-item__name">{name}</span>
        </div>
        <div className="v4p-territory-item__meta">
          {location && (
            <span className="v4p-territory-item__loc">{location}</span>
          )}
          {!location && code && (
            <span className="v4p-territory-item__loc">Código {code}</span>
          )}
          {location && code && (
            <span className="v4p-territory-item__code">{code}</span>
          )}
        </div>
        <div className="v4p-territory-item__status-row">
          <span className={`v4p-territory-item__badge ${statusMeta.className}`}>
            {statusMeta.label}
          </span>
          {totalPlates != null && (
            <span className="v4p-territory-item__meta-chip">{totalPlates} placas</span>
          )}
        </div>
      </div>
      {occupancyRaw != null && (
        <div className="v4p-territory-item__occ" aria-label={`${occupancyRaw}% de ocupação`}>
          <span className="v4p-territory-item__occ-val">{occupancyRaw}%</span>
          <div
            className="v4p-territory-item__bar"
            style={{ '--pct': `${occupancyRaw}%` }}
            role="presentation"
          />
        </div>
      )}
    </button>
  );
}

function RegionList({ regions, selectedRegionId, onSelectRegion }) {
  if (!regions.length) return null;

  return (
    <ul className="v4p-territory-list" role="list" aria-label="Lista de regioes">
      {regions.map((region) => (
        <li key={region.id}>
          <RegionListItem
            region={region}
            selected={selectedRegionId === region.id}
            onSelect={onSelectRegion}
          />
        </li>
      ))}
    </ul>
  );
}

export default memo(RegionList);
