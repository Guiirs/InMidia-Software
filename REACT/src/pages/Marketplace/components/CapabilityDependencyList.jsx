import React from 'react';

export default function CapabilityDependencyList({ dependencies = [], missingDependencies = [] }) {
  if (!dependencies.length) {
    return (
      <p className="marketplace-dependency-list marketplace-dependency-list--empty" data-testid="capability-dependency-list">
        Sem dependencias.
      </p>
    );
  }

  return (
    <ul className="marketplace-dependency-list" data-testid="capability-dependency-list">
      {dependencies.map((dependency) => {
        const dependencyId = typeof dependency === 'string' ? dependency : dependency.capabilityId;
        const isMissing = missingDependencies.includes(dependencyId);
        return (
          <li key={dependencyId} className={isMissing ? 'is-missing' : 'is-satisfied'}>
            {dependencyId}
          </li>
        );
      })}
    </ul>
  );
}
