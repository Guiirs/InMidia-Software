export type HttpLogLevel = 'error' | 'warn' | 'debug';
export type HttpLogLabel = 'ERR' | 'WARN' | 'SLOW' | 'OK';

export interface HttpLogClassification {
  level: HttpLogLevel;
  label: HttpLogLabel;
  shouldLogInProduction: boolean;
}

const DEFAULT_HTTP_SLOW_MS = 1000;

export function resolveHttpSlowMs(value = process.env.HTTP_SLOW_MS): number {
  if (!value) return DEFAULT_HTTP_SLOW_MS;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_HTTP_SLOW_MS;

  return Math.floor(parsed);
}

export function classifyHttpResponse(
  status: number,
  durationMs: number,
  slowThresholdMs = resolveHttpSlowMs()
): HttpLogClassification {
  if (status >= 500) {
    return { level: 'error', label: 'ERR', shouldLogInProduction: true };
  }

  if (status >= 400) {
    return { level: 'warn', label: 'WARN', shouldLogInProduction: true };
  }

  if (durationMs > slowThresholdMs) {
    return { level: 'warn', label: 'SLOW', shouldLogInProduction: true };
  }

  return { level: 'debug', label: 'OK', shouldLogInProduction: false };
}

export function formatHttpAccessLog(params: {
  label: HttpLogLabel;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  requestId: string;
  ip?: string;
}): string {
  const ipSuffix = params.ip ? ` ip=${params.ip}` : '';
  return `[HTTP] ${params.label} ${params.method} ${params.path} ${params.status} ${params.durationMs}ms rid=${params.requestId}${ipSuffix}`;
}
