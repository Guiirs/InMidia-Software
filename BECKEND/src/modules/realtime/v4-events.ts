/**
 * Tipos canônicos de eventos realtime V4.
 * Convenção: domain.entity.action (dot.notation, lowercase)
 * Ver: BECKEND/docs/V4_REALTIME_EVENT_CONTRACT.md
 */

// ─── INVENTORY ────────────────────────────────────────────────────────────────

export const V4_INVENTORY_EVENTS = {
  BOARD_CREATED:              'inventory.board.created',
  BOARD_UPDATED:              'inventory.board.updated',
  BOARD_AVAILABILITY_CHANGED: 'inventory.board.availability.changed',
  BOARD_IMAGE_UPDATED:        'inventory.board.image.updated',
  BOARD_DELETED:              'inventory.board.deleted',
  SUMMARY_REFRESHED:          'inventory.summary.refreshed',
  REGION_UPDATED:             'inventory.region.updated',
} as const;

// ─── CONTRACTS ────────────────────────────────────────────────────────────────

export const V4_CONTRACTS_EVENTS = {
  CREATED:        'contracts.created',
  UPDATED:        'contracts.updated',
  STATUS_CHANGED: 'contracts.status.changed',
  CANCELLED:      'contracts.cancelled',
  RENEWED:        'contracts.renewed',
  EXPIRING:       'contracts.expiring',
} as const;

// ─── COMMERCIAL ───────────────────────────────────────────────────────────────

export const V4_COMMERCIAL_EVENTS = {
  OPPORTUNITY_CREATED:       'commercial.opportunity.created',
  OPPORTUNITY_UPDATED:       'commercial.opportunity.updated',
  OPPORTUNITY_STAGE_CHANGED: 'commercial.opportunity.stage.changed',
  PROPOSAL_CREATED:          'commercial.proposal.created',
  PROPOSAL_UPDATED:          'commercial.proposal.updated',
  PROPOSAL_CONVERTED:        'commercial.proposal.converted',
  ACTIVITY_CREATED:          'commercial.activity.created',
  PIPELINE_UPDATED:          'commercial.pipeline.updated',
  REGION_CRITICAL:           'commercial.region.critical',
  OCCUPANCY_LOW:             'commercial.occupancy.low',
} as const;

// ─── ALERTS ───────────────────────────────────────────────────────────────────

export const V4_ALERTS_EVENTS = {
  CREATED:          'alerts.created',
  UPDATED:          'alerts.updated',
  RESOLVED:         'alerts.resolved',
  DISMISSED:        'alerts.dismissed',
  SEVERITY_CHANGED: 'alerts.severity.changed',
} as const;

// ─── OPERATIONS ───────────────────────────────────────────────────────────────

export const V4_OPERATIONS_EVENTS = {
  TASK_CREATED:              'operations.task.created',
  TASK_UPDATED:              'operations.task.updated',
  TASK_COMPLETED:            'operations.task.completed',
  EVENT_CREATED:             'operations.event.created',
  HEALTH_CHANGED:            'operations.health.changed',
  INCONSISTENCY_DETECTED:    'operations.inconsistency.detected',
  SUMMARY_REFRESHED:         'operations.summary.refreshed',
} as const;

// ─── REPORTS ──────────────────────────────────────────────────────────────────

export const V4_REPORTS_EVENTS = {
  UPDATED:          'reports.updated',
  EXPORT_CREATED:   'reports.export.created',
  EXPORT_COMPLETED: 'reports.export.completed',
} as const;

// ─── SYSTEM ───────────────────────────────────────────────────────────────────

export const V4_SYSTEM_EVENTS = {
  STATUS_CHANGED:       'system.status.changed',
  DASHBOARD_INVALIDATED:'system.dashboard.invalidated',
} as const;

// ─── MAPA LEGADO → CANÔNICO ───────────────────────────────────────────────────
// Usado durante período de migração para normalizar eventos antigos no receptor SSE.

export const LEGACY_TO_V4: Record<string, string> = {
  PLACA_CREATED:              V4_INVENTORY_EVENTS.BOARD_CREATED,
  PLACA_UPDATED:              V4_INVENTORY_EVENTS.BOARD_UPDATED,
  PLACA_STATUS_CHANGED:       V4_INVENTORY_EVENTS.BOARD_AVAILABILITY_CHANGED,
  PLACA_IMAGE_UPDATED:        V4_INVENTORY_EVENTS.BOARD_IMAGE_UPDATED,
  PLACA_DELETED:              V4_INVENTORY_EVENTS.BOARD_DELETED,
  REGIAO_UPDATED:             V4_INVENTORY_EVENTS.REGION_UPDATED,
  SUMMARY_REFRESHED:          V4_INVENTORY_EVENTS.SUMMARY_REFRESHED,

  CONTRACT_CREATED:           V4_CONTRACTS_EVENTS.CREATED,
  CONTRACT_UPDATED:           V4_CONTRACTS_EVENTS.UPDATED,
  CONTRACT_STATUS_CHANGED:    V4_CONTRACTS_EVENTS.STATUS_CHANGED,
  CONTRACT_CANCELLED:         V4_CONTRACTS_EVENTS.CANCELLED,
  CONTRACT_EXPIRING:          V4_CONTRACTS_EVENTS.EXPIRING,
  CONTRACT_RENEWED:           V4_CONTRACTS_EVENTS.RENEWED,

  COMMERCIAL_OPPORTUNITY_CREATED: V4_COMMERCIAL_EVENTS.OPPORTUNITY_CREATED,
  REGION_CRITICAL:            V4_COMMERCIAL_EVENTS.REGION_CRITICAL,
  LOW_OCCUPANCY_DETECTED:     V4_COMMERCIAL_EVENTS.OCCUPANCY_LOW,

  ALERT_CREATED:              V4_ALERTS_EVENTS.CREATED,
  ALERT_RESOLVED:             V4_ALERTS_EVENTS.RESOLVED,
  ALERT_SEVERITY_CHANGED:     V4_ALERTS_EVENTS.SEVERITY_CHANGED,

  OPERATIONS_HEALTH_CHANGED:  V4_OPERATIONS_EVENTS.HEALTH_CHANGED,
  DATA_INCONSISTENCY_DETECTED:V4_OPERATIONS_EVENTS.INCONSISTENCY_DETECTED,

  REPORT_UPDATED:             V4_REPORTS_EVENTS.UPDATED,
  EXPORT_FINISHED:            V4_REPORTS_EVENTS.EXPORT_COMPLETED,

  SYSTEM_STATUS_CHANGED:      V4_SYSTEM_EVENTS.STATUS_CHANGED,
  DASHBOARD_INVALIDATED:      V4_SYSTEM_EVENTS.DASHBOARD_INVALIDATED,
};

// ─── UNION TYPE ───────────────────────────────────────────────────────────────

export type V4InventoryEvent  = typeof V4_INVENTORY_EVENTS[keyof typeof V4_INVENTORY_EVENTS];
export type V4ContractsEvent  = typeof V4_CONTRACTS_EVENTS[keyof typeof V4_CONTRACTS_EVENTS];
export type V4CommercialEvent = typeof V4_COMMERCIAL_EVENTS[keyof typeof V4_COMMERCIAL_EVENTS];
export type V4AlertsEvent     = typeof V4_ALERTS_EVENTS[keyof typeof V4_ALERTS_EVENTS];
export type V4OperationsEvent = typeof V4_OPERATIONS_EVENTS[keyof typeof V4_OPERATIONS_EVENTS];
export type V4ReportsEvent    = typeof V4_REPORTS_EVENTS[keyof typeof V4_REPORTS_EVENTS];
export type V4SystemEvent     = typeof V4_SYSTEM_EVENTS[keyof typeof V4_SYSTEM_EVENTS];

export type V4EventType =
  | V4InventoryEvent
  | V4ContractsEvent
  | V4CommercialEvent
  | V4AlertsEvent
  | V4OperationsEvent
  | V4ReportsEvent
  | V4SystemEvent;

// ─── PAYLOAD CANÔNICO ─────────────────────────────────────────────────────────

export interface V4RealtimePayload {
  id: string;
  event: V4EventType;
  tenantId: string;
  entityId: string;
  entityType: string;
  timestamp: string;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
}
