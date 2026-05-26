import type {
  DashboardProjection,
  InventoryProjection,
  ProjectionEvent,
  ProjectionMetadata,
  ProjectionSnapshot,
  SpatialProjection,
} from '../contracts/projection.contracts';

describe('Projection contracts', () => {
  it('separates operational origin from projected state and metadata', () => {
    const event: ProjectionEvent = {
      id: 'event-1',
      type: 'projection.rebuilt',
      projectionType: 'snapshot',
      tenantId: 'empresa-1',
      occurredAt: '2026-05-18T12:00:00.000Z',
      source: 'test',
    };

    const metadata: ProjectionMetadata = {
      projectionId: 'projection-1',
      projectionType: 'snapshot',
      version: 1,
      tenantId: 'empresa-1',
      source: 'test',
      builtAt: '2026-05-18T12:00:00.000Z',
      durationMs: 1,
      itemCount: 0,
      partial: false,
      events: [event],
    };

    expect(metadata.events[0]?.type).toBe('projection.rebuilt');
  });

  it('represents snapshot read model pieces', () => {
    const inventory: InventoryProjection = {
      items: [],
      summary: {
        total: 0,
        available: 0,
        reserved: 0,
        occupied: 0,
        unavailable: 0,
        unknown: 0,
        healthy: 0,
        attention: 0,
        conflicts: 0,
        incomplete: 0,
        diagnostics: [],
      },
    };

    const spatial: SpatialProjection = {
      points: [],
      invalidPointIds: [],
      groups: [],
      status: 'empty',
    };

    const dashboard: DashboardProjection = {
      totalPlacas: 0,
      available: 0,
      reserved: 0,
      occupied: 0,
      unavailable: 0,
      unknown: 0,
      conflicts: 0,
      incomplete: 0,
      validMapPoints: 0,
      invalidMapPoints: 0,
      occupancyRate: 0,
    };

    const snapshot: ProjectionSnapshot = {
      inventory,
      spatial,
      dashboard,
      metadata: {
        projectionId: 'projection-1',
        projectionType: 'snapshot',
        version: 1,
        source: 'test',
        builtAt: '2026-05-18T12:00:00.000Z',
        durationMs: 1,
        itemCount: 0,
        partial: false,
        events: [],
      },
    };

    expect(snapshot.dashboard.totalPlacas).toBe(0);
    expect(snapshot.spatial.status).toBe('empty');
  });
});
