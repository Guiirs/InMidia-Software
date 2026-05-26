/* Cartão base reutilizável para blocos de conteúdo operacional */
import { memo } from 'react';

function OperationalCard({
  title,
  subtitle,
  headerAction,
  children,
  state,         // 'healthy' | 'warning' | 'critical' | etc.
  elevated = false,
  noPad = false,
  className = '',
  style,
  onClick,
}) {
  const surfaceClass = elevated ? 'v4p-surface-raised' : 'v4p-surface-card';
  const interactiveClass = onClick ? ' v4p-interactive' : '';
  const stateClass = state ? ` v4p-state-${state}-border` : '';
  const headerClass = [
    'v4p-card-header',
    'v4p-operational-card__header',
    noPad ? 'v4p-operational-card__header--no-pad' : '',
    children ? 'v4p-operational-card__header--divider' : '',
  ].filter(Boolean).join(' ');

  return (
    <article
      className={`${surfaceClass} v4p-operational-card${interactiveClass}${stateClass} ${className}`}
      style={style}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {(title || headerAction) && (
        <div className={headerClass}>
          <div className="v4p-card-header__body">
            {title && (
              <div className="v4p-card-title">
                {title}
              </div>
            )}
            {subtitle && (
              <div className="v4p-card-subtitle">
                {subtitle}
              </div>
            )}
          </div>
          {headerAction && <div className="v4p-card-header__action">{headerAction}</div>}
        </div>
      )}

      {children && (
        <div className={noPad ? 'v4p-card-body v4p-card-body--flush' : 'v4p-card-body'}>
          {children}
        </div>
      )}
    </article>
  );
}

export default memo(OperationalCard);
