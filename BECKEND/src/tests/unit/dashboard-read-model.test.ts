import { DashboardReadModel } from '../../modules/dashboard/read-models/dashboard-read-model';
import type { DashboardProjectionOverview, DashboardProjectionRegion } from '../../modules/dashboard/dashboard-projection.service';

const makeOverview = (totalPlacas = 10): DashboardProjectionOverview => ({
  totalPlacas,
  placasDisponiveis: 6,
  placasOcupadas: 3,
  placasReservadas: 1,
  placasManutencao: 0,
  propostasEmAberto: 2,
  contratosAtivos: 3,
  regioesAtivas: 2,
  receitaEstimadaMensal: 5000,
});

const makeRegions = (): DashboardProjectionRegion[] => [
  {
    regiaoId: 'r1',
    regiao: 'Região Norte',
    totalPlacas: 5,
    placasAlugadas: 2,
    placasDisponiveis: 3,
    taxaOcupacao: 40,
    receitaEstimada: 2000,
    propostasAbertas: 1,
    contratosAtivos: 2,
  },
];

describe('DashboardReadModel', () => {
  let model: DashboardReadModel;
  const empresaId = 'empresa-test-001';

  beforeEach(() => {
    model = new DashboardReadModel();
  });

  describe('put/get', () => {
    it('stores and retrieves snapshot', () => {
      const overview = makeOverview();
      const regions = makeRegions();
      model.put(empresaId, overview, regions);

      const snapshot = model.get(empresaId);
      expect(snapshot).toBeDefined();
      expect(snapshot!.overview).toEqual(overview);
      expect(snapshot!.regions).toEqual(regions);
      expect(snapshot!.source).toBe('read_model');
    });

    it('returns undefined for unknown tenant', () => {
      expect(model.get('unknown')).toBeUndefined();
    });

    it('overwrites existing snapshot', () => {
      model.put(empresaId, makeOverview(10), []);
      model.put(empresaId, makeOverview(20), makeRegions());

      const snapshot = model.get(empresaId);
      expect(snapshot!.overview.totalPlacas).toBe(20);
      expect(snapshot!.regions).toHaveLength(1);
    });

    it('records builtAt timestamp', () => {
      const before = Date.now();
      model.put(empresaId, makeOverview(), makeRegions());
      const after = Date.now();

      const snapshot = model.get(empresaId);
      expect(snapshot!.builtAt).toBeGreaterThanOrEqual(before);
      expect(snapshot!.builtAt).toBeLessThanOrEqual(after);
    });
  });

  describe('isStale', () => {
    it('returns true for unknown tenant', () => {
      expect(model.isStale('unknown', 60_000)).toBe(true);
    });

    it('returns false for fresh snapshot', () => {
      model.put(empresaId, makeOverview(), []);
      expect(model.isStale(empresaId, 60_000)).toBe(false);
    });

    it('returns true when snapshot is older than maxAge', () => {
      model.put(empresaId, makeOverview(), []);
      // Snapshot is considered stale if maxAge = 0
      expect(model.isStale(empresaId, 0)).toBe(true);
    });
  });

  describe('invalidate', () => {
    it('removes snapshot for tenant', () => {
      model.put(empresaId, makeOverview(), makeRegions());
      model.invalidate(empresaId);
      expect(model.get(empresaId)).toBeUndefined();
    });

    it('does not affect other tenants', () => {
      model.put('tenant-a', makeOverview(5), []);
      model.put('tenant-b', makeOverview(10), []);
      model.invalidate('tenant-a');

      expect(model.get('tenant-a')).toBeUndefined();
      expect(model.get('tenant-b')).toBeDefined();
    });
  });

  describe('invalidateAll', () => {
    it('removes all snapshots', () => {
      model.put('t1', makeOverview(), []);
      model.put('t2', makeOverview(), []);
      model.invalidateAll();

      expect(model.size()).toBe(0);
    });
  });

  describe('size / listTenants', () => {
    it('returns correct tenant count', () => {
      expect(model.size()).toBe(0);
      model.put('t1', makeOverview(), []);
      model.put('t2', makeOverview(), []);
      expect(model.size()).toBe(2);
    });

    it('lists all tenant IDs', () => {
      model.put('alpha', makeOverview(), []);
      model.put('beta', makeOverview(), []);
      const tenants = model.listTenants();
      expect(tenants).toContain('alpha');
      expect(tenants).toContain('beta');
    });
  });
});
