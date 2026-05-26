import { memo } from 'react';

const BADGE_VARIANTS = new Set(['default', 'success', 'warning', 'danger', 'info', 'muted']);
const BADGE_SIZES = new Set(['sm', 'md']);

function resolveVariant(variant) {
  return BADGE_VARIANTS.has(variant) ? variant : 'default';
}

function resolveSize(size) {
  return BADGE_SIZES.has(size) ? size : 'md';
}

function V4Badge({
  variant = 'default',
  size = 'md',
  children,
  className = '',
  dot = false,
  ...props
}) {
  const classes = [
    'v4-ui-badge',
    `v4-ui-badge--${resolveVariant(variant)}`,
    `v4-ui-badge--${resolveSize(size)}`,
    className,
  ].filter(Boolean).join(' ');

  return (
    <span className={classes} {...props}>
      {dot && <span className="v4-ui-badge__dot" aria-hidden="true" />}
      <span className="v4-ui-badge__label">{children}</span>
    </span>
  );
}

export default memo(V4Badge);
