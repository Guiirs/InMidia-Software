import { memo } from 'react';

const EMPTY_DISTRIBUTION = [
  { status: 'occupied', label: 'Ocupadas', count: 0, percentage: 0, pct: 0, cor: 'var(--v4p-success)', icone: 'check_circle' },
  { status: 'available', label: 'Disponiveis', count: 0, percentage: 0, pct: 0, cor: 'var(--v4p-accent)', icone: 'radio_button_unchecked' },
  { status: 'maintenance', label: 'Em manutencao', count: 0, percentage: 0, pct: 0, cor: 'var(--v4p-warning)', icone: 'build' },
  { status: 'reserved', label: 'Reservadas', count: 0, percentage: 0, pct: 0, cor: 'var(--v4p-info)', icone: 'bookmark' },
  { status: 'critical', label: 'Criticas', count: 0, percentage: 0, pct: 0, cor: 'var(--v4p-danger)', icone: 'crisis_alert' },
];

function OccupancyDistribution({ distribution, total }) {
  const items = Array.isArray(distribution) && distribution.length > 0
    ? distribution
    : EMPTY_DISTRIBUTION;
  const totalBoards = total ?? 0;

  return (
    <div className="v4p-surface-card v4p-card-compact">
      <div className="v4p-card-title v4p-card-header--divider">
        Distribuicao do inventario
      </div>

      <div className="v4p-occupancy-card__bar">
        {items.map((cat) => (
          <div
            key={cat.status ?? cat.label}
            title={`${cat.label}: ${cat.count} (${Math.round((cat.pct ?? cat.percentage ?? 0) * 100)}%)`}
            className="v4p-occupancy-card__bar-segment"
            style={{
              '--v4p-segment-flex': cat.count,
              '--v4p-segment-color': cat.cor,
              '--v4p-segment-min': cat.count > 5 ? '4px' : '0',
            }}
          />
        ))}
      </div>

      <div className="v4p-occupancy-card__list">
        {items.map((cat) => (
          <div
            key={cat.status ?? cat.label}
            className="v4p-occupancy-card__row"
            style={{ '--v4p-row-color': cat.cor }}
          >
            <span aria-hidden="true" className="v4p-icon v4p-icon--sm material-symbols-rounded">{cat.icone}</span>
            <span className="v4p-card-subtitle v4p-occupancy-card__label">{cat.label}</span>
            <span className="v4p-card-title v4p-occupancy-card__count">{cat.count}</span>
            <span className="v4p-card-subtitle v4p-occupancy-card__pct">{Math.round((cat.pct ?? cat.percentage ?? 0) * 100)}%</span>
            <div className="v4p-occupancy-card__mini-track">
              <div
                className="v4p-occupancy-card__mini-fill"
                style={{ '--v4p-progress-value': `${(cat.pct ?? cat.percentage ?? 0) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="v4p-occupancy-card__footer">
        <span className="v4p-card-subtitle">Total de pontos</span>
        <span className="v4p-card-title">{totalBoards}</span>
      </div>
    </div>
  );
}

export default memo(OccupancyDistribution);
