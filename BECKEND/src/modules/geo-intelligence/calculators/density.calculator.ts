import type {
  GeoDensityRegion,
  GeoDensityResult,
  GeoIntelligenceContext,
} from '../contracts/geo-intelligence.contracts';

function toRate(value: number): number {
  return Number(value.toFixed(2));
}

export class DensityCalculator {
  analyzeDensity(context: GeoIntelligenceContext): GeoDensityResult {
    const { snapshot } = context;
    const counts = new Map<string, number>();

    snapshot.inventory.items.forEach((item) => {
      const regionId = item.regiaoId ?? 'unknown-region';
      counts.set(regionId, (counts.get(regionId) ?? 0) + 1);
    });

    const total = Math.max(1, snapshot.inventory.items.length);
    const hasArea = !!context.regionAreasKm2 && Object.keys(context.regionAreasKm2).length > 0;

    const regions: GeoDensityRegion[] = Array.from(counts.entries())
      .map(([regionId, count]) => {
        const area = context.regionAreasKm2?.[regionId];
        return {
          regionId,
          count,
          relativeDensity: toRate(count / total),
          densityPerKm2: area && area > 0 ? toRate(count / area) : undefined,
        };
      })
      .sort((a, b) => b.count - a.count);

    const average = regions.length > 0
      ? regions.reduce((sum, region) => sum + region.count, 0) / regions.length
      : 0;

    const highConcentrationRegionIds = regions
      .filter((region) => average > 0 && region.count >= average * 1.25)
      .map((region) => region.regionId);

    const lowConcentrationRegionIds = regions
      .filter((region) => average > 0 && region.count <= average * 0.75)
      .map((region) => region.regionId);

    const max = regions[0]?.count ?? 0;

    return {
      mode: hasArea ? 'area' : 'relative',
      regions,
      highConcentrationRegionIds,
      lowConcentrationRegionIds,
      concentrationIndex: snapshot.inventory.items.length > 0 ? toRate(max / total) : 0,
      status: regions.length === 0 ? 'unknown' : hasArea ? 'complete' : 'partial',
    };
  }
}
