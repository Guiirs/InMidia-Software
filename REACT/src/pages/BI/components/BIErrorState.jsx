import React from 'react';

export default function BIErrorState({ error }) {
  const message = error?.message ?? 'Erro ao carregar dados BI.';
  return (
    <div className="bi-error-state" data-testid="bi-error-state" role="alert">
      <div className="bi-error-state__icon" aria-hidden="true">⚠️</div>
      <h3 className="bi-error-state__title">Não foi possível carregar os dados</h3>
      <p className="bi-error-state__message">{message}</p>
      <p className="bi-error-state__hint">
        Verifique sua conexão e tente recarregar a página. Se o problema persistir, contate o suporte.
      </p>
    </div>
  );
}
