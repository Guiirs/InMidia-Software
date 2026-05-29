/**
 * Scalability simulation — architectural validation only.
 * Tests that projections, cache, and read models function correctly
 * under simulated load of 1k / 5k / 10k plates without actual DB calls.
 */
import { ProjectionCacheService, hashPlateIds, CACHE_TTL_MS } from '../../shared/infra/cache/projection-cache.service';
import { DashboardReadModel } from '../../modules/dashboard/read-models/dashboard-read-model';
import { InventoryReadModel } from '../../modules/inventory/read-models/inventory-read-model';
import { RegionReadModel } from '../../modules/regions/read-models/region-read-model';
import { boardStatusFromCommercialProjection } from '../../modules/inventory/services/inventory-projection.service';
import { resetProjectionMetrics, recordProjectionMetric, getProjectionMetricsSnapshot } from '../../shared/infra/monitoring/projection-metrics';
import type { CommercialAvailabilityResult } from '../../modules/commercial-availability/commercial-availability.projection';

// ── Helpers ───────────────────────────────────────────────────────────────

function generatePlateIds(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `plate_${String(i).padStart(8, '0')}`);
}

function generateCommercialStatuses(plateIds: string[]): Map<string, CommercialAvailabilityResult> {
  const map = new Map<string, CommercialAvailabilityResult>();
  plateIds.forEach((id, i) => {
    const mod = i % 4;
    map.set(id, mod === 0
      ? { status: 'AVAILABLE', source: 'temporal', isCommerciallyAvailable: true, isPhysicallyBlocked: false }
      : mod === 1
        ? { status: 'CONTRACTED_ACTIVE', source: 'temporal', isCommerciallyAvailable: false, isPhysicallyBlocked: false }
        : mod === 2
          ? { status: 'RESERVED', source: 'temporal', isCommerciallyAvailable: false, isPhysicallyBlocked: false }
          : { status: 'MAINTENANCE', source: 'physical_block', isCommerciallyAvailable: false, isPhysicallyBlocked: true });
  });
  return map;
}

function buildBoardStatuses(statusByPlateId: Map<string, CommercialAvailabilityResult>) {
  const boardStatusByPlateId = new Map<string, ReturnType<typeof boardStatusFromCommercialProjection>>();
  statusByPlateId.forEach((status, id) => {
    boardStatusByPlateId.set(id, boardStatusFromCommercialProjection(status));
  });
  return boardStatusByPlateId;
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe.each([
  ['1k', 1_000],
  ['5k', 5_000],
  ['10k', 10_000],
])('Scalability simulation — %s plates', (label, plateCount) => {
  const empresaId = `tenant-${label}`;
  let plateIds: string[];
  let statuses: Map<string, CommercialAvailabilityResult>;

  beforeAll(() => {
    plateIds = generatePlateIds(plateCount);
    statuses = generateCommercialStatuses(plateIds);
  });

  beforeEach(() => {
    resetProjectionMetrics();
  });

  describe('ProjectionCacheService', () => {
    let cache: ProjectionCacheService;

    beforeEach(() => {
      cache = new ProjectionCacheService();
    });

    it('stores and retrieves serialized status map', () => {
      const serialized = Array.from(statuses.entries());
      cache.set(`${empresaId}:commercial:hash`, serialized, CACHE_TTL_MS.AVAILABILITY_BATCH);

      const retrieved = cache.get<typeof serialized>(`${empresaId}:commercial:hash`);
      expect(retrieved).not.toBeUndefined();
      expect(retrieved!.length).toBe(plateCount);
    });

    it('hashPlateIds is stable for large sets', () => {
      const h1 = hashPlateIds(plateIds);
      const h2 = hashPlateIds([...plateIds].reverse());
      expect(h1).toBe(h2);
    });

    it('cache invalidation by tenant clears all entries', () => {
      cache.set(`${empresaId}:commercial:h1`, 'data', CACHE_TTL_MS.AVAILABILITY_BATCH);
      cache.set(`${empresaId}:dashboard:h2`, 'data2', CACHE_TTL_MS.DASHBOARD);
      cache.set(`other-tenant:commercial:h3`, 'data3', CACHE_TTL_MS.AVAILABILITY_BATCH);

      cache.invalidateTenant(empresaId);

      expect(cache.get(`${empresaId}:commercial:h1`)).toBeUndefined();
      expect(cache.get(`${empresaId}:dashboard:h2`)).toBeUndefined();
      expect(cache.get(`other-tenant:commercial:h3`)).toBe('data3');
    });
  });

  describe('InventoryReadModel', () => {
    let model: InventoryReadModel;

    beforeEach(() => {
      model = new InventoryReadModel();
    });

    it('stores and retrieves all plate statuses', () => {
      const boardStatuses = buildBoardStatuses(statuses);
      model.put(empresaId, statuses, boardStatuses);

      const snapshot = model.get(empresaId);
      expect(snapshot!.plateCount).toBe(plateCount);
      expect(snapshot!.statusByPlateId.size).toBe(plateCount);
    });

    it('read model is not stale immediately after put', () => {
      const boardStatuses = buildBoardStatuses(statuses);
      model.put(empresaId, statuses, boardStatuses);
      expect(model.isStale(empresaId, CACHE_TTL_MS.INVENTORY_SUMMARY)).toBe(false);
    });

    it('all plates covered check passes', () => {
      const boardStatuses = buildBoardStatuses(statuses);
      model.put(empresaId, statuses, boardStatuses);

      const snapshot = model.get(empresaId)!;
      const allCovered = plateIds.every((id) => snapshot.statusByPlateId.has(id));
      expect(allCovered).toBe(true);
    });

    it('boardStatusFromCommercialProjection handles all status types', () => {
      const statusMap: Record<string, CommercialAvailabilityResult['status']> = {
        occupied: 'CONTRACTED_ACTIVE',
        reserved: 'RESERVED',
        maintenance: 'MAINTENANCE',
        available: 'AVAILABLE',
      };

      for (const [expected, commercialStatus] of Object.entries(statusMap)) {
        const result = boardStatusFromCommercialProjection({
          status: commercialStatus as CommercialAvailabilityResult['status'],
          source: 'temporal',
          isCommerciallyAvailable: commercialStatus === 'AVAILABLE',
          isPhysicallyBlocked: false,
        });
        expect(result).toBe(expected);
      }
    });
  });

  describe('DashboardReadModel', () => {
    let model: DashboardReadModel;

    beforeEach(() => {
      model = new DashboardReadModel();
    });

    it('stores overview computed from status distribution', () => {
      // Compute counts from generated statuses
      let available = 0, occupied = 0, reserved = 0, maintenance = 0;
      statuses.forEach((s) => {
        if (s.isCommerciallyAvailable) available++;
        else if (s.status === 'CONTRACTED_ACTIVE') occupied++;
        else if (s.status === 'RESERVED') reserved++;
        else if (s.status === 'MAINTENANCE') maintenance++;
      });

      const overview = {
        totalPlacas: plateCount,
        placasDisponiveis: available,
        placasOcupadas: occupied,
        placasReservadas: reserved,
        placasManutencao: maintenance,
        propostasEmAberto: 0,
        contratosAtivos: occupied,
        regioesAtivas: 5,
        receitaEstimadaMensal: occupied * 1000,
      };

      model.put(empresaId, overview, []);
      const snapshot = model.get(empresaId)!;

      expect(snapshot.overview.totalPlacas).toBe(plateCount);
      expect(snapshot.overview.placasDisponiveis + snapshot.overview.placasOcupadas +
        snapshot.overview.placasReservadas + snapshot.overview.placasManutencao).toBe(plateCount);
    });

    it('stale check returns false for fresh read model', () => {
      model.put(empresaId, {
        totalPlacas: plateCount,
        placasDisponiveis: 0, placasOcupadas: 0, placasReservadas: 0, placasManutencao: 0,
        propostasEmAberto: 0, contratosAtivos: 0, regioesAtivas: 0, receitaEstimadaMensal: 0,
      }, []);
      expect(model.isStale(empresaId, CACHE_TTL_MS.DASHBOARD)).toBe(false);
    });
  });

  describe('RegionReadModel', () => {
    let model: RegionReadModel;

    beforeEach(() => {
      model = new RegionReadModel();
    });

    it('stores and retrieves region summaries', () => {
      const regions = Array.from({ length: 10 }, (_, i) => ({
        regiaoId: `region-${i}`,
        nome: `Região ${i}`,
        totalPlacas: Math.floor(plateCount / 10),
        placasOcupadas: Math.floor(plateCount / 20),
        placasDisponiveis: Math.floor(plateCount / 20),
        taxaOcupacao: 50,
        builtAt: Date.now(),
      }));

      model.put(empresaId, regions);
      expect(model.list(empresaId)).toHaveLength(10);
      expect(model.getRegion(empresaId, 'region-0')).toBeDefined();
    });
  });

  describe('Projection metrics accumulation', () => {
    it('records cache hit rate across many calls', () => {
      const hits = Math.floor(plateCount * 0.85);
      const misses = plateCount - hits;

      for (let i = 0; i < hits; i++) {
        recordProjectionMetric({ projection: 'commercial', durationMs: 2, plateCount: 1, cacheHit: true });
      }
      for (let i = 0; i < misses; i++) {
        recordProjectionMetric({ projection: 'commercial', durationMs: 40, plateCount: 1, cacheHit: false, rebuild: true });
      }

      const snapshots = getProjectionMetricsSnapshot();
      const commercial = snapshots.find((s) => s.projection === 'commercial')!;

      expect(commercial.cacheHits).toBe(hits);
      expect(commercial.cacheMisses).toBe(misses);
      expect(commercial.cacheHitRate).toBeCloseTo(0.85, 1);
      expect(commercial.rebuildCount).toBe(misses);
    });
  });
});
