import { memo } from 'react';

const BOARD_STATUS = {
  OCCUPIED: 'occupied',
  AVAILABLE: 'available',
  MAINTENANCE: 'maintenance',
  RESERVED: 'reserved',
  CRITICAL: 'critical',
};

const STATUS_META = {
  [BOARD_STATUS.OCCUPIED]: { label: 'Ocupado', color: 'var(--v4p-success)', bg: 'var(--v4p-success-xsoft)', icon: 'check_circle' },
  [BOARD_STATUS.AVAILABLE]: { label: 'Disponível', color: 'var(--v4p-accent)', bg: 'var(--v4p-accent-xsoft)', icon: 'radio_button_unchecked' },
  [BOARD_STATUS.MAINTENANCE]: { label: 'Manutenção', color: 'var(--v4p-warning)', bg: 'var(--v4p-warning-xsoft)', icon: 'build' },
  [BOARD_STATUS.RESERVED]: { label: 'Reservado', color: 'var(--v4p-info)', bg: 'var(--v4p-info-soft)', icon: 'bookmark' },
  [BOARD_STATUS.CRITICAL]: { label: 'Crítico', color: 'var(--v4p-danger)', bg: 'var(--v4p-danger-xsoft)', icon: 'crisis_alert' },
};

function BoardStatusBadge({ status, showIcon = true, size = 'md' }) {
  const meta = STATUS_META[status] ?? STATUS_META[BOARD_STATUS.AVAILABLE];
  const tone = {
    [BOARD_STATUS.OCCUPIED]: 'success',
    [BOARD_STATUS.AVAILABLE]: 'accent',
    [BOARD_STATUS.MAINTENANCE]: 'warning',
    [BOARD_STATUS.RESERVED]: 'info',
    [BOARD_STATUS.CRITICAL]: 'danger',
  }[status] ?? 'accent';

  return (
    <span
      className={`v4p-status-pill v4p-status-pill--table v4p-status-pill--${tone}${size === 'sm' ? ' v4p-status-pill--sm' : ''}`}
      aria-label={`Status: ${meta.label}`}
    >
      {showIcon && (
        <span aria-hidden="true" className="v4p-icon v4p-icon--sm material-symbols-rounded">{meta.icon}</span>
      )}
      {meta.label}
    </span>
  );
}

export default memo(BoardStatusBadge);
