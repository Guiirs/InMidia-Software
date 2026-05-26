export function createRefreshScheduler(queue, devtools) {
  return {
    invalidate(resourceKey, options) {
      devtools?.record?.({
        type: 'invalidation',
        resourceKey,
        event: 'scheduler.invalidate',
        metadata: options ?? {},
      });
      queue.enqueue(resourceKey, options);
    },
    invalidateMany(resourceKeys, options) {
      devtools?.record?.({
        type: 'invalidation',
        event: 'scheduler.invalidate-many',
        metadata: { resourceKeys, options },
      });
      resourceKeys.forEach((resourceKey) => queue.enqueue(resourceKey, options));
    },
    invalidatePlan(plan, options = {}) {
      const dedupedPlan = Array.from(new Map(plan.map((item) => [item.key, item])).values());
      devtools?.record?.({
        type: 'invalidation',
        event: 'scheduler.invalidate-plan',
        metadata: { plan: dedupedPlan, options, originalSize: plan.length },
      });
      dedupedPlan.forEach((item) => {
        queue.enqueue(item.key, {
          ...options,
          reason: item.reason ?? options.reason,
          depth: item.depth,
        });
      });
    },
    cancel(resourceKey) {
      queue.cancel(resourceKey);
    },
    clear() {
      queue.clear();
    },
  };
}
