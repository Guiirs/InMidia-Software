import { ProjectionService } from '../services/projection.service';
import { LocalProjectionStore } from '../stores/projection.store';
import { ProjectionEmitter } from '../emitters/projection.emitter';
import type { ProjectionBuildInput } from '../contracts/projection.contracts';

const NOW = new Date('2026-05-18T12:00:00.000Z');

function createService(): ProjectionService {
  return new ProjectionService(new LocalProjectionStore(), new ProjectionEmitter());
}

function input(): ProjectionBuildInput {
  return {
    inventorySources: [
      {
        placa: {
          _id: 'placa-1',
          empresaId: 'empresa-1',
          regiaoId: 'regiao-1',
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
          regiaoId: 'regiao-1',
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
          regiaoId: 'regiao-2',
          numero_placa: 'A-003',
          numeroOperacional: null,
          coordenadas: '999,999',
          disponivel: true,
        },
      },
    ],
  };
}

describe('ProjectionService', () => {
  it('builds inventory projection from Inventory Engine', () => {
    const service = createService();
    const projection = service.buildInventoryProjection(input(), { now: NOW });

    expect(projection.items).toHaveLength(3);
    expect(projection.summary.available).toBe(2);
    expect(projection.summary.occupied).toBe(1);
    expect(projection.summary.conflicts).toBeGreaterThanOrEqual(2);
  });

  it('builds spatial projection from Spatial Core compatible coordinates', () => {
    const service = createService();
    const inventory = service.buildInventoryProjection(input(), { now: NOW });
    const spatial = service.buildSpatialProjection(inventory);

    expect(spatial.points).toHaveLength(2);
    expect(spatial.invalidPointIds).toContain('placa-3');
    expect(spatial.boundingBox).toBeDefined();
    expect(spatial.groups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'regiao-1', count: 2 }),
      ]),
    );
  });

  it('builds dashboard projection with quick indicators', () => {
    const service = createService();
    const inventory = service.buildInventoryProjection(input(), { now: NOW });
    const spatial = service.buildSpatialProjection(inventory);
    const dashboard = service.buildDashboardProjection(inventory, spatial);

    expect(dashboard.totalPlacas).toBe(3);
    expect(dashboard.occupied).toBe(1);
    expect(dashboard.validMapPoints).toBe(2);
    expect(dashboard.invalidMapPoints).toBe(1);
  });

  it('generates projection snapshot with metadata and events', () => {
    const service = createService();
    const result = service.buildProjectionSnapshot(input(), {
      tenantId: 'empresa-1',
      source: 'test',
      now: NOW,
    });

    expect(result.ok).toBe(true);
    expect(result.projection?.metadata.tenantId).toBe('empresa-1');
    expect(result.events.map((event) => event.type)).toEqual([
      'inventory.updated',
      'spatial.updated',
      'dashboard.updated',
    ]);
  });

  it('rebuilds projection into local store with versioning', () => {
    const service = createService();

    const first = service.rebuildProjection(input(), { tenantId: 'empresa-1', now: NOW });
    const second = service.rebuildProjection(input(), { tenantId: 'empresa-1', now: NOW });

    expect(first.projection?.metadata.version).toBe(1);
    expect(second.projection?.metadata.version).toBe(2);
    expect(service.getSnapshot('empresa-1')?.metadata.version).toBe(2);
  });

  it('supports partial rebuild by source ids', () => {
    const service = createService();
    const result = service.rebuildProjection(input(), {
      tenantId: 'empresa-1',
      partialSourceIds: ['placa-2'],
      now: NOW,
    });

    expect(result.ok).toBe(true);
    expect(result.projection?.metadata.partial).toBe(true);
    expect(result.projection?.inventory.items).toHaveLength(1);
    expect(result.projection?.inventory.items[0]?.placaId).toBe('placa-2');
  });

  it('projects incomplete data without throwing', () => {
    const service = createService();
    const result = service.buildProjectionSnapshot({
      inventorySources: [{
        placa: {
          _id: 'incomplete-1',
          disponivel: null,
          coordenadas: null,
        },
      }],
    }, { now: NOW });

    expect(result.ok).toBe(true);
    expect(result.projection?.inventory.items[0]?.status.operational).toBe('incomplete');
    expect(result.projection?.dashboard.incomplete).toBe(1);
  });

  it('projects operational conflicts as diagnostics', () => {
    const service = createService();
    const result = service.buildProjectionSnapshot({
      inventorySources: [{
        placa: {
          _id: 'placa-conflict',
          empresaId: 'empresa-1',
          regiaoId: 'regiao-1',
          numeroOperacional: 9,
          coordenadas: '-23.55052,-46.633308',
          disponivel: true,
        },
        contratos: [{ id: 'contrato-1', status: 'ativo' }],
      }],
    }, { now: NOW });

    expect(result.projection?.inventory.summary.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'AVAILABLE_WITH_ACTIVE_CONTRACT' }),
      ]),
    );
  });
});
