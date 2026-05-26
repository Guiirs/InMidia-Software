// v4 States - ErrorState
import React from 'react';
import './ErrorState.css';

export function ErrorState({ title = 'Erro', description, action, className = '', ...props }) {
  return (
    <div className={`v4-error-state ${className}`.trim()} {...props}>
      <div className="v4-error-state__icon">&#9888;</div>
      <div className="v4-error-state__title">{title}</div>
      {description && <div className="v4-error-state__desc">{description}</div>}
      {action && <div className="v4-error-state__action">{action}</div>}
    </div>
  );
}
