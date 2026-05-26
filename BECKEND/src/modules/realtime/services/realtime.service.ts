import logger from '@shared/container/logger';
import type {
  DashboardRealtimeUpdate,
  InventoryRealtimeUpdate,
  ProjectionRealtimeUpdate,
  RealtimeEvent,
  RealtimeEventType,
  RealtimePayload,
  RealtimePublishOptions,
  RealtimeSnapshot,
  RealtimeStreamName,
  RealtimeSubscribeOptions,
  RealtimeSubscriber,
  SpatialRealtimeUpdate,
} from '../contracts/realtime.contracts';
import { createRealtimeEvent } from '../emitters/realtime.emitter';
import { RealtimeStreamStore, realtimeStreamStore } from '../streams/realtime.stream-store';
import {
  RealtimeSubscriberRegistry,
  realtimeSubscriberRegistry,
} from '../subscribers/realtime-subscriber.registry';
import {
  RealtimeSyncStateStore,
  realtimeSyncStateStore,
} from '../sync/realtime-sync.state';

export class RealtimeService {
  constructor(
    private readonly streams: RealtimeStreamStore = realtimeStreamStore,
    private readonly subscribers: RealtimeSubscriberRegistry = realtimeSubscriberRegistry,
    private readonly syncState: RealtimeSyncStateStore = realtimeSyncStateStore,
  ) {}

  publishEvent(
    type: RealtimeEventType,
    stream: RealtimeStreamName,
    payload: RealtimePayload,
    options: RealtimePublishOptions = {},
  ): RealtimeEvent {
    const startedAt = Date.now();
    const version = this.streams.getVersion(stream) + 1;
    const event = createRealtimeEvent(type, stream, payload, version, options);

    this.streams.append(stream, event);
    const delivered = this.subscribers.broadcast(event);
    const latencyMs = Date.now() - startedAt;

    this.syncState.update({
      eventCount: this.streams.list().reduce((total, current) => total + current.events.length, 0),
      latencyMs,
    });

    logger.info('[RealtimeLayer] Event published', {
      eventType: type,
      stream,
      empresaId: options.empresaId,
      regiaoId: options.regiaoId,
      delivered,
      latencyMs,
    });

    return event;
  }

  subscribe(options: RealtimeSubscribeOptions = {}): RealtimeSubscriber {
    return this.subscribers.subscribe(options);
  }

  unsubscribe(subscriberId: string): boolean {
    return this.subscribers.unsubscribe(subscriberId);
  }

  broadcastProjectionUpdate(update: ProjectionRealtimeUpdate, options: RealtimePublishOptions = {}): RealtimeEvent {
    return this.publishEvent('projection.updated', 'projections', update, options);
  }

  broadcastInventoryUpdate(update: InventoryRealtimeUpdate, options: RealtimePublishOptions = {}): RealtimeEvent {
    const event = this.publishEvent('inventory.updated', 'inventory', update, options);

    if ((update.conflicts?.length ?? 0) > 0) {
      this.publishEvent('diagnostics.updated', 'diagnostics', {
        conflicts: update.conflicts,
        changedIds: update.changedIds,
      }, options);
    }

    return event;
  }

  broadcastSpatialUpdate(update: SpatialRealtimeUpdate, options: RealtimePublishOptions = {}): RealtimeEvent {
    return this.publishEvent('spatial.updated', 'spatial', update, options);
  }

  broadcastDashboardUpdate(update: DashboardRealtimeUpdate, options: RealtimePublishOptions = {}): RealtimeEvent {
    return this.publishEvent('dashboard.updated', 'dashboard', update, options);
  }

  buildRealtimeSnapshot(): RealtimeSnapshot {
    const subscribers = this.subscribers.list();
    const byEmpresa: Record<string, number> = {};
    const byRegion: Record<string, number> = {};

    subscribers.forEach((subscriber) => {
      if (subscriber.empresaId) byEmpresa[subscriber.empresaId] = (byEmpresa[subscriber.empresaId] ?? 0) + 1;
      if (subscriber.regiaoId) byRegion[subscriber.regiaoId] = (byRegion[subscriber.regiaoId] ?? 0) + 1;
    });

    return {
      streams: this.streams.list().map((stream) => ({
        name: stream.name,
        version: stream.version,
        eventCount: stream.events.length,
        lastEventAt: stream.lastEventAt,
        failures: stream.failures,
      })),
      subscribers: {
        total: subscribers.length,
        byEmpresa,
        byRegion,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  syncRealtimeState() {
    const streams = this.streams.list();
    const activeStreams = streams
      .filter((stream) => stream.events.length > 0)
      .map((stream) => stream.name);

    return this.syncState.get(
      this.subscribers.count(),
      activeStreams,
      streams.some((stream) => stream.failures > 0),
    );
  }

  heartbeat(): number {
    const delivered = this.subscribers.heartbeat();
    logger.debug('[RealtimeLayer] Heartbeat delivered', { delivered });
    return delivered;
  }

  cleanupInactive(cutoff: Date): number {
    const removed = this.subscribers.cleanupInactive(cutoff);
    if (removed > 0) {
      logger.info('[RealtimeLayer] Inactive subscribers cleaned', { removed });
    }
    return removed;
  }

  clearForTests(): void {
    this.streams.clear();
    this.subscribers.clear();
    this.syncState.clear();
  }
}

export const realtimeService = new RealtimeService();
