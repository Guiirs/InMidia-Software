import type {
  GeoCoverageSummary,
  GeoOccupancyInsight,
  GeoRegionScore,
} from '../contracts/geo-intelligence.contracts';

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

export class RegionScoreCalculator {
  calculateRegionScore(input: {
    coverage: GeoCoverageSummary;
    occupancy: GeoOccupancyInsight[];
  }): GeoRegionScore[] {
    return input.occupancy.map((region) => {
      const coverageScore = input.coverage.coveredRegionIds.includes(region.regionId) ? 100 : 30;
      const availabilityScore = clamp(region.availabilityRate);
      const occupancyScore = clamp(100 - Math.abs(50 - region.occupancyRate));
      const qualityScore = clamp(100 - (region.incomplete * 20) - (region.conflicts * 15));
      const score = clamp((coverageScore * 0.25) + (availabilityScore * 0.25) + (occupancyScore * 0.25) + (qualityScore * 0.25));

      return {
        regionId: region.regionId,
        score,
        coverageScore,
        availabilityScore,
        occupancyScore,
        qualityScore,
        status: region.total === 0 ? 'unknown' : region.incomplete > 0 || region.conflicts > 0 ? 'partial' : 'complete',
      };
    });
  }
}
