import type {
  GeoAvailabilityInsight,
  GeoIntelligenceContext,
  GeoOccupancyInsight,
} from '../contracts/geo-intelligence.contracts';

function toRate(value: number): number {
  return Number(value.toFixed(2));
}

interface RegionStats {
  total: number;
  occupied: number;
  available: number;
  reserved: number;
  unavailable: number;
  unknown: number;
  conflicts: number;
  incomplete: number;
}

export class OccupancyAnalyzer {
  analyzeOccupancy(context: GeoIntelligenceContext): GeoOccupancyInsight[] {
    const stats = this.buildStats(context);

    return Array.from(stats.entries()).map(([regionId, row]) => ({
      regionId,
      total: row.total,
      occupied: row.occupied,
      available: row.available,
      reserved: row.reserved,
      unavailable: row.unavailable,
      conflicts: row.conflicts,
      incomplete: row.incomplete,
      occupancyRate: row.total > 0 ? toRate((row.occupied / row.total) * 100) : 0,
      availabilityRate: row.total > 0 ? toRate((row.available / row.total) * 100) : 0,
      saturated: row.total > 0 && row.occupied / row.total >= 0.8,
      underutilized: row.total > 0 && row.occupied / row.total <= 0.2 && row.available > 0,
    }));
  }

  analyzeAvailability(context: GeoIntelligenceContext): GeoAvailabilityInsight[] {
    const stats = this.buildStats(context);

    return Array.from(stats.entries()).map(([regionId, row]) => ({
      regionId,
      available: row.available,
      unavailable: row.unavailable,
      unknown: row.unknown,
      availabilityRate: row.total > 0 ? toRate((row.available / row.total) * 100) : 0,
      status: row.total === 0 ? 'unknown' : row.unknown > 0 ? 'partial' : 'complete',
    }));
  }

  private buildStats(context: GeoIntelligenceContext): Map<string, RegionStats> {
    const stats = new Map<string, RegionStats>();

    context.snapshot.inventory.items.forEach((item) => {
      const regionId = item.regiaoId ?? 'unknown-region';
      const row = stats.get(regionId) ?? {
        total: 0,
        occupied: 0,
        available: 0,
        reserved: 0,
        unavailable: 0,
        unknown: 0,
        conflicts: 0,
        incomplete: 0,
      };

      row.total += 1;
      if (item.availability.status === 'occupied') row.occupied += 1;
      if (item.availability.status === 'available') row.available += 1;
      if (item.availability.status === 'reserved') row.reserved += 1;
      if (item.availability.status === 'unavailable') row.unavailable += 1;
      if (item.availability.status === 'unknown') row.unknown += 1;
      row.conflicts += item.conflicts.length;
      if (item.status.operational === 'incomplete') row.incomplete += 1;

      stats.set(regionId, row);
    });

    return stats;
  }
}
