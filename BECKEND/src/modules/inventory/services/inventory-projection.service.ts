import { commercialAvailabilityProjection, type CommercialAvailabilityResult } from '@modules/commercial-availability';
import { recordProjectionMetric } from '@shared/infra/monitoring/projection-metrics';
import { inventoryReadModel } from '../read-models/inventory-read-model';
import { CACHE_TTL_MS } from '@shared/infra/cache';

export type InventoryBoardStatus = 'occupied' | 'available' | 'reserved' | 'maintenance' | 'critical';

export interface InventoryCommercialProjection {
  statusByPlateId: Map<string, CommercialAvailabilityResult>;
  boardStatusByPlateId: Map<string, InventoryBoardStatus>;
  cacheHit: boolean;
  source: 'read_model' | 'projection';
}

export function boardStatusFromCommercialProjection(status: CommercialAvailabilityResult): InventoryBoardStatus {
  if (status.status === 'CONTRACTED_ACTIVE') return 'occupied';
  if (status.status === 'RESERVED' || status.status === 'FUTURE_RESERVED') return 'reserved';
  if (status.status === 'MAINTENANCE') return 'maintenance';
  return status.isCommerciallyAvailable ? 'available' : 'critical';
}

export class InventoryProjectionService {
  async resolveCommercialProjection(params: {
    empresaId: string;
    placaIds: string[];
    at?: Date;
    skipCache?: boolean;
  }): Promise<InventoryCommercialProjection> {
    // Serve from read model if fresh and covering the requested plates
    if (!params.skipCache && !params.at && !inventoryReadModel.isStale(params.empresaId, CACHE_TTL_MS.INVENTORY_SUMMARY)) {
      const snapshot = inventoryReadModel.get(params.empresaId);
      if (snapshot) {
        const allCovered = params.placaIds.every((id) => snapshot.statusByPlateId.has(id));
        if (allCovered) {
          recordProjectionMetric({
            projection: 'inventory',
            durationMs: 0,
            plateCount: snapshot.plateCount,
            cacheHit: true,
          });
          return {
            statusByPlateId: snapshot.statusByPlateId,
            boardStatusByPlateId: snapshot.boardStatusByPlateId,
            cacheHit: true,
            source: 'read_model',
          };
        }
      }
    }

    const startedAt = Date.now();
    const statusByPlateId = await commercialAvailabilityProjection.resolveManyPlateCommercialStatuses({
      ...params,
      skipCache: params.skipCache,
    });
    const boardStatusByPlateId = new Map<string, InventoryBoardStatus>();
    statusByPlateId.forEach((status, placaId) => {
      boardStatusByPlateId.set(placaId, boardStatusFromCommercialProjection(status));
    });

    const fallbackCount = Array.from(statusByPlateId.values()).filter((status) => status.source === 'fallback_legacy').length;
    recordProjectionMetric({
      projection: 'inventory',
      durationMs: Date.now() - startedAt,
      plateCount: statusByPlateId.size,
      fallbackCount,
      cacheHit: false,
      rebuild: true,
    });

    // Store in read model (for "now" queries covering all plates)
    if (!params.at && !params.skipCache) {
      inventoryReadModel.put(params.empresaId, statusByPlateId, boardStatusByPlateId);
    }

    return { statusByPlateId, boardStatusByPlateId, cacheHit: false, source: 'projection' };
  }
}
