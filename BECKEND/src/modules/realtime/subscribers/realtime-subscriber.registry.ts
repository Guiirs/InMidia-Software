import crypto from 'crypto';
import logger from '@shared/container/logger';
import type {
  RealtimeEvent,
  RealtimeStreamName,
  RealtimeSubscribeOptions,
  RealtimeSubscriber,
} from '../contracts/realtime.contracts';

const DEFAULT_CHANNELS: RealtimeStreamName[] = ['inventory', 'dashboard', 'spatial', 'diagnostics', 'projections'];

export class RealtimeSubscriberRegistry {
  private readonly subscribers = new Map<string, RealtimeSubscriber>();

  subscribe(options: RealtimeSubscribeOptions = {}): RealtimeSubscriber {
    const subscriber: RealtimeSubscriber = {
      id: crypto.randomUUID(),
      empresaId: options.empresaId,
      regiaoId: options.regiaoId,
      channels: options.channels ?? DEFAULT_CHANNELS,
      connectedAt: new Date().toISOString(),
      lastEventId: options.lastEventId,
      reconnects: options.lastEventId ? 1 : 0,
      response: options.response,
      send: options.send,
    };

    this.subscribers.set(subscriber.id, subscriber);

    logger.info('[RealtimeLayer] Subscriber connected', {
      subscriberId: subscriber.id,
      empresaId: subscriber.empresaId,
      regiaoId: subscriber.regiaoId,
      channels: subscriber.channels,
      reconnect: !!options.lastEventId,
    });

    return subscriber;
  }

  unsubscribe(id: string): boolean {
    const subscriber = this.subscribers.get(id);
    const removed = this.subscribers.delete(id);

    if (removed) {
      logger.info('[RealtimeLayer] Subscriber disconnected', {
        subscriberId: id,
        empresaId: subscriber?.empresaId,
      });
    }

    return removed;
  }

  broadcast(event: RealtimeEvent): number {
    let delivered = 0;
    const dead: string[] = [];

    for (const subscriber of this.subscribers.values()) {
      if (!this.matches(subscriber, event)) continue;

      try {
        const sent = this.write(subscriber, event);
        if (sent) {
          subscriber.lastEventId = event.metadata.eventId;
          delivered += 1;
        } else {
          dead.push(subscriber.id);
        }
      } catch {
        dead.push(subscriber.id);
      }
    }

    dead.forEach((id) => this.unsubscribe(id));
    return delivered;
  }

  heartbeat(now = new Date()): number {
    const heartbeat: RealtimeEvent = {
      type: 'realtime.heartbeat',
      payload: { serverTime: now.toISOString() },
      metadata: {
        eventId: `heartbeat:${now.toISOString()}`,
        stream: 'diagnostics',
        source: 'realtime-layer',
        occurredAt: now.toISOString(),
        receivedAt: now.toISOString(),
        version: 0,
        partial: true,
      },
    };

    let delivered = 0;
    for (const subscriber of this.subscribers.values()) {
      if (this.write(subscriber, heartbeat)) {
        subscriber.lastHeartbeatAt = now.toISOString();
        delivered += 1;
      }
    }

    return delivered;
  }

  cleanupInactive(cutoff: Date): number {
    let removed = 0;
    for (const subscriber of this.subscribers.values()) {
      const lastSeen = subscriber.lastHeartbeatAt ?? subscriber.connectedAt;
      if (new Date(lastSeen) < cutoff) {
        this.unsubscribe(subscriber.id);
        removed += 1;
      }
    }
    return removed;
  }

  count(): number {
    return this.subscribers.size;
  }

  list(): RealtimeSubscriber[] {
    return Array.from(this.subscribers.values());
  }

  clear(): void {
    this.subscribers.clear();
  }

  private matches(subscriber: RealtimeSubscriber, event: RealtimeEvent): boolean {
    if (!subscriber.channels.includes(event.metadata.stream)) return false;
    if (subscriber.empresaId && event.metadata.empresaId && subscriber.empresaId !== event.metadata.empresaId) return false;
    if (subscriber.regiaoId && event.metadata.regiaoId && subscriber.regiaoId !== event.metadata.regiaoId) return false;
    return true;
  }

  private write(subscriber: RealtimeSubscriber, event: RealtimeEvent): boolean {
    if (subscriber.send) return subscriber.send(event);
    if (!subscriber.response) return true;

    subscriber.response.write(
      `id: ${event.metadata.eventId}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
    );
    return true;
  }
}

export const realtimeSubscriberRegistry = new RealtimeSubscriberRegistry();
