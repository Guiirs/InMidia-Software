import { memo } from 'react';

function TerritoryMiniContext({ regions, onRegionSelect, activeRegion }) {
  if (!regions || regions.length === 0) return null;

  return (
    <div className="inv-territory-ctx">
      <div className="inv-territory-ctx__header">
        <span className="material-symbols-rounded" aria-hidden="true">map</span>
        Contexto territorial
      </div>
      <ul className="inv-territory-ctx__list" role="list">
        {regions.map((r) => {
          const isActive  = activeRegion === r.name;
          const pct       = Math.round(r.occupancy * 100);
          const clickable = Boolean(onRegionSelect);

          return (
            <li
              key={r.name}
              className={`inv-territory-ctx__item${clickable ? ' inv-territory-ctx__item--clickable' : ''}${isActive ? ' inv-territory-ctx__item--active' : ''}`}
              {...(clickable && {
                role:      'button',
                tabIndex:  0,
                'aria-pressed': isActive,
                title:     isActive ? `Remover filtro: ${r.name}` : `Filtrar por ${r.name}`,
                onClick:   () => onRegionSelect(r.name),
                onKeyDown: (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onRegionSelect(r.name);
                  }
                },
              })}
            >
              <span className="inv-territory-ctx__name" title={r.name}>{r.name}</span>
              <div className="inv-territory-ctx__bar-track" aria-hidden="true">
                <div
                  className="inv-territory-ctx__bar-fill"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="inv-territory-ctx__pct">{pct}%</span>
              <span className="inv-territory-ctx__count">{r.total}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default memo(TerritoryMiniContext);
