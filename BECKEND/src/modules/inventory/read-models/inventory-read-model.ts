import type { CommercialAvailabilityResult } from '@modules/commercial-availability';
import type { InventoryBoardStatus } from '../services/inventory-projection.service';

export interface InventorySnapshot {
  statusByPlateId: Map<string, CommercialAvailabilityResult>;
  boardStatusByPlateId: Map<string, InventoryBoardStatus>;
  plateCount: number;
  builtAt: number;
  source: 'read_model';
}

export class InventoryReadModel {
  private readonly snapshots = new Map<string, InventorySnapshot>();

  put(
    empresaId: string,
    statusByPlateId: Map<string, CommercialAvailabilityResult>,
    boardStatusByPlateId: Map<string, InventoryBoardStatus>,
  ): void {
    this.snapshots.set(empresaId, {
      statusByPlateId,
      boardStatusByPlateId,
      plateCount: statusByPlateId.size,
      builtAt: Date.now(),
      source: 'read_model',
    });
  }

  get(empresaId: string): InventorySnapshot | undefined {
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

export const inventoryReadModel = new InventoryReadModel();
