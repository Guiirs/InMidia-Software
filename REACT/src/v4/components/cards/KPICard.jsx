export default function KPICard({ label, value, change, trend, icon = null, onClick = null }) {
  return (
    <div className="v4-kpi-card" onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}>
      <div className="v4-kpi-card__header">
        {icon && <span className="v4-kpi-card__icon">{icon}</span>}
        <span className="v4-kpi-card__label">{label}</span>
      </div>
      <div className="v4-kpi-card__value">{value}</div>
      {change && (
        <div className={`v4-kpi-card__change v4-kpi-card__change--${trend || 'neutral'}`}>
          {change}
        </div>
      )}
    </div>
  );
}
