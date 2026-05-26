export default function StatRow({ label, value, unit = null, change = null, trend = null }) {
  return (
    <div className="v4-stat-row">
      <span className="v4-stat-row__label">{label}</span>
      <div className="v4-stat-row__content">
        <span className="v4-stat-row__value">
          {value}
          {unit && <span className="v4-stat-row__unit">{unit}</span>}
        </span>
        {change && (
          <span className={`v4-stat-row__change v4-stat-row__change--${trend || 'neutral'}`}>
            {change}
          </span>
        )}
      </div>
    </div>
  );
}
