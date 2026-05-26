import React from 'react';

export default function LoadingStateV4Foundation({ message = 'Carregando...' }) {
  return (
    <div className="fdn-loading-state" role="status" aria-live="polite">
      <span className="fdn-loading-state__spinner" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
