import type { DiagnosticBufferEntry } from './sync.types';

type BufferName = 'replayFailures' | 'reconnectEvents' | 'snapshotRecoveries' | 'degradedTransitions';

const TTL_MS = Math.max(Number(process.env.SYNC_DIAGNOSTICS_TTL_MS ?? 60 * 60_000), 60_000);
const TTL_SECONDS = Math.ceil(TTL_MS / 1000);
const MAX_ITEMS = 100;
const REDIS_KEY_PREFIX = process.env.SYNC_DIAGNOSTICS_REDIS_KEY_PREFIX ?? 'sync:diagnostics';

const buffers: Record<BufferName, DiagnosticBufferEntry[]> = {
  replayFailures: [],
  reconnectEvents: [],
  snapshotRecoveries: [],
  degradedTransitions: [],
};

export interface DiagnosticsPersistenceProvider {
  append(name: BufferName, entry: DiagnosticBufferEntry): Promise<void>;
  getBuffer(name: BufferName): Promise<DiagnosticBufferEntry[]>;
  clear(): Promise<void>;
}

function prune(name: BufferName): void {
  const cutoff = Date.now() - TTL_MS;
  const list = buffers[name];
  while (list.length > 0 && new Date(list[0]!.at).getTime() < cutoff) list.shift();
  if (list.length > MAX_ITEMS) list.splice(0, list.length - MAX_ITEMS);
}

function pruneList(list: DiagnosticBufferEntry[]): DiagnosticBufferEntry[] {
  const cutoff = Date.now() - TTL_MS;
  return list
    .filter(entry => new Date(entry.at).getTime() >= cutoff)
    .slice(-MAX_ITEMS);
}

export const memoryDiagnosticsProvider: DiagnosticsPersistenceProvider = {
  async append() {},
  async getBuffer() { return []; },
  async clear() {},
};

export const redisDiagnosticsProvider: DiagnosticsPersistenceProvider = {
  async append(name, entry) {
    if (process.env.SYNC_DIAGNOSTICS_REDIS_ENABLED !== 'true') return;
    try {
      const { default: cacheService } = await import('@shared/container/cache.service');
      if (!cacheService.isAvailable()) return;
      const key = `${REDIS_KEY_PREFIX}:${name}`;
      const current = await cacheService.get(key);
      const list = Array.isArray(current) ? current as DiagnosticBufferEntry[] : [];
      await cacheService.set(key, pruneList([...list, entry]), TTL_SECONDS);
    } catch {
      // Diagnostics persistence must never affect the sync hot path.
    }
  },
  async getBuffer(name) {
    if (process.env.SYNC_DIAGNOSTICS_REDIS_ENABLED !== 'true') return [];
    try {
      const { default: cacheService } = await import('@shared/container/cache.service');
      if (!cacheService.isAvailable()) return [];
      const current = await cacheService.get(`${REDIS_KEY_PREFIX}:${name}`);
      return Array.isArray(current) ? pruneList(current as DiagnosticBufferEntry[]) : [];
    } catch {
      return [];
    }
  },
  async clear() {
    if (process.env.SYNC_DIAGNOSTICS_REDIS_ENABLED !== 'true') return;
    try {
      const { default: cacheService } = await import('@shared/container/cache.service');
      if (!cacheService.isAvailable()) return;
      await cacheService.del((Object.keys(buffers) as BufferName[]).map(name => `${REDIS_KEY_PREFIX}:${name}`));
    } catch {}
  },
};

let persistenceProvider: DiagnosticsPersistenceProvider = redisDiagnosticsProvider;

export function setDiagnosticsPersistenceProviderForTests(provider: DiagnosticsPersistenceProvider): void {
  persistenceProvider = provider;
}

export function resetDiagnosticsPersistenceProviderForTests(): void {
  persistenceProvider = redisDiagnosticsProvider;
}

export function recordDiagnostic(name: BufferName, entry: Omit<DiagnosticBufferEntry, 'at'> & { at?: string }): void {
  const fullEntry: DiagnosticBufferEntry = {
    ...entry,
    source: entry.source ?? name,
    severity: entry.severity ?? inferSeverity(name, entry.type),
    at: entry.at ?? new Date().toISOString(),
  };
  buffers[name].push(fullEntry);
  prune(name);
  void persistenceProvider.append(name, fullEntry);
}

function inferSeverity(name: BufferName, type: string): DiagnosticBufferEntry['severity'] {
  if (name === 'replayFailures' || type === 'DEGRADED_ON') return 'critical';
  if (name === 'snapshotRecoveries' || name === 'reconnectEvents') return 'warning';
  return 'info';
}

export function getDiagnosticBuffer(name: BufferName): DiagnosticBufferEntry[] {
  prune(name);
  return [...buffers[name]];
}

async function getMergedDiagnosticBuffer(name: BufferName): Promise<DiagnosticBufferEntry[]> {
  prune(name);
  const persisted = await persistenceProvider.getBuffer(name);
  const byKey = new Map<string, DiagnosticBufferEntry>();
  for (const entry of [...persisted, ...buffers[name]]) {
    const key = `${entry.at}|${entry.type}|${entry.reason ?? ''}|${entry.correlationId ?? ''}|${entry.empresaId ?? ''}`;
    byKey.set(key, entry);
  }
  return pruneList(Array.from(byKey.values()).sort((a, b) => a.at.localeCompare(b.at)));
}

export async function getDiagnosticBuffers(): Promise<Record<BufferName, DiagnosticBufferEntry[]>> {
  return {
    replayFailures: await getMergedDiagnosticBuffer('replayFailures'),
    reconnectEvents: await getMergedDiagnosticBuffer('reconnectEvents'),
    snapshotRecoveries: await getMergedDiagnosticBuffer('snapshotRecoveries'),
    degradedTransitions: await getMergedDiagnosticBuffer('degradedTransitions'),
  };
}

export function clearDiagnosticBuffers(): void {
  (Object.keys(buffers) as BufferName[]).forEach(name => {
    buffers[name].length = 0;
  });
  void persistenceProvider.clear();
}
