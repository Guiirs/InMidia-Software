import { retryDelay, shouldRetry } from './retryPolicy.js';

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function executeRequest(fetcher, { retryPolicy, metrics } = {}) {
  const startedAt = performance.now();
  let attempt = 0;

  while (true) {
    try {
      metrics?.increment?.('requestsTotal');
      const result = await fetcher();
      metrics?.recordDuration?.(performance.now() - startedAt);
      return result;
    } catch (error) {
      if (!shouldRetry(error, attempt, retryPolicy)) {
        metrics?.recordDuration?.(performance.now() - startedAt);
        throw error;
      }
      await wait(retryDelay(attempt, retryPolicy));
      attempt += 1;
    }
  }
}
