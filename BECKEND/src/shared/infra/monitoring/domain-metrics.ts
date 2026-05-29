export type ObservabilityDomain =
  | 'dashboard'
  | 'inventory'
  | 'contracts'
  | 'commercial'
  | 'temporal'
  | 'realtime'
  | 'public_api'
  | 'system'
  | 'other';

export interface DomainMetricSnapshot {
  domain: ObservabilityDomain;
  requests: number;
  avgMs: number;
  maxMs: number;
  errors: number;
  lastSeenAt?: string;
}

interface DomainMetricState {
  requests: number;
  totalMs: number;
  maxMs: number;
  errors: number;
  lastSeenAt?: string;
}

const states = new Map<ObservabilityDomain, DomainMetricState>();

function stateFor(domain: ObservabilityDomain): DomainMetricState {
  const current = states.get(domain);
  if (current) return current;

  const created: DomainMetricState = {
    requests: 0,
    totalMs: 0,
    maxMs: 0,
    errors: 0,
  };
  states.set(domain, created);
  return created;
}

export function resolveDomainFromPath(path: string): ObservabilityDomain {
  if (path.includes('/dashboard')) return 'dashboard';
  if (path.includes('/inventory') || path.includes('/placas')) return 'inventory';
  if (path.includes('/contracts') || path.includes('/contratos')) return 'contracts';
  if (path.includes('/commercial') || path.includes('/propostas')) return 'commercial';
  if (path.includes('/temporal')) return 'temporal';
  if (path.includes('/realtime') || path.includes('/sync') || path.includes('/sse')) return 'realtime';
  if (path.includes('/public')) return 'public_api';
  if (path.includes('/system') || path.includes('/health') || path.includes('/diagnostics')) return 'system';
  return 'other';
}

export function recordDomainRequest(input: {
  domain: ObservabilityDomain;
  durationMs: number;
  statusCode: number;
  at?: Date;
}): void {
  const state = stateFor(input.domain);
  state.requests += 1;
  state.totalMs += Math.max(0, input.durationMs);
  state.maxMs = Math.max(state.maxMs, Math.max(0, input.durationMs));
  if (input.statusCode >= 500) state.errors += 1;
  state.lastSeenAt = (input.at ?? new Date()).toISOString();
}

export function getDomainMetricsSnapshot(): DomainMetricSnapshot[] {
  return Array.from(states.entries())
    .map(([domain, state]) => ({
      domain,
      requests: state.requests,
      avgMs: state.requests > 0 ? Number((state.totalMs / state.requests).toFixed(2)) : 0,
      maxMs: Number(state.maxMs.toFixed(2)),
      errors: state.errors,
      lastSeenAt: state.lastSeenAt,
    }))
    .sort((a, b) => a.domain.localeCompare(b.domain));
}

export function resetDomainMetrics(): void {
  states.clear();
}
