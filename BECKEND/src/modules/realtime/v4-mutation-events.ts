import { eventBus } from './event-bus.service';

type V4MutationEventInput = {
  tenantId: string;
  event: string;
  entityId: string;
  entityType: string;
  actorId?: string;
};

export function emitV4MutationEvent(input: V4MutationEventInput): void {
  const timestamp = new Date().toISOString();

  eventBus.emitFromInput({
    type: input.event as any,
    category: input.entityType.split('.')[0] as any,
    companyId: input.tenantId,
    entityType: input.entityType,
    entityId: input.entityId,
    severity: 'info',
    timestamp,
    payload: {
      tenantId: input.tenantId,
      event: input.event,
      entityId: input.entityId,
      entityType: input.entityType,
      timestamp,
    },
    metadata: {
      actorId: input.actorId ?? '',
      source: 'v4-mutation',
    },
  });
}
