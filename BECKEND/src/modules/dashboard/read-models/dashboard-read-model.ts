import type { DashboardProjectionOverview, DashboardProjectionRegion } from '../dashboard-projection.service';

export interface DashboardSnapshot {
  overview: DashboardProjectionOverview;
  regions: DashboardProjectionRegion[];
  builtAt: number;
  source: 'read_model';
}

export class DashboardReadModel {
  private readonly snapshots = new Map<string, DashboardSnapshot>();

  put(empresaId: string, overview: DashboardProjectionOverview, regions: DashboardProjectionRegion[]): void {
    this.snapshots.set(empresaId, {
      overview,
      regions,
      builtAt: Date.now(),
      source: 'read_model',
    });
  }

  get(empresaId: string): DashboardSnapshot | undefined {
    return this.snapshots.get(empresaId);
  }

  isStale(empresaId: string, maxAgeMs: number): boolean {
    const snapshot = this.snapshots.get(empresaId);
    if (!snapshot) return true;
    return Date.now() - snapshot.builtAt >= maxAgeMs;
  }

  invalidate(empresaId: string): void {
    this.snapshots.delete(empresaId);
  }

  invalidateAll(): void {
    this.snapshots.clear();
  }

  size(): number {
    return this.snapshots.size;
  }

  listTenants(): string[] {
    return Array.from(this.snapshots.keys());
  }
}

export const dashboardReadModel = new DashboardReadModel();
