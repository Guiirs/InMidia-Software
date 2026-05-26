import type {
  ProjectionRealtimeUpdate,
  RealtimeEvent,
  RealtimeSnapshot,
  RealtimeStream,
  RealtimeSubscriber,
  RealtimeSyncState,
} from '../contracts/realtime.contracts';

describe('Realtime contracts', () => {
  it('separates event payload and metadata', () => {
    const event: RealtimeEvent = {
      type: 'inventory.updated',
      payload: { changedIds: ['placa-1'] },
      metadata: {
        eventId: 'event-1',
        stream: 'inventory',
        empresaId: 'empresa-1',
        regiaoId: 'regiao-1',
        source: 'test',
        occurredAt: '2026-05-18T12:00:00.000Z',
        receivedAt: '2026-05-18T12:00:00.000Z',
        version: 1,
        partial: true,
      },
    };

    expect(event.metadata.stream).toBe('inventory');
    expect(event.payload.changedIds).toEqual(['placa-1']);
  });

  it('represents streams, subscribers and sync state', () => {
    const stream: RealtimeStream = {
      name: 'dashboard',
      events: [],
      version: 1,
      failures: 0,
    };
    const subscriber: RealtimeSubscriber = {
      id: 'subscriber-1',
      empresaId: 'empresa-1',
      channels: ['dashboard'],
      connectedAt: '2026-05-18T12:00:00.000Z',
      reconnects: 0,
    };
    const state: RealtimeSyncState = {
      snapshotVersion: 1,
      eventCount: 0,
      localLatencyMs: 0,
      activeSubscribers: 1,
      activeStreams: ['dashboard'],
      streamIntegrity: 'healthy',
    };

    expect(stream.name).toBe('dashboard');
    expect(subscriber.channels).toContain('dashboard');
    expect(state.streamIntegrity).toBe('healthy');
  });

  it('represents projection realtime update payload', () => {
    const update: ProjectionRealtimeUpdate = {
      projectionEvent: {
        id: 'projection-event-1',
        type: 'projection.rebuilt',
        projectionType: 'snapshot',
        occurredAt: '2026-05-18T12:00:00.000Z',
        source: 'test',
      },
      snapshotVersion: 2,
      itemCount: 10,
    };

    expect(update.snapshotVersion).toBe(2);
  });

  it('represents realtime snapshot metrics', () => {
    const snapshot: RealtimeSnapshot = {
      streams: [{
        name: 'inventory',
        version: 1,
        eventCount: 1,
        failures: 0,
      }],
      subscribers: {
        total: 1,
        byEmpresa: { 'empresa-1': 1 },
        byRegion: {},
      },
      generatedAt: '2026-05-18T12:00:00.000Z',
    };

    expect(snapshot.streams[0]?.name).toBe('inventory');
  });
});
