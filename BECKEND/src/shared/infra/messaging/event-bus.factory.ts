// src/shared/infra/messaging/event-bus.factory.ts
import { EventBus } from './event-bus.interface';
import { RedisEventBus } from './redis-event-bus';
import logger from '@shared/container/logger';

// Factory function to create EventBus instances
export function createEventBus(type: 'redis' | 'rabbitmq' = 'redis', config?: any): EventBus {
  switch (type) {
    case 'redis':
      logger.info('[EventBusFactory] Creating Redis-based EventBus');
      return new RedisEventBus(config?.redisUrl);

    case 'rabbitmq':
      // Future implementation for RabbitMQ
      logger.warn('[EventBusFactory] RabbitMQ EventBus not implemented yet, falling back to Redis');
      return new RedisEventBus(config?.redisUrl);

    default:
      logger.warn(`[EventBusFactory] Unknown EventBus type: ${type}, using Redis`);
      return new RedisEventBus(config?.redisUrl);
  }
}

// Singleton instance for the application
let eventBusInstance: EventBus | null = null;

export function getEventBus(): EventBus {
  if (!eventBusInstance) {
    const type = (process.env.EVENT_BUS_TYPE as 'redis' | 'rabbitmq') || 'redis';
    eventBusInstance = createEventBus(type);
  }
  return eventBusInstance;
}

export async function closeEventBus(): Promise<void> {
  if (eventBusInstance) {
    await eventBusInstance.close();
    eventBusInstance = null;
  }
}