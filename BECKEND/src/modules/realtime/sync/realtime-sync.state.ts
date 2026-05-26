import type { RealtimeStreamName, RealtimeSyncState } from '../contracts/realtime.contracts';

export class RealtimeSyncStateStore {
  private lastSyncAt?: string;
  private snapshotVersion = 0;
  private eventCount = 0;
  private lastLatencyMs = 0;

  update(input: {
    snapshotVersion?: number;
    eventCount?: number;
    latencyMs?: number;
    syncedAt?: string;
  }): void {
    this.lastSyncAt = input.syncedAt ?? new Date().toISOString();
    this.snapshotVersion = input.snapshotVersion ?? this.snapshotVersion;
    this.eventCount = input.eventCount ?? this.eventCount;
    this.lastLatencyMs = input.latencyMs ?? this.lastLatencyMs;
  }

  get(activeSubscribers: number, activeStreams: RealtimeStreamName[], hasFailures: boolean): RealtimeSyncState {
    return {
      lastSyncAt: this.lastSyncAt,
      snapshotVersion: this.snapshotVersion,
      eventCount: this.eventCount,
      localLatencyMs: this.lastLatencyMs,
      activeSubscribers,
      activeStreams,
      streamIntegrity: hasFailures ? 'degraded' : 'healthy',
    };
  }

  clear(): void {
    this.lastSyncAt = undefined;
    this.snapshotVersion = 0;
    this.eventCount = 0;
    this.lastLatencyMs = 0;
  }
}

export const realtimeSyncStateStore = new RealtimeSyncStateStore();
