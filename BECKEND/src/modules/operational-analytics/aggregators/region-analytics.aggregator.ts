import type { InventoryItem } from '@modules/inventory';
import type {
  AnalyticsAggregations,
  AnalyticsRegionSummary,
  OperationalAnalyticsContext,
} from '../contracts/operational-analytics.contracts';

function toRate(part: number, total: number): number {
  return total > 0 ? Number(((part / total) * 100).toFixed(2)) : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export interface RegionAggregationResult {
  regions: AnalyticsRegionSummary[];
  aggregations: AnalyticsAggregations;
}

export class RegionAnalyticsAggregator {
  aggregate(context: OperationalAnalyticsContext): RegionAggregationResult {
    const items = context.projectionSnapshot.inventory.items;
    const tenantId = context.projectionSnapshot.metadata.tenantId;
    const coverage = context.geoSnapshot?.coverage;
    const occupancyMap = new Map((context.geoSnapshot?.occupancy ?? []).map((entry) => [entry.regionId, entry]));
    const densityMap = new Map((context.geoSnapshot?.density.regions ?? []).map((entry) => [entry.regionId, entry]));
    const regionScoreMap = new Map((context.geoSnapshot?.regionScores ?? []).map((entry) => [entry.regionId, entry]));
    const defaultGovernanceScore = this.calculateGovernanceScore(context);
    const groups = new Map<string, InventoryItem[]>();
    const regionIds = new Set<string>();

    items.forEach((item) => {
      const regionId = item.regiaoId ?? 'unknown-region';
      regionIds.add(regionId);
      groups.set(regionId, [...(groups.get(regionId) ?? []), item]);
    });

    (context.knownRegionIds ?? []).forEach((regionId) => regionIds.add(regionId));
    coverage?.coveredRegionIds.forEach((regionId) => regionIds.add(regionId));
    coverage?.uncoveredRegionIds.forEach((regionId) => regionIds.add(regionId));

    const byEmpresa: Record<string, number> = {};
    items.forEach((item) => {
      const empresaId = item.empresaId ?? 'unknown-empresa';
      byEmpresa[empresaId] = (byEmpresa[empresaId] ?? 0) + 1;
    });

    const regions = Array.from(regionIds).map((regionId) => {
      const regionItems = groups.get(regionId) ?? [];
      const totalPlacas = regionItems.length;
      const placasAtivas = regionItems.filter((item) => item.status.physical === 'active').length;
      const occupied = regionItems.filter((item) => item.availability.status === 'occupied').length;
      const available = regionItems.filter((item) => item.availability.status === 'available').length;
      const reserved = regionItems.filter((item) => item.availability.status === 'reserved').length;
      const unavailable = regionItems.filter((item) => item.availability.status === 'unavailable').length;
      const unknown = regionItems.filter((item) => item.availability.status === 'unknown').length;
      const conflicts = regionItems.reduce((sum, item) => sum + item.conflicts.length, 0);
      const incomplete = regionItems.filter((item) => item.status.operational === 'incomplete').length;
      const occupancy = occupancyMap.get(regionId);
      const density = densityMap.get(regionId);
      const regionScore = regionScoreMap.get(regionId);
      const occupancyRate = occupancy?.occupancyRate ?? toRate(occupied, totalPlacas);
      const availabilityRate = occupancy?.availabilityRate ?? toRate(available, totalPlacas);

      return {
        regionId,
        empresaId: regionItems[0]?.empresaId,
        tenantId,
        totalPlacas,
        placasAtivas,
        occupied,
        available,
        reserved,
        unavailable,
        unknown,
        conflicts,
        incomplete,
        occupancyRate,
        availabilityRate,
        qualityScore: Number((regionScore?.score ?? context.qualitySnapshot?.score.geo ?? 100).toFixed(2)),
        governanceScore: defaultGovernanceScore,
        density: Number((density?.densityPerKm2 ?? density?.relativeDensity ?? totalPlacas).toFixed(2)),
        saturated: occupancy?.saturated ?? (totalPlacas > 0 && occupied / totalPlacas >= 0.8),
        underutilized: occupancy?.underutilized ?? (totalPlacas > 0 && occupied / totalPlacas <= 0.2 && available > 0),
        coverageStatus: coverage?.coveredRegionIds.includes(regionId)
          ? 'covered'
          : coverage?.uncoveredRegionIds.includes(regionId)
            ? 'uncovered'
            : 'unknown',
      } satisfies AnalyticsRegionSummary;
    }).sort((left, right) => right.totalPlacas - left.totalPlacas || left.regionId.localeCompare(right.regionId));

    const healthyRegions = regions.filter((region) => region.qualityScore >= 80).length;
    const degradedRegions = regions.filter((region) => region.qualityScore < 80).length;

    return {
      regions,
      aggregations: {
        byRegion: Object.fromEntries(regions.map((region) => [region.regionId, region])),
        byEmpresa,
        byTenant: tenantId ? { [tenantId]: items.length } : { global: items.length },
        byAvailability: {
          available: context.projectionSnapshot.inventory.summary.available,
          reserved: context.projectionSnapshot.inventory.summary.reserved,
          occupied: context.projectionSnapshot.inventory.summary.occupied,
          unavailable: context.projectionSnapshot.inventory.summary.unavailable,
          unknown: context.projectionSnapshot.inventory.summary.unknown,
        },
        byOccupancy: {
          occupied: context.projectionSnapshot.inventory.summary.occupied,
          unoccupied: Math.max(0, context.projectionSnapshot.inventory.summary.total - context.projectionSnapshot.inventory.summary.occupied),
          reserved: context.projectionSnapshot.inventory.summary.reserved,
          conflicts: context.projectionSnapshot.inventory.summary.conflicts,
        },
        byQuality: {
          healthy: healthyRegions,
          degraded: degradedRegions,
          averageScore: Number((regions.reduce((sum, region) => sum + region.qualityScore, 0) / Math.max(regions.length, 1)).toFixed(2)),
        },
        byConflicts: {
          total: context.projectionSnapshot.inventory.summary.conflicts,
          regionsWithConflicts: regions.filter((region) => region.conflicts > 0).length,
        },
        byGovernance: {
          allow: context.governanceSnapshot?.summary.decision === 'allow' ? 1 : 0,
          warn: context.governanceSnapshot?.summary.decision === 'warn' ? 1 : 0,
          review: context.governanceSnapshot?.summary.decision === 'review' ? 1 : 0,
          deny: context.governanceSnapshot?.summary.decision === 'deny' ? 1 : 0,
          unknown: context.governanceSnapshot ? 0 : 1,
          averageScore: defaultGovernanceScore,
        },
      },
    };
  }

  private calculateGovernanceScore(context: OperationalAnalyticsContext): number {
    const governance = context.governanceSnapshot;
    if (!governance) return 100;

    const severityPenalty = governance.summary.bySeverity.low * 2
      + governance.summary.bySeverity.medium * 5
      + governance.summary.bySeverity.high * 15
      + governance.summary.bySeverity.critical * 30;
    const decisionPenalty = governance.summary.decision === 'deny'
      ? 50
      : governance.summary.decision === 'review'
        ? 25
        : governance.summary.decision === 'warn'
          ? 10
          : 0;

    return clamp(Math.round(100 - severityPenalty - decisionPenalty), 0, 100);
  }
}