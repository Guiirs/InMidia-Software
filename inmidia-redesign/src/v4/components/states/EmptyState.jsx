// v4 States - EmptyState
import React from 'react';
import './EmptyState.css';

export function EmptyState({ icon, title = 'Nenhum dado', description, action, className = '', ...props }) {
  return (
    <div className={`v4-empty-state ${className}`.trim()} {...props}>
      {icon && <div className="v4-empty-state__icon">{icon}</div>}
      <div className="v4-empty-state__title">{title}</div>
      {description && <div className="v4-empty-state__desc">{description}</div>}
      {action && <div className="v4-empty-state__action">{action}</div>}
    </div>
  );
}
