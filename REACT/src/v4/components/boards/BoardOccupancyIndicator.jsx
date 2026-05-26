function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export default function BoardOccupancyIndicator({
  occupancy = 0,
  availabilityLabel = 'Sem disponibilidade',
  className = ''
}) {
  const occupancySafe = Number.isFinite(occupancy) ? clamp(occupancy, 0, 100) : 0;

  let tone = 'normal';
  if (occupancySafe >= 85) {
    tone = 'critico';
  } else if (occupancySafe >= 65) {
    tone = 'atencao';
  }

  const rootClass = [
    'v4-board-occupancy',
    `v4-board-occupancy--${tone}`,
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={rootClass}>
      <div className="v4-board-occupancy__top">
        <span className="v4-board-occupancy__label">Ocupacao</span>
        <strong className="v4-board-occupancy__value">{occupancySafe}%</strong>
      </div>

      <div className="v4-board-occupancy__bar" aria-hidden="true">
        <span className="v4-board-occupancy__fill" style={{ width: `${occupancySafe}%` }} />
      </div>

      <p className="v4-board-occupancy__hint">{availabilityLabel}</p>
    </div>
  );
}
