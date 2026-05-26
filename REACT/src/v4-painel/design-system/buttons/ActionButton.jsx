/* Botão de ação enterprise para operações primárias e secundárias */
import { memo } from 'react';

function ActionButton({
  children,
  variant = 'secondary',
  size = 'md',
  icon,
  iconRight,
  disabled = false,
  loading = false,
  onClick,
  type = 'button',
  title,
  className = '',
  style,
}) {
  const variantClass = ['primary', 'secondary', 'ghost', 'danger', 'subtle'].includes(variant)
    ? variant
    : 'secondary';
  const sizeClass = ['sm', 'md', 'lg'].includes(size) ? size : 'md';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      className={`v4p-action-button v4p-action-button--${variantClass} v4p-action-button--${sizeClass} ${className}`.trim()}
      style={style}
    >
      {loading ? (
        <span aria-hidden="true" className="v4p-action-button__spinner" />
      ) : icon ? (
        <span
          aria-hidden="true"
          className="v4p-icon material-symbols-rounded"
        >
          {icon}
        </span>
      ) : null}
      {children}
      {iconRight && !loading && (
        <span
          aria-hidden="true"
          className="v4p-icon material-symbols-rounded"
        >
          {iconRight}
        </span>
      )}
    </button>
  );
}

export default memo(ActionButton);
