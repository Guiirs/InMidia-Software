import type {
  GeoCoverageSummary,
  GeoDensityResult,
  GeoOccupancyInsight,
  GeoRiskSeverity,
  GeoRiskSignal,
} from '../contracts/geo-intelligence.contracts';

function severityFromRate(rate: number): GeoRiskSeverity {
  if (rate >= 50) return 'critical';
  if (rate >= 30) return 'high';
  if (rate >= 10) return 'medium';
  return 'low';
}

export class RiskDetector {
  detectGeoRisks(input: {
    coverage: GeoCoverageSummary;
    density: GeoDensityResult;
    occupancy: GeoOccupancyInsight[];
  }): GeoRiskSignal[] {
    const risks: GeoRiskSignal[] = [];
    const missingRate = input.coverage.totalItems > 0
      ? (input.coverage.missingCoordinateCount / input.coverage.totalItems) * 100
      : 0;

    if (input.coverage.missingCoordinateCount > 0) {
      risks.push({
        id: 'missing-coordinates',
        type: 'missing-coordinates',
        severity: severityFromRate(missingRate),
        message: 'Existem placas sem coordenada valida.',
        meta: {
          missingCoordinateCount: input.coverage.missingCoordinateCount,
          missingRate: Number(missingRate.toFixed(2)),
        },
      });
    }

    if (input.density.concentrationIndex >= 0.6 && input.density.regions.length > 1) {
      risks.push({
        id: 'excessive-concentration',
        type: 'excessive-concentration',
        severity: input.density.concentrationIndex >= 0.8 ? 'high' : 'medium',
        regionId: input.density.regions[0]?.regionId,
        message: 'Concentracao territorial elevada em poucas regioes.',
        meta: { concentrationIndex: input.density.concentrationIndex },
      });
    }

    input.occupancy.forEach((region) => {
      if (region.available === 0 && region.total > 0) {
        risks.push({
          id: `no-availability-${region.regionId}`,
          type: 'no-availability',
          severity: region.occupancyRate >= 80 ? 'high' : 'medium',
          regionId: region.regionId,
          message: 'Regiao sem disponibilidade comercial projetada.',
        });
      }

      if (region.conflicts > 0) {
        risks.push({
          id: `conflicts-${region.regionId}`,
          type: 'operational-conflicts',
          severity: region.conflicts >= 3 ? 'high' : 'medium',
          regionId: region.regionId,
          message: 'Conflitos operacionais detectados na regiao.',
          meta: { conflicts: region.conflicts },
        });
      }

      if (region.incomplete > 0) {
        risks.push({
          id: `data-quality-${region.regionId}`,
          type: 'low-data-quality',
          severity: region.incomplete >= 3 ? 'high' : 'medium',
          regionId: region.regionId,
          message: 'Baixa qualidade de dados em placas da regiao.',
          meta: { incomplete: region.incomplete },
        });
      }
    });

    return risks.sort((a, b) => {
      const weight: Record<GeoRiskSeverity, number> = { critical: 4, high: 3, medium: 2, low: 1 };
      return weight[b.severity] - weight[a.severity];
    });
  }
}
