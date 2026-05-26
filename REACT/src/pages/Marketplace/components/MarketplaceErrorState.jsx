import React from 'react';

export default function MarketplaceErrorState({ error }) {
  const message = error?.message ?? 'Nao foi possivel carregar o marketplace.';

  return (
    <div className="marketplace-error-state" data-testid="marketplace-error-state" role="alert">
      <h2>Erro no Marketplace</h2>
      <p>{message}</p>
    </div>
  );
}
