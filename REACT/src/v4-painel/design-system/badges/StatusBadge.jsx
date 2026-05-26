/* Badge de estado operacional */
import { memo } from 'react';
import { getStateMeta } from '../../foundation/operationalStates.js';

function StatusBadge({ state, label, size = 'md', dot = true }) {
  const meta = getStateMeta(state);
  const displayLabel = label ?? meta.label;
  const sizeClass = size === 'sm' ? ' v4p-status-pill--sm' : size === 'lg' ? ' v4p-status-pill--lg' : '';
  const toneClass = {
    healthy: 'success',
    warning: 'warning',
    critical: 'danger',
    degraded: 'warning',
    pending: 'neutral',
    syncing: 'accent',
    readonly: 'info',
    offline: 'neutral',
  }[meta.id] ?? 'neutral';

  return (
    <span
      className={`v4p-status-pill v4p-status-pill--${toneClass}${sizeClass}`}
      title={meta.description}
      aria-label={`Status: ${displayLabel}`}
    >
      {dot && (
        <span
          aria-hidden="true"
          className="v4p-status-pill__dot"
        />
      )}
      {displayLabel}
    </span>
  );
}

export default memo(StatusBadge);
