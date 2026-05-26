import { memo } from 'react';

const BUTTON_VARIANTS = new Set(['primary', 'secondary', 'ghost', 'danger', 'success']);
const BUTTON_SIZES = new Set(['sm', 'md', 'lg']);

function resolveVariant(variant) {
  return BUTTON_VARIANTS.has(variant) ? variant : 'secondary';
}

function resolveSize(size) {
  return BUTTON_SIZES.has(size) ? size : 'md';
}

function V4Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  disabled = false,
  iconLeft,
  iconRight,
  children,
  className = '',
  type = 'button',
  ...props
}) {
  const classes = [
    'v4-ui-button',
    `v4-ui-button--${resolveVariant(variant)}`,
    `v4-ui-button--${resolveSize(size)}`,
    loading ? 'v4-ui-button--loading' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading ? 'true' : undefined}
      {...props}
    >
      {loading && <span className="v4-ui-button__spinner" aria-hidden="true" />}
      {!loading && iconLeft && <span className="v4-ui-button__icon">{iconLeft}</span>}
      {children && <span className="v4-ui-button__label">{children}</span>}
      {!loading && iconRight && <span className="v4-ui-button__icon">{iconRight}</span>}
    </button>
  );
}

export default memo(V4Button);
