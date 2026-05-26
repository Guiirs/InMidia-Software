import crypto from 'crypto';
import logger from '@shared/container/logger';
import type { ProjectionContext, ProjectionEvent, ProjectionEventType, ProjectionType } from '../contracts/projection.contracts';

export class ProjectionEmitter {
  private readonly events: ProjectionEvent[] = [];

  emit(
    type: ProjectionEventType,
    projectionType: ProjectionType,
    context: ProjectionContext = {},
    payload?: Record<string, unknown>,
  ): ProjectionEvent {
    const event: ProjectionEvent = {
      id: crypto.randomUUID(),
      type,
      projectionType,
      tenantId: context.tenantId,
      occurredAt: (context.now ?? new Date()).toISOString(),
      source: context.source ?? 'projection-layer',
      correlationId: context.correlationId,
      payload,
    };

    this.events.push(event);
    if (this.events.length > 500) this.events.shift();

    logger.info('[ProjectionLayer] Projection event emitted', {
      eventType: event.type,
      projectionType: event.projectionType,
      tenantId: event.tenantId,
      correlationId: event.correlationId,
    });

    return event;
  }

  list(): ProjectionEvent[] {
    return [...this.events];
  }

  clear(): void {
    this.events.length = 0;
  }
}

export const projectionEmitter = new ProjectionEmitter();
