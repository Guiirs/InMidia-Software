import { useCallback, useMemo, useState } from 'react';
import { getSyncMutationDefinition } from '../syncRegistry.js';
import { useSyncCore } from '../SyncCoreProvider.jsx';

export function useSyncMutation(config) {
  const { mutationManager } = useSyncCore();
  const mutationConfig = useMemo(() => (
    typeof config === 'string' ? getSyncMutationDefinition(config) : config
  ), [config]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [lastResult, setLastResult] = useState(null);

  const mutateAsync = useCallback(async (variables) => {
    setStatus('loading');
    setError(null);
    try {
      const result = await mutationManager.run(mutationConfig, variables);
      setLastResult(result);
      setStatus('success');
      return result;
    } catch (err) {
      setStatus('error');
      setError(err);
      throw err;
    }
  }, [mutationConfig, mutationManager]);

  return useMemo(() => ({
    mutateAsync,
    mutate: (variables) => { void mutateAsync(variables); },
    status,
    error,
    data: lastResult,
    isLoading: status === 'loading',
  }), [error, lastResult, mutateAsync, status]);
}
