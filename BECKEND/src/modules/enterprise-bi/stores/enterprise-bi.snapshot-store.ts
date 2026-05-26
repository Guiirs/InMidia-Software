import type { EnterpriseBISnapshot, EnterpriseBIGrain } from '../contracts/enterprise-bi.contracts';

export interface EnterpriseBISnapshotStore {
  save(snapshot: EnterpriseBISnapshot, tenantId?: string): EnterpriseBISnapshot;
  getLatest(criteria?: { tenantId?: string; grain?: EnterpriseBIGrain }): EnterpriseBISnapshot | undefined;
  getHistory(criteria?: { tenantId?: string; grain?: EnterpriseBIGrain }): EnterpriseBISnapshot[];
  findByGrain(grain: EnterpriseBIGrain, tenantId?: string): EnterpriseBISnapshot[];
}

export class InMemoryEnterpriseBISnapshotStore implements EnterpriseBISnapshotStore {
  private readonly snapshots = new Map<string, EnterpriseBISnapshot[]>();

  save(snapshot: EnterpriseBISnapshot, tenantId = snapshot.tenantId ?? 'global'): EnterpriseBISnapshot {
    const history = this.snapshots.get(tenantId) ?? [];
    this.snapshots.set(tenantId, [...history, snapshot].slice(-12));
    return snapshot;
  }

  getLatest(criteria: { tenantId?: string; grain?: EnterpriseBIGrain } = {}): EnterpriseBISnapshot | undefined {
    const history = this.getHistory(criteria);
    return history[0];
  }

  getHistory(criteria: { tenantId?: string; grain?: EnterpriseBIGrain } = {}): EnterpriseBISnapshot[] {
    const tenants = criteria.tenantId ? [criteria.tenantId] : Array.from(this.snapshots.keys());
    const history = tenants.flatMap((tenantId) => this.snapshots.get(tenantId) ?? []);
    const filtered = criteria.grain ? history.filter((snapshot) => snapshot.grain === criteria.grain) : history;
    return [...filtered].reverse();
  }

  findByGrain(grain: EnterpriseBIGrain, tenantId?: string): EnterpriseBISnapshot[] {
    return this.getHistory({ tenantId, grain });
  }
}

export const localEnterpriseBISnapshotStore = new InMemoryEnterpriseBISnapshotStore();
