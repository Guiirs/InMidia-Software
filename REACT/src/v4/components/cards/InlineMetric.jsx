export default function InlineMetric({ label, value, unit = null, size = 'md' }) {
  return (
    <div className={`v4-inline-metric v4-inline-metric--${size}`}>
      <span className="v4-inline-metric__label">{label}</span>
      <span className="v4-inline-metric__value">
        {value}
        {unit && <span className="v4-inline-metric__unit">{unit}</span>}
      </span>
    </div>
  );
}
