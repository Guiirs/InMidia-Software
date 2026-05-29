import { EventEmitter } from 'events';
import type { EventBus } from './event-bus.interface';
import logger from '@shared/container/logger';

export class MemoryEventBus implements EventBus {
  private readonly emitter = new EventEmitter();
  private readonly subscriptions = new Map<string, (message: any) => void | Promise<void>>();

  constructor() {
    this.emitter.setMaxListeners(200);
    logger.debug('[MemoryEventBus] In-memory event bus initialized (Redis disabled)');
  }

  async publish(topic: string, message: any): Promise<void> {
    try {
      this.emitter.emit(topic, message);
    } catch {
      // non-fatal
    }
  }

  async subscribe(topic: string, callback: (message: any) => void | Promise<void>): Promise<void> {
    this.subscriptions.set(topic, callback);
    this.emitter.on(topic, callback);
  }

  async unsubscribe(topic: string): Promise<void> {
    const callback = this.subscriptions.get(topic);
    if (callback) {
      this.emitter.off(topic, callback);
      this.subscriptions.delete(topic);
    }
  }

  async close(): Promise<void> {
    this.emitter.removeAllListeners();
    this.subscriptions.clear();
  }
}
