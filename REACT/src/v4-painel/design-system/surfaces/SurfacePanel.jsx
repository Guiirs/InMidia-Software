/* Painel de superfície para agrupar conteúdo relacionado */
import { memo } from 'react';

function SurfacePanel({ children, className = '', noPad = false, style }) {
  return (
    <div
      className={`v4p-surface-card v4p-surface-panel ${className}`}
      style={{
        '--v4p-panel-pad': noPad ? '0px' : 'var(--v4p-card-pad)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export default memo(SurfacePanel);
