export interface RegionSummary {
  regiaoId: string;
  nome: string;
  totalPlacas: number;
  placasOcupadas: number;
  placasDisponiveis: number;
  taxaOcupacao: number;
  builtAt: number;
}

export interface RegionSnapshot {
  regions: Map<string, RegionSummary>;
  builtAt: number;
  source: 'read_model';
}

export class RegionReadModel {
  private readonly snapshots = new Map<string, RegionSnapshot>();

  put(empresaId: string, regions: RegionSummary[]): void {
    const regionMap = new Map<string, RegionSummary>();
    for (const region of regions) {
      regionMap.set(region.regiaoId, region);
    }
    this.snapshots.set(empresaId, {
      regions: regionMap,
      builtAt: Date.now(),
      source: 'read_model',
    });
  }

  get(empresaId: string): RegionSnapshot | undefined {
    return this.snapshots.get(empresaId);
  }

  getRegion(empresaId: string, regiaoId: string): RegionSummary | undefined {
    return this.snapshots.get(empresaId)?.regions.get(regiaoId);
  }

  list(empresaId: string): RegionSummary[] {
    const snapshot = this.snapshots.get(empresaId);
    if (!snapshot) return [];
    return Array.from(snapshot.regions.values());
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
}

export const regionReadModel = new RegionReadModel();
