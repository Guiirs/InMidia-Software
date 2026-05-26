import React from 'react';

const STATUS_LABELS = {
  available: 'Disponivel',
  disabled: 'Desativada',
  beta: 'Beta',
  internal: 'Interna',
  deprecated: 'Legado',
  planned: 'Planejada',
};

export default function CapabilityStatusBadge({ status, active }) {
  const label = STATUS_LABELS[status] ?? status;
  const className = ['marketplace-status-badge', `marketplace-status-badge--${status}`, active ? 'is-active' : 'is-inactive']
    .filter(Boolean)
    .join(' ');

  return (
    <span className={className} data-testid="capability-status-badge" role="status">
      {active ? 'Ativa' : label}
    </span>
  );
}
