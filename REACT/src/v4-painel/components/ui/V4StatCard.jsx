import { memo } from 'react';
import V4Badge from './V4Badge.jsx';

const STATUS_TO_BADGE = {
  success: 'success',
  healthy: 'success',
  warning: 'warning',
  danger: 'danger',
  critical: 'danger',
  info: 'info',
  muted: 'muted',
};

function V4StatCard({
  title,
  value,
  description,
  trend,
  icon,
  status = 'muted',
  className = '',
  ...props
}) {
  const statusVariant = STATUS_TO_BADGE[status] ?? 'muted';
  const classes = [
    'v4-ui-stat-card',
    `v4-ui-stat-card--${statusVariant}`,
    className,
  ].filter(Boolean).join(' ');

  return (
    <article className={classes} {...props}>
      <div className="v4-ui-stat-card__top">
        <div className="v4-ui-stat-card__heading">
          {title && <h3 className="v4-ui-stat-card__title">{title}</h3>}
          {description && <p className="v4-ui-stat-card__description">{description}</p>}
        </div>
        {icon && <div className="v4-ui-stat-card__icon" aria-hidden="true">{icon}</div>}
      </div>
      <div className="v4-ui-stat-card__value">{value ?? '-'}</div>
      {trend && (
        <div className="v4-ui-stat-card__trend">
          <V4Badge variant={statusVariant} size="sm">{trend}</V4Badge>
        </div>
      )}
    </article>
  );
}

export default memo(V4StatCard);
