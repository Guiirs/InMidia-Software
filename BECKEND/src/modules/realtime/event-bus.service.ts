import { EventEmitter } from 'events';
import logger from '@shared/container/logger';
import { createOperationalEvent, type CreateOperationalEventInput, type OperationalEvent } from './domain-events';
import { realtimeMetrics } from './realtime.metrics';

const EVENT_CHANNEL = 'operational.event';
const MAX_RECENT_EVENTS = 500;
const LISTENER_WARN_THRESHOLD = 100;

class EventBusService {
  private readonly emitter = new EventEmitter();
  private readonly recentEvents: OperationalEvent[] = [];

  constructor() {
    this.emitter.setMaxListeners(500);
  }

  emit(event: OperationalEvent): OperationalEvent {
    this.recentEvents.push(event);
    if (this.recentEvents.length > MAX_RECENT_EVENTS) {
      this.recentEvents.splice(0, this.recentEvents.length - MAX_RECENT_EVENTS);
    }

    this.emitter.emit(EVENT_CHANNEL, event);
    realtimeMetrics.recordEventEmitted();
    logger.debug(`[RealtimeEventBus] Evento emitido: ${event.type} company=${event.companyId} entity=${event.entityType}/${event.entityId}`);
    return event;
  }

  emitFromInput(input: CreateOperationalEventInput): OperationalEvent {
    return this.emit(createOperationalEvent(input));
  }

  subscribe(handler: (event: OperationalEvent) => void): void {
    this.emitter.on(EVENT_CHANNEL, handler);
    const count = this.emitter.listenerCount(EVENT_CHANNEL);
    realtimeMetrics.setActiveEventListeners(count);
    if (count >= LISTENER_WARN_THRESHOLD) {
      logger.warn(`[RealtimeEventBus] Listener count alto: ${count}`);
    }
  }

  unsubscribe(handler: (event: OperationalEvent) => void): void {
    this.emitter.off(EVENT_CHANNEL, handler);
    const count = this.emitter.listenerCount(EVENT_CHANNEL);
    realtimeMetrics.setActiveEventListeners(count);
  }

  diagnostics(): {
    channel: string;
    listenerCount: number;
    listenerWarnThreshold: number;
    recentEvents: number;
    maxRecentEvents: number;
  } {
    return {
      channel: EVENT_CHANNEL,
      listenerCount: this.emitter.listenerCount(EVENT_CHANNEL),
      listenerWarnThreshold: LISTENER_WARN_THRESHOLD,
      recentEvents: this.recentEvents.length,
      maxRecentEvents: MAX_RECENT_EVENTS,
    };
  }

  getRecentEvents(companyId?: string, sinceIso?: string): OperationalEvent[] {
    const sinceMs = sinceIso ? new Date(sinceIso).getTime() : Number.NaN;

    return this.recentEvents.filter((event) => {
      if (companyId && event.companyId !== companyId) return false;
      if (Number.isFinite(sinceMs)) {
        const eventMs = new Date(event.timestamp).getTime();
        if (!Number.isFinite(eventMs) || eventMs <= sinceMs) return false;
      }
      return true;
    });
  }
}

export const eventBus = new EventBusService();
