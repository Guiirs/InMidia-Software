import type { ProjectionSnapshot } from '../contracts/projection.contracts';

interface StoredProjection {
  version: number;
  snapshot: ProjectionSnapshot;
  updatedAt: string;
}

export class LocalProjectionStore {
  private readonly snapshots = new Map<string, StoredProjection>();

  getVersion(tenantId = 'global'): number {
    return this.snapshots.get(tenantId)?.version ?? 0;
  }

  save(snapshot: ProjectionSnapshot, tenantId = 'global'): ProjectionSnapshot {
    const version = this.getVersion(tenantId) + 1;
    const updated: ProjectionSnapshot = {
      ...snapshot,
      metadata: {
        ...snapshot.metadata,
        version,
      },
    };

    this.snapshots.set(tenantId, {
      version,
      snapshot: updated,
      updatedAt: new Date().toISOString(),
    });

    return updated;
  }

  get(tenantId = 'global'): ProjectionSnapshot | null {
    return this.snapshots.get(tenantId)?.snapshot ?? null;
  }

  clear(tenantId?: string): void {
    if (tenantId) {
      this.snapshots.delete(tenantId);
      return;
    }

    this.snapshots.clear();
  }
}

export const localProjectionStore = new LocalProjectionStore();
