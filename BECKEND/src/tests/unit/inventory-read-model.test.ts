import { InventoryReadModel } from '../../modules/inventory/read-models/inventory-read-model';
import type { CommercialAvailabilityResult } from '../../modules/commercial-availability/commercial-availability.projection';
import type { InventoryBoardStatus } from '../../modules/inventory/services/inventory-projection.service';

function makeAvailable(): CommercialAvailabilityResult {
  return {
    status: 'AVAILABLE',
    source: 'temporal',
    isCommerciallyAvailable: true,
    isPhysicallyBlocked: false,
  };
}

function makeOccupied(): CommercialAvailabilityResult {
  return {
    status: 'CONTRACTED_ACTIVE',
    source: 'temporal',
    isCommerciallyAvailable: false,
    isPhysicallyBlocked: false,
  };
}

function buildMaps(plateIds: string[]): {
  statusByPlateId: Map<string, CommercialAvailabilityResult>;
  boardStatusByPlateId: Map<string, InventoryBoardStatus>;
} {
  const statusByPlateId = new Map<string, CommercialAvailabilityResult>();
  const boardStatusByPlateId = new Map<string, InventoryBoardStatus>();

  plateIds.forEach((id, i) => {
    const status = i % 2 === 0 ? makeAvailable() : makeOccupied();
    statusByPlateId.set(id, status);
    boardStatusByPlateId.set(id, status.isCommerciallyAvailable ? 'available' : 'occupied');
  });

  return { statusByPlateId, boardStatusByPlateId };
}

describe('InventoryReadModel', () => {
  let model: InventoryReadModel;
  const empresaId = 'empresa-inv-001';

  beforeEach(() => {
    model = new InventoryReadModel();
  });

  describe('put/get', () => {
    it('stores and retrieves snapshot', () => {
      const { statusByPlateId, boardStatusByPlateId } = buildMaps(['p1', 'p2', 'p3']);
      model.put(empresaId, statusByPlateId, boardStatusByPlateId);

      const snapshot = model.get(empresaId);
      expect(snapshot).toBeDefined();
      expect(snapshot!.plateCount).toBe(3);
      expect(snapshot!.source).toBe('read_model');
      expect(snapshot!.statusByPlateId.get('p1')).toEqual(makeAvailable());
      expect(snapshot!.boardStatusByPlateId.get('p2')).toBe('occupied');
    });

    it('returns undefined for unknown tenant', () => {
      expect(model.get('unknown')).toBeUndefined();
    });

    it('records builtAt timestamp', () => {
      const { statusByPlateId, boardStatusByPlateId } = buildMaps(['p1']);
      const before = Date.now();
      model.put(empresaId, statusByPlateId, boardStatusByPlateId);
      const after = Date.now();

      expect(model.get(empresaId)!.builtAt).toBeGreaterThanOrEqual(before);
      expect(model.get(empresaId)!.builtAt).toBeLessThanOrEqual(after);
    });
  });

  describe('isStale', () => {
    it('is stale for unknown tenant', () => {
      expect(model.isStale('unknown', 30_000)).toBe(true);
    });

    it('is not stale for fresh snapshot', () => {
      const { statusByPlateId, boardStatusByPlateId } = buildMaps(['p1']);
      model.put(empresaId, statusByPlateId, boardStatusByPlateId);
      expect(model.isStale(empresaId, 30_000)).toBe(false);
    });

    it('is stale when maxAgeMs = 0', () => {
      const { statusByPlateId, boardStatusByPlateId } = buildMaps(['p1']);
      model.put(empresaId, statusByPlateId, boardStatusByPlateId);
      expect(model.isStale(empresaId, 0)).toBe(true);
    });
  });

  describe('invalidate', () => {
    it('removes a tenant snapshot', () => {
      const { statusByPlateId, boardStatusByPlateId } = buildMaps(['p1']);
      model.put(empresaId, statusByPlateId, boardStatusByPlateId);
      model.invalidate(empresaId);
      expect(model.get(empresaId)).toBeUndefined();
    });
  });

  describe('invalidateAll', () => {
    it('clears all snapshots', () => {
      const maps = buildMaps(['p1']);
      model.put('t1', maps.statusByPlateId, maps.boardStatusByPlateId);
      model.put('t2', maps.statusByPlateId, maps.boardStatusByPlateId);
      model.invalidateAll();
      expect(model.size()).toBe(0);
    });
  });

  describe('size / listTenants', () => {
    it('tracks tenant count', () => {
      const maps = buildMaps(['p1']);
      expect(model.size()).toBe(0);
      model.put('t1', maps.statusByPlateId, maps.boardStatusByPlateId);
      model.put('t2', maps.statusByPlateId, maps.boardStatusByPlateId);
      expect(model.size()).toBe(2);
    });

    it('lists tenant IDs', () => {
      const maps = buildMaps(['p1']);
      model.put('alpha', maps.statusByPlateId, maps.boardStatusByPlateId);
      expect(model.listTenants()).toContain('alpha');
    });
  });
});
