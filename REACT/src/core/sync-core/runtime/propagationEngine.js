import { getDependencies, getDependents, hasDependencyCycle } from './dependencyGraph.js';
import { normalizeDomainEvent } from './domainEvents.js';

const MAX_PROPAGATION_DEPTH = 4;
const DEFAULT_STORM_THRESHOLD = 50;

export function createPropagationEngine({ registry, graph, eventMap, metrics, devtools }) {
  function resourcesForEvent(eventType) {
    const mapped = eventMap?.[eventType] ?? [];
    if (mapped.length) return mapped;

    return Object.values(registry)
      .filter((resource) => resource.realtimeEvents?.includes(eventType) || resource.domainEvents?.includes(eventType))
      .map((resource) => resource.key);
  }

  function planFromResources(resourceKeys, options = {}) {
    const includeDependencies = options.includeDependencies ?? false;
    const includeDependents = options.includeDependents ?? true;
    const planned = new Map();

    resourceKeys.forEach((resourceKey) => {
      planned.set(resourceKey, { reason: options.reason ?? 'direct', depth: 0 });

      if (includeDependencies) {
        getDependencies(resourceKey, graph, { maxDepth: MAX_PROPAGATION_DEPTH }).forEach((key) => {
          if (!planned.has(key)) planned.set(key, { reason: `dependency:${resourceKey}`, depth: 1 });
        });
      }

      if (includeDependents) {
        getDependents(resourceKey, graph, { maxDepth: MAX_PROPAGATION_DEPTH }).forEach((key) => {
          if (!planned.has(key)) planned.set(key, { reason: `dependent:${resourceKey}`, depth: 1 });
        });
      }
    });

    const plan = Array.from(planned.entries()).map(([key, meta]) => ({ key, ...meta }));
    if (plan.length >= DEFAULT_STORM_THRESHOLD) {
      devtools?.telemetry?.warn?.({
        type: 'propagation-storm',
        event: 'propagation.storm',
        metadata: { roots: resourceKeys, size: plan.length, includeDependencies, includeDependents },
      });
    }
    resourceKeys.forEach((resourceKey) => {
      if (hasDependencyCycle(resourceKey, graph)) {
        devtools?.telemetry?.warn?.({
          type: 'dependency-cycle',
          resourceKey,
          event: 'propagation.dependency-cycle',
          metadata: { resourceKey },
        });
      }
    });
    devtools?.record?.({
      type: 'propagation',
      event: 'propagation.plan',
      metadata: {
        roots: resourceKeys,
        includeDependencies,
        includeDependents,
        plan,
      },
    });
    return plan;
  }

  return {
    planFromResources,

    planFromEvent(rawEvent, options = {}) {
      const event = normalizeDomainEvent(rawEvent);
      if (!event.type) return [];
      const roots = resourcesForEvent(event.type);
      if (!roots.length) return [];
      metrics?.increment?.('propagationsPlanned');
      const plan = planFromResources(roots, { ...options, reason: `event:${event.type}` });
      if (plan.length >= DEFAULT_STORM_THRESHOLD) {
        metrics?.setGauge?.('schedulerQueueSize', plan.length);
      }
      devtools?.record?.({
        type: 'propagation',
        event: 'propagation.event-plan',
        metadata: { event, roots, plan },
      });
      return plan;
    },
  };
}
