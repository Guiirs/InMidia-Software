export const defaultRetryPolicy = {
  retries: 0,
  baseDelayMs: 300,
};

export function shouldRetry(error, attempt, policy = defaultRetryPolicy) {
  const status = error?.response?.status || error?.statusCode;
  if (status === 401 || status === 403) return false;
  return attempt < (policy.retries ?? 0);
}

export function retryDelay(attempt, policy = defaultRetryPolicy) {
  return (policy.baseDelayMs ?? 300) * (2 ** attempt);
}
