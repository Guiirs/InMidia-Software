import type { AnalyticsSnapshot } from '../contracts/operational-analytics.contracts';

export class OperationalAnalyticsSnapshotStore {
  private readonly snapshots = new Map<string, AnalyticsSnapshot[]>();

  save(snapshot: AnalyticsSnapshot, tenantId = 'global'): AnalyticsSnapshot {
    const existing = this.snapshots.get(tenantId) ?? [];
    this.snapshots.set(tenantId, [...existing, snapshot].slice(-24));
    return snapshot;
  }

  getLatest(tenantId = 'global'): AnalyticsSnapshot | undefined {
    const history = this.snapshots.get(tenantId) ?? [];
    return history[history.length - 1];
  }

  getHistory(tenantId = 'global'): AnalyticsSnapshot[] {
    return [...(this.snapshots.get(tenantId) ?? [])];
  }
}

export const localOperationalAnalyticsSnapshotStore = new OperationalAnalyticsSnapshotStore();