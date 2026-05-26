import React from 'react';
import CapabilityStatusBadge from './CapabilityStatusBadge';
import CapabilityDependencyList from './CapabilityDependencyList';

function formatCategory(category) {
  return String(category ?? '').replace(/-/g, ' ');
}

export default function CapabilityCard({ capability, onActivate, onDeactivate, isPending = false }) {
  const canActivate = capability.canActivate && !capability.active;
  const canDeactivate = capability.active;

  return (
    <article className="marketplace-capability-card" data-testid={`capability-card-${capability.id}`}>
      <header className="marketplace-capability-card__header">
        <div>
          <h3 className="marketplace-capability-card__title">{capability.name}</h3>
          <p className="marketplace-capability-card__category">{formatCategory(capability.category)}</p>
        </div>
        <CapabilityStatusBadge status={capability.status} active={capability.active} />
      </header>

      <p className="marketplace-capability-card__description">{capability.description}</p>

      <div className="marketplace-capability-card__meta">
        <div>
          <strong>Requisitos</strong>
          <ul>
            {capability.requirements?.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
        <div>
          <strong>Escopos</strong>
          <ul>
            {capability.scopes?.map((scope) => <li key={scope}>{scope}</li>)}
          </ul>
        </div>
      </div>

      <section className="marketplace-capability-card__dependencies">
        <h4>Dependencias</h4>
        <CapabilityDependencyList dependencies={capability.dependencies} missingDependencies={capability.missingDependencies ?? []} />
      </section>

      {capability.warnings?.length > 0 && (
        <p className="marketplace-capability-card__warning" data-testid={`capability-warning-${capability.id}`}>
          {capability.warnings.join(', ')}
        </p>
      )}

      {capability.blockers?.length > 0 && (
        <p className="marketplace-capability-card__blocker" data-testid={`capability-blockers-${capability.id}`}>
          {capability.blockers.join(', ')}
        </p>
      )}

      <footer className="marketplace-capability-card__actions">
        <button
          type="button"
          data-testid={`activate-capability-${capability.id}`}
          disabled={!canActivate || isPending}
          onClick={() => onActivate?.(capability.id)}
        >
          Ativar
        </button>
        <button
          type="button"
          data-testid={`deactivate-capability-${capability.id}`}
          disabled={!canDeactivate || isPending}
          onClick={() => onDeactivate?.(capability.id)}
        >
          Desativar
        </button>
      </footer>
    </article>
  );
}
