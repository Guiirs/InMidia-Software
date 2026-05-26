/* Cartão de métrica com valor grande, tendência e estado operacional */
import { memo } from 'react';

function MetricCard({
  label,
  value,
  trend,
  trendUp,
  period,
  state = 'healthy',
  icon,
  onClick,
}) {
  return (
    <article
      className={`v4p-surface-card v4p-metric-card v4p-state-${state}-border${onClick ? ' v4p-interactive' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {/* Linha superior */}
      <div className="v4p-card-header v4p-metric-card__header">
        <span className="v4p-card-title">{label}</span>
        {icon && (
          <span
            aria-hidden="true"
            className="v4p-icon v4p-metric-card__icon material-symbols-rounded"
          >
            {icon}
          </span>
        )}
      </div>

      {/* Valor */}
      <div className="v4p-metric v4p-metric-card__value">
        {value}
      </div>

      {/* Tendência */}
      {(trend || period) && (
        <div className="v4p-chip-row">
          {trend && (
            <span
              className={`v4p-metric-pill v4p-metric-pill--sm v4p-metric-pill--${trendUp ? 'success' : 'danger'}`}
            >
              <span
                aria-hidden="true"
                className="v4p-icon v4p-icon--sm material-symbols-rounded"
              >
                {trendUp ? 'trending_up' : 'trending_down'}
              </span>
              {trend}
            </span>
          )}
          {period && (
            <span className="v4p-card-subtitle">
              {period}
            </span>
          )}
        </div>
      )}
    </article>
  );
}

export default memo(MetricCard);
