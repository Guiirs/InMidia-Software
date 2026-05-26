import type { AnalyticsSnapshot } from '@modules/operational-analytics';

describe('OperationalAnalyticsContract', () => {
  it('exposes canonical analytics snapshot fields', () => {
    const snapshot: AnalyticsSnapshot = {
      id: 'analytics-1',
      tenantId: 'empresa-1',
      generatedAt: '2026-05-18T12:00:00.000Z',
      sourceProjectionId: 'projection-1',
      sourceProjectionVersion: 1,
      context: { generatedBy: 'test', knownRegions: 1 },
      kpis: [],
      metrics: [],
      trends: [],
      signals: [],
      regions: [],
      occupancy: {
        totalPlacas: 0,
        placasAtivas: 0,
        occupied: 0,
        reserved: 0,
        available: 0,
        unavailable: 0,
        unknown: 0,
        occupancyRate: 0,
        saturatedRegions: [],
        underutilizedRegions: [],
      },
      availability: {
        totalPlacas: 0,
        available: 0,
        unavailable: 0,
        unknown: 0,
        availabilityRate: 0,
        lowAvailabilityRegionIds: [],
        highAvailabilityRegionIds: [],
      },
      quality: {
        globalScore: 100,
        geoScore: 100,
        inventoryScore: 100,
        mediaScore: 100,
        operationalScore: 100,
        averageTerritorialQuality: 100,
        totalIssues: 0,
        degraded: false,
        conflicts: 0,
      },
      governance: {
        averageScore: 100,
        decision: 'allow',
        totalViolations: 0,
        highestSeverity: null,
        requiresReview: false,
        bySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
      },
      summary: {
        totalPlacas: 0,
        placasAtivas: 0,
        occupancyRate: 0,
        availabilityRate: 0,
        coveredRegions: 0,
        saturatedRegions: 0,
        underutilizedRegions: 0,
        averageQuality: 100,
        averageGovernance: 100,
        territorialQuality: 100,
        operationalDensity: 0,
        totalSignals: 0,
      },
      aggregations: {
        byRegion: {},
        byEmpresa: {},
        byTenant: {},
        byAvailability: { available: 0, reserved: 0, occupied: 0, unavailable: 0, unknown: 0 },
        byOccupancy: { occupied: 0, unoccupied: 0, reserved: 0, conflicts: 0 },
        byQuality: { healthy: 0, degraded: 0, averageScore: 100 },
        byConflicts: { total: 0, regionsWithConflicts: 0 },
        byGovernance: { allow: 1, warn: 0, review: 0, deny: 0, unknown: 0, averageScore: 100 },
      },
    };

    expect(snapshot.sourceProjectionVersion).toBe(1);
    expect(snapshot.governance.decision).toBe('allow');
    expect(snapshot.summary.totalSignals).toBe(0);
  });
});