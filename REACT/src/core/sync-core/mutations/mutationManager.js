import { createMutationRuntime } from '../runtime/mutationRuntime.js';

export function createMutationManager({ store, invalidateResource, metrics, devtools, hasAuth = () => true }) {
  const runtime = createMutationRuntime({ store, invalidateResource, metrics, devtools, hasAuth });

  return {
    run(config, variables) {
      return runtime.execute(config, variables);
    },
    getPendingMutations: runtime.getPendingMutations,
    getMutationHistory: runtime.getMutationHistory,
    clear: runtime.clear,
    runtime,
  };
}
