import type {
  InventoryEvaluationResult,
  InventoryItem,
  InventorySource,
  InventoryStatus,
} from '../contracts/inventory.contracts';

describe('Inventory contracts', () => {
  it('keeps physical, commercial and operational statuses separated', () => {
    const status: InventoryStatus = {
      physical: 'active',
      commercial: 'available',
      operational: 'healthy',
    };

    expect(status).toEqual({
      physical: 'active',
      commercial: 'available',
      operational: 'healthy',
    });
  });

  it('represents an inventory item without exposing persistence details', () => {
    const item: InventoryItem = {
      placaId: 'placa-1',
      status: {
        physical: 'active',
        commercial: 'available',
        operational: 'healthy',
      },
      availability: {
        status: 'available',
        available: true,
        reason: 'NO_ACTIVE_OPERATIONAL_LINK',
      },
      occupancy: {
        occupied: false,
        reserved: false,
        activeSourceIds: [],
        futureSourceIds: [],
      },
      conflicts: [],
    };

    expect(item.placaId).toBe('placa-1');
  });

  it('accepts legacy placa source shape', () => {
    const source: InventorySource = {
      placa: {
        id: 'legacy-1',
        ativa: true,
        statusAluguel: 'disponivel',
      },
    };

    expect(source.placa.ativa).toBe(true);
  });

  it('represents evaluation result with diagnostics', () => {
    const result: InventoryEvaluationResult = {
      item: {
        placaId: 'placa-1',
        status: {
          physical: 'unknown',
          commercial: 'unknown',
          operational: 'attention',
        },
        availability: {
          status: 'unknown',
          available: null,
          reason: 'INSUFFICIENT_AVAILABILITY_DATA',
        },
        occupancy: {
          occupied: false,
          reserved: false,
          activeSourceIds: [],
          futureSourceIds: [],
        },
        conflicts: [],
      },
      diagnostics: [],
    };

    expect(result.item.availability.available).toBeNull();
  });
});
