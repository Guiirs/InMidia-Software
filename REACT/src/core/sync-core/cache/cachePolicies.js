export const DEFAULT_TTL_MS = 60_000;
export const DEFAULT_STALE_WHILE_REVALIDATE_MS = 5 * 60_000;

export const fallbackPolicies = {
  keepLastGood: 'keep-last-good',
  none: 'none',
  devMockOnly: 'dev-mock-only',
};

export function isCacheFresh(entry, resource) {
  if (!entry?.lastFetchedAt) return false;
  return Date.now() - entry.lastFetchedAt < (resource.ttlMs ?? DEFAULT_TTL_MS);
}

export function isWithinStaleWhileRevalidate(entry, resource) {
  if (!entry?.lastSuccessAt) return false;
  const windowMs = resource.staleWhileRevalidate ?? DEFAULT_STALE_WHILE_REVALIDATE_MS;
  return Date.now() - entry.lastSuccessAt < windowMs;
}
