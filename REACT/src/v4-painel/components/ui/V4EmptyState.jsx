import { memo } from 'react';

function V4EmptyState({
  icon,
  title,
  description,
  action,
  className = '',
  compact = false,
  ...props
}) {
  const classes = [
    'v4-ui-empty-state',
    compact ? 'v4-ui-empty-state--compact' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} role="status" {...props}>
      {icon && <div className="v4-ui-empty-state__icon" aria-hidden="true">{icon}</div>}
      <div className="v4-ui-empty-state__body">
        {title && <h3 className="v4-ui-empty-state__title">{title}</h3>}
        {description && <p className="v4-ui-empty-state__description">{description}</p>}
      </div>
      {action && <div className="v4-ui-empty-state__action">{action}</div>}
    </div>
  );
}

export default memo(V4EmptyState);
