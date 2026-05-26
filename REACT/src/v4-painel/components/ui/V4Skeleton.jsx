import { memo } from 'react';

const SKELETON_VARIANTS = new Set(['text', 'card', 'table', 'avatar']);

function resolveVariant(variant) {
  return SKELETON_VARIANTS.has(variant) ? variant : 'text';
}

function V4Skeleton({
  variant = 'text',
  rows = 4,
  className = '',
  ...props
}) {
  const safeVariant = resolveVariant(variant);
  const classes = [
    'v4-ui-skeleton',
    `v4-ui-skeleton--${safeVariant}`,
    className,
  ].filter(Boolean).join(' ');

  if (safeVariant === 'table') {
    return (
      <div className={classes} aria-hidden="true" {...props}>
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="v4-ui-skeleton__table-row">
            <span />
            <span />
            <span />
            <span />
          </div>
        ))}
      </div>
    );
  }

  return <span className={classes} aria-hidden="true" {...props} />;
}

export default memo(V4Skeleton);
