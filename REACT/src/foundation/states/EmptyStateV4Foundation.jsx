import React from 'react';

export default function EmptyStateV4Foundation({
  icon = null,
  title = 'Sem dados',
  description = '',
  action = null,
}) {
  return (
    <div className="fdn-empty-state">
      {icon && <div className="fdn-empty-state__icon">{icon}</div>}
      <h3 className="fdn-empty-state__title">{title}</h3>
      {description && <p className="fdn-empty-state__desc">{description}</p>}
      {action && <div className="fdn-empty-state__action">{action}</div>}
    </div>
  );
}
