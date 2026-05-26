import { buildRealtimeMapFromAdapters, syncDomainAdapters } from '../adapters/index.js';

const realtimeEventAliases = {
  PLACA_CREATED: 'inventory.board.created',
  PLACA_UPDATED: 'inventory.board.updated',
  PLACA_STATUS_CHANGED: 'inventory.board.availability.changed',
  PLACA_IMAGE_UPDATED: 'inventory.board.image.updated',
  CONTRATO_CREATED: 'contracts.created',
  CONTRATO_UPDATED: 'contracts.updated',
  CONTRATO_STATUS_CHANGED: 'contracts.status.changed',
  ALERT_CREATED: 'alerts.created',
  ALERT_UPDATED: 'alerts.updated',
  ALERT_RESOLVED: 'alerts.resolved',
  ALERT_READ: 'alerts.read',
  REPORT_GENERATED: 'reports.updated',
  EXPORT_READY: 'reports.export.completed',
  'contract.created': 'contracts.created',
  'contract.updated': 'contracts.updated',
  'contract.status.changed': 'contracts.status.changed',
  'alert.created': 'alerts.created',
  'alert.updated': 'alerts.updated',
  'alert.resolved': 'alerts.resolved',
  'report.updated': 'reports.updated',
};

function withRealtimeAliases(map) {
  const expanded = { ...map };
  Object.entries(realtimeEventAliases).forEach(([alias, canonical]) => {
    if (map[canonical]) expanded[alias] = map[canonical];
  });
  return expanded;
}

export const realtimeInvalidationMap = withRealtimeAliases(buildRealtimeMapFromAdapters(syncDomainAdapters));

export function getInvalidatedResourcesForEvent(eventType, registry) {
  const canonicalEventType = realtimeEventAliases[eventType] ?? eventType;
  const mapped = realtimeInvalidationMap[eventType] ?? realtimeInvalidationMap[canonicalEventType] ?? [];
  if (mapped.length) return mapped;

  return Object.values(registry)
    .filter((resource) => (
      resource.realtimeEvents?.includes(eventType)
      || resource.domainEvents?.includes(eventType)
      || resource.realtimeEvents?.includes(canonicalEventType)
      || resource.domainEvents?.includes(canonicalEventType)
    ))
    .map((resource) => resource.key);
}
