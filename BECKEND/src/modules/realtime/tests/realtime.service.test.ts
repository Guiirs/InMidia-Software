import { RealtimeService } from '../services/realtime.service';
import { RealtimeStreamStore } from '../streams/realtime.stream-store';
import { RealtimeSubscriberRegistry } from '../subscribers/realtime-subscriber.registry';
import { RealtimeSyncStateStore } from '../sync/realtime-sync.state';
import type { RealtimeEvent } from '../contracts/realtime.contracts';

function createService(): RealtimeService {
  return new RealtimeService(
    new RealtimeStreamStore(),
    new RealtimeSubscriberRegistry(),
    new RealtimeSyncStateStore(),
  );
}

describe('RealtimeService', () => {
  it('subscribes and unsubscribes subscribers', () => {
    const service = createService();
    const subscriber = service.subscribe({ empresaId: 'empresa-1' });

    expect(service.buildRealtimeSnapshot().subscribers.total).toBe(1);
    expect(service.unsubscribe(subscriber.id)).toBe(true);
    expect(service.buildRealtimeSnapshot().subscribers.total).toBe(0);
  });

  it('writes SSE formatted events to response subscribers', () => {
    const service = createService();
    const writes: string[] = [];
    const response = {
      write: (chunk: string) => {
        writes.push(chunk);
        return true;
      },
    } as any;

    service.subscribe({ empresaId: 'empresa-1', channels: ['inventory'], response });
    service.broadcastInventoryUpdate({ changedIds: ['placa-1'] }, { empresaId: 'empresa-1', source: 'test' });

    expect(writes[0]).toContain('event: inventory.updated');
    expect(writes[0]).toContain('id: ');
  });

  it('sends heartbeat to subscribers', () => {
    const service = createService();
    const received: RealtimeEvent[] = [];

    service.subscribe({
      empresaId: 'empresa-1',
      send: (event) => {
        received.push(event);
        return true;
      },
    });

    expect(service.heartbeat()).toBe(1);
    expect(received[0]?.type).toBe('realtime.heartbeat');
  });

  it('broadcasts projection realtime update', () => {
    const service = createService();
    const received: RealtimeEvent[] = [];

    service.subscribe({
      empresaId: 'empresa-1',
      channels: ['projections'],
      send: (event) => {
        received.push(event);
        return true;
      },
    });

    service.broadcastProjectionUpdate({
      projectionEvent: {
        id: 'projection-event-1',
        type: 'projection.rebuilt',
        projectionType: 'snapshot',
        tenantId: 'empresa-1',
        occurredAt: '2026-05-18T12:00:00.000Z',
        source: 'test',
      },
      snapshotVersion: 1,
    }, { empresaId: 'empresa-1', source: 'test' });

    expect(received[0]?.type).toBe('projection.updated');
    expect(received[0]?.metadata.stream).toBe('projections');
  });

  it('publishes incremental inventory updates without global broadcast', () => {
    const service = createService();
    const empresaA: RealtimeEvent[] = [];
    const empresaB: RealtimeEvent[] = [];

    service.subscribe({
      empresaId: 'empresa-a',
      channels: ['inventory'],
      send: (event) => {
        empresaA.push(event);
        return true;
      },
    });
    service.subscribe({
      empresaId: 'empresa-b',
      channels: ['inventory'],
      send: (event) => {
        empresaB.push(event);
        return true;
      },
    });

    service.broadcastInventoryUpdate({ changedIds: ['placa-1'] }, {
      empresaId: 'empresa-a',
      partial: true,
    });

    expect(empresaA).toHaveLength(1);
    expect(empresaB).toHaveLength(0);
    expect(empresaA[0]?.metadata.partial).toBe(true);
  });

  it('supports partial rebuild events through projections stream', () => {
    const service = createService();
    const event = service.publishEvent('projection.rebuilt', 'projections', {
      changedIds: ['placa-2'],
    }, {
      empresaId: 'empresa-1',
      partial: true,
    });

    expect(event.metadata.partial).toBe(true);
    expect(event.metadata.version).toBe(1);
  });

  it('cleans inactive subscribers', () => {
    const service = createService();
    service.subscribe({ empresaId: 'empresa-1' });

    const removed = service.cleanupInactive(new Date(Date.now() + 1000));

    expect(removed).toBe(1);
    expect(service.buildRealtimeSnapshot().subscribers.total).toBe(0);
  });

  it('builds realtime snapshot and sync state', () => {
    const service = createService();
    service.subscribe({ empresaId: 'empresa-1', regiaoId: 'regiao-1' });
    service.broadcastDashboardUpdate({ totalPlacas: 10 }, { empresaId: 'empresa-1' });

    const snapshot = service.buildRealtimeSnapshot();
    const syncState = service.syncRealtimeState();

    expect(snapshot.subscribers.byEmpresa['empresa-1']).toBe(1);
    expect(snapshot.subscribers.byRegion['regiao-1']).toBe(1);
    expect(syncState.activeSubscribers).toBe(1);
    expect(syncState.activeStreams).toContain('dashboard');
    expect(syncState.streamIntegrity).toBe('healthy');
  });

  it('isolates streams by empresa and region', () => {
    const service = createService();
    const regionA: RealtimeEvent[] = [];
    const regionB: RealtimeEvent[] = [];

    service.subscribe({
      empresaId: 'empresa-1',
      regiaoId: 'regiao-a',
      channels: ['spatial'],
      send: (event) => {
        regionA.push(event);
        return true;
      },
    });
    service.subscribe({
      empresaId: 'empresa-1',
      regiaoId: 'regiao-b',
      channels: ['spatial'],
      send: (event) => {
        regionB.push(event);
        return true;
      },
    });

    service.broadcastSpatialUpdate({ changedIds: ['placa-1'] }, {
      empresaId: 'empresa-1',
      regiaoId: 'regiao-a',
    });

    expect(regionA).toHaveLength(1);
    expect(regionB).toHaveLength(0);
  });

  it('keeps reconnect-safe lastEventId', () => {
    const service = createService();
    const subscriber = service.subscribe({
      empresaId: 'empresa-1',
      lastEventId: 'previous-event',
    });

    expect(subscriber.lastEventId).toBe('previous-event');
    expect(subscriber.reconnects).toBe(1);
  });
});
