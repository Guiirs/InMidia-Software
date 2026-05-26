import type {
  GeoCoverageSummary,
  GeoDensityResult,
  GeoIntelligenceSnapshot,
  GeoOpportunity,
  GeoRiskSignal,
} from '../contracts/geo-intelligence.contracts';

describe('Geo Intelligence contracts', () => {
  it('represents coverage and density contracts', () => {
    const coverage: GeoCoverageSummary = {
      totalItems: 10,
      validCoordinateCount: 8,
      missingCoordinateCount: 2,
      coveredRegionIds: ['regiao-a'],
      uncoveredRegionIds: ['regiao-b'],
      coveragePercent: 80,
      territorialCoveragePercent: 50,
      pointsOutsideRegionCount: 0,
      status: 'partial',
    };
    const density: GeoDensityResult = {
      mode: 'relative',
      regions: [{ regionId: 'regiao-a', count: 8, relativeDensity: 0.8 }],
      highConcentrationRegionIds: ['regiao-a'],
      lowConcentrationRegionIds: [],
      concentrationIndex: 0.8,
      status: 'partial',
    };

    expect(coverage.status).toBe('partial');
    expect(density.mode).toBe('relative');
  });

  it('represents opportunity and risk signals', () => {
    const opportunity: GeoOpportunity = {
      id: 'sales-regiao-a',
      type: 'sales',
      regionId: 'regiao-a',
      title: 'Regiao com disponibilidade',
      reason: 'Ha placas disponiveis',
      score: 80,
    };
    const risk: GeoRiskSignal = {
      id: 'risk-regiao-a',
      type: 'low-data-quality',
      severity: 'medium',
      regionId: 'regiao-a',
      message: 'Dados incompletos',
    };

    expect(opportunity.type).toBe('sales');
    expect(risk.severity).toBe('medium');
  });

  it('represents geo intelligence snapshot', () => {
    const snapshot: GeoIntelligenceSnapshot = {
      coverage: {
        totalItems: 0,
        validCoordinateCount: 0,
        missingCoordinateCount: 0,
        coveredRegionIds: [],
        uncoveredRegionIds: [],
        coveragePercent: 0,
        territorialCoveragePercent: null,
        pointsOutsideRegionCount: 0,
        status: 'unknown',
      },
      density: {
        mode: 'relative',
        regions: [],
        highConcentrationRegionIds: [],
        lowConcentrationRegionIds: [],
        concentrationIndex: 0,
        status: 'unknown',
      },
      occupancy: [],
      availability: [],
      regionScores: [],
      opportunities: [],
      risks: [],
      generatedAt: '2026-05-18T12:00:00.000Z',
      sourceProjectionId: 'projection-1',
      sourceProjectionVersion: 1,
    };

    expect(snapshot.sourceProjectionVersion).toBe(1);
  });
});
