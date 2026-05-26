import type {
  DashboardProjection,
  InventoryProjection,
  SpatialProjection,
} from '../contracts/projection.contracts';

function toRate(value: number): number {
  return Number(value.toFixed(2));
}

export class DashboardProjectionBuilder {
  build(
    inventoryProjection: InventoryProjection,
    spatialProjection: SpatialProjection,
  ): DashboardProjection {
    const { summary } = inventoryProjection;

    return {
      totalPlacas: summary.total,
      available: summary.available,
      reserved: summary.reserved,
      occupied: summary.occupied,
      unavailable: summary.unavailable,
      unknown: summary.unknown,
      conflicts: summary.conflicts,
      incomplete: summary.incomplete,
      validMapPoints: spatialProjection.points.length,
      invalidMapPoints: spatialProjection.invalidPointIds.length,
      occupancyRate: summary.total > 0 ? toRate((summary.occupied / summary.total) * 100) : 0,
    };
  }
}
