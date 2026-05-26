// src/shared/infra/messaging/redis-event-bus.ts
import { EventBus } from './event-bus.interface';
import { Redis } from 'ioredis';
import logger from '@shared/container/logger';

export class RedisEventBus implements EventBus {
  private publisher: Redis;
  private subscriber: Redis;
  private subscriptions: Map<string, (message: any) => void | Promise<void>> = new Map();

  constructor(redisUrl?: string) {
    const url = redisUrl || process.env.REDIS_URL || 'redis://localhost:6379';

    // Publisher client
    this.publisher = new Redis(url, {
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    } as any);

    // Subscriber client (separate connection for pub/sub)
    this.subscriber = new Redis(url, {
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    } as any);

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.publisher.on('connect', () => {
      logger.info('[RedisEventBus] Publisher connected to Redis');
    });

    this.publisher.on('error', (err) => {
      logger.error('[RedisEventBus] Publisher error:', err.message);
    });

    this.subscriber.on('connect', () => {
      logger.info('[RedisEventBus] Subscriber connected to Redis');
    });

    this.subscriber.on('error', (err) => {
      logger.error('[RedisEventBus] Subscriber error:', err.message);
    });

    // Handle incoming messages
    this.subscriber.on('message', async (channel: string, message: string) => {
      try {
        const callback = this.subscriptions.get(channel);
        if (callback) {
          const parsedMessage = JSON.parse(message);
          await callback(parsedMessage);
        }
      } catch (error: any) {
        logger.error(`[RedisEventBus] Error processing message on channel ${channel}:`, error.message);
      }
    });
  }

  async publish(topic: string, message: any): Promise<void> {
    try {
      const serializedMessage = JSON.stringify(message);
      await this.publisher.publish(topic, serializedMessage);
      logger.debug(`[RedisEventBus] Published message to topic: ${topic}`);
    } catch (error: any) {
      logger.error(`[RedisEventBus] Error publishing to topic ${topic}:`, error.message);
      throw error;
    }
  }

  async subscribe(topic: string, callback: (message: any) => void | Promise<void>): Promise<void> {
    try {
      this.subscriptions.set(topic, callback);
      await this.subscriber.subscribe(topic);
      logger.info(`[RedisEventBus] Subscribed to topic: ${topic}`);
    } catch (error: any) {
      logger.error(`[RedisEventBus] Error subscribing to topic ${topic}:`, error.message);
      throw error;
    }
  }

  async unsubscribe(topic: string): Promise<void> {
    try {
      this.subscriptions.delete(topic);
      await this.subscriber.unsubscribe(topic);
      logger.info(`[RedisEventBus] Unsubscribed from topic: ${topic}`);
    } catch (error: any) {
      logger.error(`[RedisEventBus] Error unsubscribing from topic ${topic}:`, error.message);
      throw error;
    }
  }

  async close(): Promise<void> {
    try {
      this.subscriptions.clear();
      await Promise.all([
        this.publisher.quit(),
        this.subscriber.quit()
      ]);
      logger.info('[RedisEventBus] Closed all connections');
    } catch (error: any) {
      logger.error('[RedisEventBus] Error closing connections:', error.message);
    }
  }
}