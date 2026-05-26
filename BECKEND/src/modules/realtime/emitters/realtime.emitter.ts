import crypto from 'crypto';
import type {
  RealtimeEvent,
  RealtimeEventType,
  RealtimePayload,
  RealtimePublishOptions,
  RealtimeStreamName,
} from '../contracts/realtime.contracts';

export function createRealtimeEvent(
  type: RealtimeEventType,
  stream: RealtimeStreamName,
  payload: RealtimePayload,
  version: number,
  options: RealtimePublishOptions = {},
): RealtimeEvent {
  const now = new Date().toISOString();

  return {
    type,
    payload,
    metadata: {
      eventId: crypto.randomUUID(),
      stream,
      empresaId: options.empresaId,
      regiaoId: options.regiaoId,
      source: options.source ?? 'realtime-layer',
      occurredAt: now,
      receivedAt: now,
      correlationId: options.correlationId,
      version,
      partial: options.partial ?? true,
    },
  };
}
