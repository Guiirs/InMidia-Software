export function createConflictResolver(metrics) {
  return {
    resolve(config, hasConflict) {
      const policy = config.conflictPolicy ?? 'server-wins';
      if (!hasConflict) return { allowed: true, policy };

      if (policy === 'reject') {
        metrics?.increment?.('mutationConflicts');
        return { allowed: false, policy, error: new Error(`Mutation conflict: ${config.key}`) };
      }

      metrics?.increment?.('mutationConflicts');
      return { allowed: true, policy };
    },
  };
}
