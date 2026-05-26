export default function HeaderMetric({
  label,
  value,
  unit = null,
  trend = null,
  size = 'md',
  icon = null
}) {
  return (
    <div className={`v4-header-metric v4-header-metric--${size}`}>
      <div className="v4-header-metric__label">{label}</div>
      <div className="v4-header-metric__value-group">
        {icon && <span className="v4-header-metric__icon">{icon}</span>}
        <div className="v4-header-metric__value-container">
          <span className="v4-header-metric__value">{value}</span>
          {unit && <span className="v4-header-metric__unit">{unit}</span>}
        </div>
      </div>
      {trend && (
        <div className={`v4-header-metric__trend v4-header-metric__trend--${trend.direction}`}>
          {trend.label && <span className="v4-header-metric__trend-label">{trend.label}</span>}
        </div>
      )}
    </div>
  );
}
