import type { DataQualityContext } from '../contracts/data-quality.contracts';

export class GeoQualityScorer {
  score(context: DataQualityContext): number {
    const spatial = context.snapshot?.spatial;
    if (!spatial) return 100;

    const total = spatial.points.length + spatial.invalidPointIds.length;
    if (total === 0) return 100;

    const validRatio = spatial.points.length / total;
    const coveragePenalty = context.geoSnapshot?.coverage.status === 'unknown' ? 20 : 0;
    return Math.max(0, Math.round(validRatio * 100 - coveragePenalty));
  }
}
