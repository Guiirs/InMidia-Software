import { createConflictResolver } from './conflictResolver.js';
import { createMutationLifecycle, MUTATION_STATUSES } from './mutationLifecycle.js';
import { createMutationQueue } from './mutationQueue.js';
import { createReconcileEngine } from './reconcileEngine.js';
import { createRollbackManager } from './rollbackManager.js';

export function normalizeMutationConfig(config) {
  return {
    domain: 'unknown',
    permissions: [],
    requiresAuth: true,
    requiresTenant: true,
    optimistic: Boolean(config.optimisticUpdates?.length),
    rollbackPolicy: 'snapshot',
    reconcilePolicy: 'server-wins',
    invalidate: [],
    invalidateDependents: true,
    conflictPolicy: 'server-wins',
    ...config,
  };
}

export function createMutationRuntime({ store, invalidateResource, metrics, devtools, hasAuth }) {
  const queue = createMutationQueue(metrics, devtools?.telemetry);
  const lifecycle = createMutationLifecycle();
  const rollbackManager = createRollbackManager({ store, metrics });
  const reconcileEngine = createReconcileEngine({ store, metrics });
  const conflictResolver = createConflictResolver(metrics);
  const resourceMutationVersions = new Map();
  let nextResourceMutationVersion = 1;

  function touchedResources(config) {
    return Array.from(new Set([
      ...(config.optimisticUpdates ?? []).map((item) => item.resourceKey),
      ...(config.reconcile ?? []).map((item) => item.resourceKey),
    ].filter(Boolean)));
  }

  function markTouchedResources(config) {
    const version = nextResourceMutationVersion++;
    const resources = touchedResources(config);
    resources.forEach((resourceKey) => resourceMutationVersions.set(resourceKey, version));
    return {
      resources,
      isCurrent(resourceKey) {
        return !resources.includes(resourceKey) || resourceMutationVersions.get(resourceKey) === version;
      },
    };
  }

  async function execute(rawConfig, variables) {
    const config = normalizeMutationConfig(rawConfig);
    const record = lifecycle.start(config, variables);
    const traceId = devtools?.traces?.startTrace?.({
      type: 'mutation',
      name: config.key,
      domain: config.domain,
      mutationKey: config.key,
      metadata: { optimistic: config.optimistic, invalidate: config.invalidate },
    });
    const endMeasure = devtools?.performance?.measure?.('mutation.execute', { mutationKey: config.key, domain: config.domain });
    devtools?.record?.({
      type: 'mutation',
      domain: config.domain,
      mutationKey: config.key,
      event: 'mutation.queued',
      metadata: { id: record.id },
    });

    if (config.requiresAuth && !hasAuth()) {
      const error = new Error(`Mutation unauthorized: ${config.key}`);
      lifecycle.transition(record.id, MUTATION_STATUSES.blocked, { error });
      metrics.increment('mutationsBlocked');
      devtools?.record?.({
        type: 'auth',
        domain: config.domain,
        mutationKey: config.key,
        event: 'mutation.auth-blocked',
        metadata: { id: record.id },
      });
      devtools?.traces?.endTrace?.(traceId, { status: 'blocked' });
      endMeasure?.();
      throw error;
    }

    const hasConflict = queue.hasConflict(config, variables);
    const conflict = conflictResolver.resolve(config, hasConflict);
    if (!conflict.allowed) {
      lifecycle.transition(record.id, MUTATION_STATUSES.conflicted, { error: conflict.error });
      devtools?.record?.({
        type: 'conflict',
        domain: config.domain,
        mutationKey: config.key,
        event: 'mutation.conflicted',
        metadata: { id: record.id, policy: conflict.policy, message: conflict.error?.message },
      });
      devtools?.traces?.endTrace?.(traceId, { status: 'conflicted' });
      endMeasure?.();
      throw conflict.error;
    }
    if (hasConflict) {
      devtools?.record?.({
        type: 'conflict',
        domain: config.domain,
        mutationKey: config.key,
        event: 'mutation.conflict-resolved',
        metadata: { id: record.id, policy: conflict.policy },
      });
    }

    return queue.enqueue(config, variables, async () => {
      let snapshots = [];
      const resourceGuard = markTouchedResources(config);
      try {
        if (config.optimistic && config.optimisticUpdates?.length) {
          lifecycle.transition(record.id, MUTATION_STATUSES.optimistic);
          snapshots = rollbackManager.capture(config.optimisticUpdates, variables);
          metrics.increment('optimisticUpdatesApplied');
          devtools?.record?.({
            type: 'mutation',
            domain: config.domain,
            mutationKey: config.key,
            event: 'mutation.optimistic-applied',
            metadata: { id: record.id, resources: snapshots.map((snapshot) => snapshot.resourceKey) },
          });
        }

        lifecycle.transition(record.id, MUTATION_STATUSES.running);
        metrics.increment('mutationsStarted');
        metrics.setGauge?.('mutationQueueSize', queue.snapshot().length);
        devtools?.record?.({
          type: 'mutation',
          domain: config.domain,
          mutationKey: config.key,
          event: 'mutation.running',
          metadata: { id: record.id },
        });
        const result = await config.mutationFn(variables);

        reconcileEngine.reconcile(config, result, variables, {
          shouldReconcileResource: (resourceKey) => resourceGuard.isCurrent(resourceKey),
        });

        (config.invalidate ?? []).forEach((resourceKey) => {
          invalidateResource(resourceKey, {
            force: true,
            reason: `mutation:${config.key}`,
            includeDependents: config.invalidateDependents !== false,
          });
        });

        lifecycle.transition(record.id, MUTATION_STATUSES.committed, { result });
        metrics.increment('mutationsCommitted');
        devtools?.record?.({
          type: 'mutation',
          domain: config.domain,
          mutationKey: config.key,
          event: 'mutation.committed',
          metadata: { id: record.id },
        });
        devtools?.traces?.endTrace?.(traceId, { status: 'committed' });
        endMeasure?.();
        return result;
      } catch (error) {
        if ((config.rollbackPolicy ?? 'snapshot') === 'snapshot') {
          rollbackManager.rollbackIfUnchanged(snapshots);
          lifecycle.transition(record.id, MUTATION_STATUSES.rolledBack, { error });
          devtools?.record?.({
            type: 'rollback',
            domain: config.domain,
            mutationKey: config.key,
            event: 'mutation.rolled-back',
            metadata: { id: record.id, resources: snapshots.map((snapshot) => snapshot.resourceKey), message: error?.message },
          });
        } else {
          lifecycle.transition(record.id, MUTATION_STATUSES.failed, { error });
          devtools?.record?.({
            type: 'mutation',
            domain: config.domain,
            mutationKey: config.key,
            event: 'mutation.failed',
            metadata: { id: record.id, message: error?.message },
          });
        }
        metrics.increment('mutationsFailed');
        metrics.setGauge?.('mutationQueueSize', queue.snapshot().length);
        devtools?.traces?.endTrace?.(traceId, { status: 'failed' });
        endMeasure?.();
        throw error;
      }
    });
  }

  return {
    execute,
    queue,
    lifecycle,
    getPendingMutations: () => queue.snapshot(),
    getMutationHistory: () => lifecycle.list(),
    clear: () => queue.clear(),
  };
}
