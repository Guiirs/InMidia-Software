import { ProjectionService } from '@modules/projections';
import { geoIntelligenceService } from '../services/geo-intelligence.service';
import type { ProjectionSnapshot } from '@modules/projections';

const NOW = new Date('2026-05-18T12:00:00.000Z');

function buildProjectionSnapshot(): ProjectionSnapshot {
  const projection = new ProjectionService();
  const result = projection.buildProjectionSnapshot({
    inventorySources: [
      {
        placa: {
          _id: 'placa-1',
          empresaId: 'empresa-1',
          regiaoId: 'regiao-a',
          numero_placa: 'A-001',
          numeroOperacional: 1,
          coordenadas: '-23.55052,-46.633308',
          disponivel: true,
        },
      },
      {
        placa: {
          _id: 'placa-2',
          empresaId: 'empresa-1',
          regiaoId: 'regiao-a',
          numero_placa: 'A-002',
          numeroOperacional: 2,
          coordenadas: '-23.56052,-46.643308',
          disponivel: true,
        },
        alugueis: [{
          id: 'aluguel-1',
          status: 'ativo',
          startDate: '2026-05-01T00:00:00.000Z',
          endDate: '2026-05-30T00:00:00.000Z',
        }],
      },
      {
        placa: {
          _id: 'placa-3',
          empresaId: 'empresa-1',
          regiaoId: 'regiao-b',
          numero_placa: 'B-001',
          numeroOperacional: null,
          coordenadas: null,
          disponivel: true,
        },
      },
      {
        placa: {
          _id: 'placa-4',
          empresaId: 'empresa-1',
          regiaoId: 'regiao-c',
          numero_placa: 'C-001',
          numeroOperacional: 4,
          coordenadas: '-23.57052,-46.653308',
          disponivel: true,
        },
        contratos: [{ id: 'contrato-1', status: 'ativo' }],
      },
    ],
  }, {
    tenantId: 'empresa-1',
    now: NOW,
    source: 'test',
  });

  if (!result.projection) {
    throw new Error('Projection snapshot was not built');
  }

  return result.projection;
}

describe('GeoIntelligenceService', () => {
  it('analyzes coverage with valid data', () => {
    const coverage = geoIntelligenceService.analyzeCoverage({
      snapshot: buildProjectionSnapshot(),
      knownRegionIds: ['regiao-a', 'regiao-b', 'regiao-c'],
      now: NOW,
    });

    expect(coverage.validCoordinateCount).toBe(3);
    expect(coverage.coveredRegionIds).toEqual(['regiao-a', 'regiao-c']);
    expect(coverage.coveragePercent).toBe(75);
  });

  it('analyzes coverage with incomplete data', () => {
    const coverage = geoIntelligenceService.analyzeCoverage({
      snapshot: buildProjectionSnapshot(),
      knownRegionIds: ['regiao-a', 'regiao-b', 'regiao-c', 'regiao-d'],
      now: NOW,
    });

    expect(coverage.status).toBe('partial');
    expect(coverage.uncoveredRegionIds).toEqual(['regiao-b', 'regiao-d']);
    expect(coverage.missingCoordinateCount).toBeGreaterThan(0);
  });

  it('calculates density by region', () => {
    const density = geoIntelligenceService.analyzeDensity({
      snapshot: buildProjectionSnapshot(),
      now: NOW,
    });

    expect(density.regions[0]).toEqual(expect.objectContaining({ regionId: 'regiao-a', count: 2 }));
    expect(density.highConcentrationRegionIds).toContain('regiao-a');
  });

  it('uses relative density when area is unavailable', () => {
    const density = geoIntelligenceService.analyzeDensity({
      snapshot: buildProjectionSnapshot(),
      now: NOW,
    });

    expect(density.mode).toBe('relative');
    expect(density.status).toBe('partial');
  });

  it('uses area density when area is available', () => {
    const density = geoIntelligenceService.analyzeDensity({
      snapshot: buildProjectionSnapshot(),
      regionAreasKm2: { 'regiao-a': 2, 'regiao-b': 1, 'regiao-c': 1 },
      now: NOW,
    });

    expect(density.mode).toBe('area');
    expect(density.regions.find((region) => region.regionId === 'regiao-a')?.densityPerKm2).toBe(1);
  });

  it('analyzes occupancy by region', () => {
    const occupancy = geoIntelligenceService.analyzeOccupancy({
      snapshot: buildProjectionSnapshot(),
      now: NOW,
    });

    expect(occupancy.find((region) => region.regionId === 'regiao-a')?.occupied).toBe(1);
  });

  it('analyzes availability by region', () => {
    const availability = geoIntelligenceService.analyzeAvailability({
      snapshot: buildProjectionSnapshot(),
      now: NOW,
    });

    expect(availability.find((region) => region.regionId === 'regiao-a')?.available).toBe(1);
  });

  it('detects commercial opportunity', () => {
    const opportunities = geoIntelligenceService.detectGeoOpportunities({
      snapshot: buildProjectionSnapshot(),
      now: NOW,
    });

    expect(opportunities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'sales' }),
      ]),
    );
  });

  it('detects expansion opportunity', () => {
    const opportunities = geoIntelligenceService.detectGeoOpportunities({
      snapshot: buildProjectionSnapshot(),
      knownRegionIds: ['regiao-a', 'regiao-b', 'regiao-c', 'regiao-d'],
      now: NOW,
    });

    expect(opportunities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'expansion' }),
      ]),
    );
  });

  it('detects data risk', () => {
    const risks = geoIntelligenceService.detectGeoRisks({
      snapshot: buildProjectionSnapshot(),
      now: NOW,
    });

    expect(risks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'missing-coordinates' }),
      ]),
    );
  });

  it('detects operational risk', () => {
    const risks = geoIntelligenceService.detectGeoRisks({
      snapshot: buildProjectionSnapshot(),
      now: NOW,
    });

    expect(risks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'operational-conflicts' }),
      ]),
    );
  });

  it('builds complete geo intelligence snapshot', () => {
    const result = geoIntelligenceService.buildGeoIntelligenceSnapshot({
      snapshot: buildProjectionSnapshot(),
      knownRegionIds: ['regiao-a', 'regiao-b', 'regiao-c'],
      now: NOW,
    });

    expect(result.ok).toBe(true);
    expect(result.snapshot?.coverage).toBeDefined();
    expect(result.snapshot?.density).toBeDefined();
    expect(result.snapshot?.regionScores.length).toBeGreaterThan(0);
  });

  it('is compatible with Projection Layer snapshot', () => {
    const projection = buildProjectionSnapshot();
    const result = geoIntelligenceService.buildGeoIntelligenceSnapshot({
      snapshot: projection,
      now: NOW,
    });

    expect(result.snapshot?.sourceProjectionId).toBe(projection.metadata.projectionId);
  });

  it('is compatible with Inventory Engine states and Spatial Core points', () => {
    const snapshot = buildProjectionSnapshot();
    const result = geoIntelligenceService.buildGeoIntelligenceSnapshot({
      snapshot,
      now: NOW,
    });

    expect(result.snapshot?.occupancy.some((region) => region.occupied > 0)).toBe(true);
    expect(result.snapshot?.coverage.validCoordinateCount).toBe(snapshot.spatial.points.length);
  });
});
