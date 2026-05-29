import type { EventBus } from './event-bus.interface';
import { MemoryEventBus } from './memory-event-bus';
import logger from '@shared/container/logger';

// Lazily import RedisEventBus to avoid ioredis connection attempts when disabled
let RedisEventBusClass: (new (redisUrl?: string) => EventBus) | null = null;

function getRedisEventBusClass(): new (redisUrl?: string) => EventBus {
  if (!RedisEventBusClass) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { RedisEventBus } = require('./redis-event-bus');
    RedisEventBusClass = RedisEventBus;
  }
  return RedisEventBusClass!;
}

function isRedisEnabled(): boolean {
  return process.env.REDIS_ENABLED !== 'false';
}

export function createEventBus(type: 'redis' | 'rabbitmq' | 'memory' = 'redis', config?: any): EventBus {
  // Explicit memory mode or Redis disabled globally
  if (type === 'memory' || !isRedisEnabled()) {
    const reason = !isRedisEnabled() ? 'REDIS_ENABLED=false' : 'mode=memory';
    logger.info(`[EventBusFactory] ${reason} — using in-memory event bus`);
    return new MemoryEventBus();
  }

  switch (type) {
    case 'redis': {
      logger.info('[EventBusFactory] Creating Redis-based EventBus');
      const Cls = getRedisEventBusClass();
      return new Cls(config?.redisUrl);
    }

    case 'rabbitmq':
      logger.warn('[EventBusFactory] RabbitMQ EventBus not implemented — falling back to Redis');
      return createEventBus('redis', config);

    default:
      logger.warn(`[EventBusFactory] Unknown EventBus type: ${type} — using in-memory`);
      return new MemoryEventBus();
  }
}

// Singleton instance for the application
let eventBusInstance: EventBus | null = null;

export function getEventBus(): EventBus {
  if (!eventBusInstance) {
    const type = (process.env.EVENT_BUS_TYPE as 'redis' | 'rabbitmq' | 'memory') || 'redis';
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
