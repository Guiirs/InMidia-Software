import React from 'react';

export default function ErrorStateV4Foundation({
  icon = null,
  title = 'Falha ao carregar',
  description = '',
  action = null,
}) {
  return (
    <div className="fdn-error-state" role="alert">
      {icon && <div className="fdn-error-state__icon">{icon}</div>}
      <h3 className="fdn-error-state__title">{title}</h3>
      {description && <p className="fdn-error-state__desc">{description}</p>}
      {action && <div className="fdn-error-state__action">{action}</div>}
    </div>
  );
}
