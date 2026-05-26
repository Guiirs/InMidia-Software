import { memo } from 'react';

const CARD_VARIANTS = new Set(['default', 'elevated', 'interactive', 'danger', 'success', 'warning']);

function resolveVariant(variant) {
  return CARD_VARIANTS.has(variant) ? variant : 'default';
}

function V4Card({
  variant = 'default',
  title,
  subtitle,
  children,
  actions,
  className = '',
  ...props
}) {
  const safeVariant = resolveVariant(variant);
  const classes = [
    'v4-ui-card',
    `v4-ui-card--${safeVariant}`,
    className,
  ].filter(Boolean).join(' ');
  const hasHeader = title || subtitle || actions;

  return (
    <article className={classes} {...props}>
      {hasHeader && (
        <div className="v4-ui-card__header">
          <div className="v4-ui-card__heading">
            {title && <h3 className="v4-ui-card__title">{title}</h3>}
            {subtitle && <p className="v4-ui-card__subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="v4-ui-card__actions">{actions}</div>}
        </div>
      )}
      {children && <div className="v4-ui-card__body">{children}</div>}
    </article>
  );
}

export default memo(V4Card);
