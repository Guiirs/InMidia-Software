import type { GeoCoverageSummary, GeoIntelligenceContext } from '../contracts/geo-intelligence.contracts';

function toRate(value: number): number {
  return Number(value.toFixed(2));
}

export class CoverageAnalyzer {
  analyzeCoverage(context: GeoIntelligenceContext): GeoCoverageSummary {
    const { snapshot } = context;
    const totalItems = snapshot.inventory.items.length;
    const validCoordinateCount = snapshot.spatial.points.length;
    const invalidIds = new Set(snapshot.spatial.invalidPointIds);
    snapshot.inventory.items.forEach((item) => {
      if (!item.coordinates) invalidIds.add(item.placaId);
    });

    const coveredRegionIds = Array.from(new Set(
      snapshot.spatial.points
        .map((point) => point.regiaoId)
        .filter((regionId): regionId is string => !!regionId),
    )).sort();

    const knownRegionIds = context.knownRegionIds ?? Array.from(new Set(
      snapshot.inventory.items
        .map((item) => item.regiaoId)
        .filter((regionId): regionId is string => !!regionId),
    ));

    const uncoveredRegionIds = knownRegionIds
      .filter((regionId) => !coveredRegionIds.includes(regionId))
      .sort();

    const pointsOutsideRegionCount = snapshot.spatial.points.filter((point) => !point.regiaoId).length;
    const territorialCoveragePercent = knownRegionIds.length > 0
      ? toRate((coveredRegionIds.length / knownRegionIds.length) * 100)
      : null;

    return {
      totalItems,
      validCoordinateCount,
      missingCoordinateCount: invalidIds.size,
      coveredRegionIds,
      uncoveredRegionIds,
      coveragePercent: totalItems > 0 ? toRate((validCoordinateCount / totalItems) * 100) : 0,
      territorialCoveragePercent,
      pointsOutsideRegionCount,
      status: totalItems === 0 || knownRegionIds.length === 0 ? 'unknown' : invalidIds.size > 0 ? 'partial' : 'complete',
    };
  }
}
