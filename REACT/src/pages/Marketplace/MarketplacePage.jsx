import React from 'react';
import { useMarketplace } from './hooks/useMarketplace';
import CapabilityCard from './components/CapabilityCard';
import MarketplaceEmptyState from './components/MarketplaceEmptyState';
import MarketplaceErrorState from './components/MarketplaceErrorState';

function ModuleCard({ module }) {
  return (
    <article className="marketplace-module-card" data-testid={`marketplace-module-${module.id}`}>
      <h3>{module.name}</h3>
      <p>{module.description}</p>
      <p>
        Categoria: <strong>{module.category}</strong>
      </p>
      <p>
        Status: <strong>{module.status}</strong>
      </p>
      <p>
        Capabilities ativas: <strong>{module.activeCapabilities}</strong> / {module.availableCapabilities}
      </p>
    </article>
  );
}

export default function MarketplacePage() {
  const {
    isLoading,
    hasError,
    firstError,
    modules,
    capabilities,
    summary,
    activateCapability,
    deactivateCapability,
    isMutating,
  } = useMarketplace();

  if (isLoading) {
    return (
      <div className="marketplace-page marketplace-page--loading" data-testid="marketplace-loading">
        <p>Carregando catalogo de marketplace...</p>
      </div>
    );
  }

  if (hasError) {
    return <MarketplaceErrorState error={firstError} />;
  }

  if (!modules.length && !capabilities.length) {
    return <MarketplaceEmptyState />;
  }

  return (
    <div className="marketplace-page" data-testid="marketplace-page">
      <header className="marketplace-page__header">
        <h1>Marketplace</h1>
        <p>Camada interna de capacidades controladas por tenant, governanca e feature flags.</p>
        {summary && (
          <p data-testid="marketplace-summary">
            {summary.visibleModules} modules, {summary.visibleCapabilities} capabilities visiveis, {summary.activeCapabilities} ativas.
          </p>
        )}
      </header>

      <section className="marketplace-page__section" data-testid="marketplace-modules">
        <h2>Modules</h2>
        <div className="marketplace-module-grid">
          {modules.map((module) => <ModuleCard key={module.id} module={module} />)}
        </div>
      </section>

      <section className="marketplace-page__section" data-testid="marketplace-capabilities">
        <h2>Capabilities</h2>
        <div className="marketplace-capability-grid">
          {capabilities.map((capability) => (
            <CapabilityCard
              key={capability.id}
              capability={capability}
              isPending={isMutating}
              onActivate={(capabilityId) => activateCapability({ capabilityId })}
              onDeactivate={(capabilityId) => deactivateCapability({ capabilityId })}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
