import type { EventBus } from './event-bus.interface';
import { Redis } from 'ioredis';
import logger from '@shared/container/logger';

const IOREDIS_OPTS = {
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 1,
  lazyConnect: true,
  enableOfflineQueue: false,
  connectTimeout: 3_000,
  commandTimeout: 2_000,
} as const;

export class RedisEventBus implements EventBus {
  private publisher: Redis;
  private subscriber: Redis;
  private subscriptions: Map<string, (message: any) => void | Promise<void>> = new Map();
  constructor(redisUrl?: string) {
    const url = redisUrl || process.env.REDIS_URL || 'redis://localhost:6379';

    this.publisher = new Redis(url, IOREDIS_OPTS as any);
    this.subscriber = new Redis(url, IOREDIS_OPTS as any);

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.publisher.on('connect', () => {
      logger.info('[RedisEventBus] Publisher connected');
    });

    this.publisher.on('error', (err: Error) => {
      // Suppress ECONNREFUSED noise — expected when Redis is not available
      if (!err.message.includes('ECONNREFUSED') && !err.message.includes('connect ETIMEDOUT')) {
        logger.warn(`[RedisEventBus] Publisher error: ${err.message}`);
      }
    });

    this.subscriber.on('connect', () => {
      logger.info('[RedisEventBus] Subscriber connected');
    });

    this.subscriber.on('error', (err: Error) => {
      if (!err.message.includes('ECONNREFUSED') && !err.message.includes('connect ETIMEDOUT')) {
        logger.warn(`[RedisEventBus] Subscriber error: ${err.message}`);
      }
    });

    this.subscriber.on('message', async (channel: string, message: string) => {
      try {
        const callback = this.subscriptions.get(channel);
        if (callback) {
          await callback(JSON.parse(message));
        }
      } catch (error: any) {
        logger.error(`[RedisEventBus] Error processing message on ${channel}: ${error.message}`);
      }
    });
  }

  async publish(topic: string, message: any): Promise<void> {
    try {
      await this.publisher.publish(topic, JSON.stringify(message));
    } catch (error: any) {
      // Non-fatal — degrade silently
      logger.debug(`[RedisEventBus] publish failed on ${topic}: ${error.message}`);
    }
  }

  async subscribe(topic: string, callback: (message: any) => void | Promise<void>): Promise<void> {
    try {
      this.subscriptions.set(topic, callback);
      await this.subscriber.subscribe(topic);
    } catch (error: any) {
      logger.warn(`[RedisEventBus] subscribe failed on ${topic}: ${error.message}`);
    }
  }

  async unsubscribe(topic: string): Promise<void> {
    try {
      this.subscriptions.delete(topic);
      await this.subscriber.unsubscribe(topic);
    } catch (error: any) {
      logger.debug(`[RedisEventBus] unsubscribe failed on ${topic}: ${error.message}`);
    }
  }

  async close(): Promise<void> {
    try {
      this.subscriptions.clear();
      await Promise.allSettled([
        this.publisher.quit(),
        this.subscriber.quit(),
      ]);
    } catch {
      // non-fatal on close
    }
  }
}
