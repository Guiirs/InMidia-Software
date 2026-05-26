import React from 'react';

export default function MarketplaceEmptyState() {
  return (
    <div className="marketplace-empty-state" data-testid="marketplace-empty-state">
      <h2>Nenhuma capability disponivel</h2>
      <p>O catalogo ainda nao possui modules ou capabilities visiveis para este tenant.</p>
    </div>
  );
}
