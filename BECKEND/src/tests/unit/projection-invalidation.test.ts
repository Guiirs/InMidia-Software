import type { CommercialAvailabilityResult } from '../../modules/commercial-availability/commercial-availability.projection';
import type { InventoryBoardStatus } from '../../modules/inventory/services/inventory-projection.service';

// ── Test fixtures ─────────────────────────────────────────────────────────

function makeOverview() {
  return {
    totalPlacas: 10, placasDisponiveis: 5, placasOcupadas: 3,
    placasReservadas: 1, placasManutencao: 1, propostasEmAberto: 0,
    contratosAtivos: 3, regioesAtivas: 2, receitaEstimadaMensal: 1000,
  };
}

function makePlateStatus(): CommercialAvailabilityResult {
  return {
    status: 'AVAILABLE', source: 'temporal',
    isCommerciallyAvailable: true, isPhysicallyBlocked: false,
  };
}

// ── Tests against the real singleton ─────────────────────────────────────
// Import singletons and spy on their methods

import { projectionInvalidationService } from '../../shared/infra/cache/projection-invalidation.service';
import { projectionCacheService } from '../../shared/infra/cache/projection-cache.service';
import { dashboardReadModel } from '../../modules/dashboard/read-models/dashboard-read-model';
import { inventoryReadModel } from '../../modules/inventory/read-models/inventory-read-model';
import { regionReadModel } from '../../modules/regions/read-models/region-read-model';

describe('ProjectionInvalidationService — singleton integration', () => {
  const empresaId = 'empresa-inv-test';

  beforeEach(() => {
    // Seed state into singletons
    projectionCacheService.set(`${empresaId}:commercial:h1`, 'data1', 5_000);
    projectionCacheService.set(`${empresaId}:dashboard:h2`, 'data2', 5_000);
    dashboardReadModel.put(empresaId, makeOverview(), []);
    const statusMap = new Map<string, CommercialAvailabilityResult>();
    statusMap.set('plate1', makePlateStatus());
    const boardMap = new Map<string, InventoryBoardStatus>();
    boardMap.set('plate1', 'available');
    inventoryReadModel.put(empresaId, statusMap, boardMap);
    regionReadModel.put(empresaId, [{
      regiaoId: 'r1', nome: 'Norte', totalPlacas: 5,
      placasOcupadas: 2, placasDisponiveis: 3, taxaOcupacao: 40, builtAt: Date.now(),
    }]);
  });

  afterEach(() => {
    projectionCacheService.clear();
    dashboardReadModel.invalidateAll();
    inventoryReadModel.invalidateAll();
    regionReadModel.invalidateAll();
  });

  describe('invalidateTenant', () => {
    it('clears cache keys for tenant', () => {
      projectionInvalidationService.invalidateTenant(empresaId);
      expect(projectionCacheService.get(`${empresaId}:commercial:h1`)).toBeUndefined();
      expect(projectionCacheService.get(`${empresaId}:dashboard:h2`)).toBeUndefined();
    });

    it('clears dashboard read model', () => {
      projectionInvalidationService.invalidateTenant(empresaId);
      expect(dashboardReadModel.get(empresaId)).toBeUndefined();
    });

    it('clears inventory read model', () => {
      projectionInvalidationService.invalidateTenant(empresaId);
      expect(inventoryReadModel.get(empresaId)).toBeUndefined();
    });

    it('clears region read model', () => {
      projectionInvalidationService.invalidateTenant(empresaId);
      expect(regionReadModel.get(empresaId)).toBeUndefined();
    });

    it('does not affect other tenants', () => {
      const otherTenant = 'other-tenant-xyz';
      projectionCacheService.set(`${otherTenant}:commercial:h9`, 'keep', 5_000);
      projectionInvalidationService.invalidateTenant(empresaId);
      expect(projectionCacheService.get(`${otherTenant}:commercial:h9`)).toBe('keep');
    });
  });

  describe('invalidateProjection — commercial', () => {
    it('clears cache and both read models', () => {
      projectionInvalidationService.invalidateProjection(empresaId, 'commercial');
      expect(dashboardReadModel.get(empresaId)).toBeUndefined();
      expect(inventoryReadModel.get(empresaId)).toBeUndefined();
    });
  });

  describe('invalidateProjection — dashboard', () => {
    it('clears dashboard read model and region read model', () => {
      projectionInvalidationService.invalidateProjection(empresaId, 'dashboard');
      expect(dashboardReadModel.get(empresaId)).toBeUndefined();
      expect(regionReadModel.get(empresaId)).toBeUndefined();
    });
  });

  describe('invalidateProjection — inventory', () => {
    it('clears inventory read model', () => {
      projectionInvalidationService.invalidateProjection(empresaId, 'inventory');
      expect(inventoryReadModel.get(empresaId)).toBeUndefined();
    });
  });

  describe('domain event handlers', () => {
    const handlers = [
      'onContractCreated',
      'onContractApproved',
      'onContractCancelled',
      'onPIApproved',
      'onPICancelled',
      'onTemporalReservationCreated',
      'onTemporalReservationExpired',
    ] as const;

    handlers.forEach((handler) => {
      it(`${handler} clears commercial projections`, () => {
        projectionInvalidationService[handler](empresaId);
        // All commercial invalidations cascade to dashboard + inventory read models
        expect(dashboardReadModel.get(empresaId)).toBeUndefined();
        expect(inventoryReadModel.get(empresaId)).toBeUndefined();
      });
    });

    it('onPlacaChanged clears all projections for tenant', () => {
      projectionInvalidationService.onPlacaChanged(empresaId);
      expect(dashboardReadModel.get(empresaId)).toBeUndefined();
      expect(inventoryReadModel.get(empresaId)).toBeUndefined();
    });

    it('onRegiaoChanged clears dashboard and region read models', () => {
      projectionInvalidationService.onRegiaoChanged(empresaId);
      expect(dashboardReadModel.get(empresaId)).toBeUndefined();
      expect(regionReadModel.get(empresaId)).toBeUndefined();
    });
  });
});
