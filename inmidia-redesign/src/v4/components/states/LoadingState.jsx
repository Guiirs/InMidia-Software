// v4 States - LoadingState
import React from 'react';
import './LoadingState.css';

export function LoadingState({ message = 'Carregando...', className = '', ...props }) {
  return (
    <div className={`v4-loading-state ${className}`.trim()} {...props}>
      <span className="v4-loading-state__spinner" />
      <span className="v4-loading-state__msg">{message}</span>
    </div>
  );
}
