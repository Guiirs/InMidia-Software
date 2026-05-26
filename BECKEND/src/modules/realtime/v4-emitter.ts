/**
 * Helpers de emissão de eventos realtime V4 por domínio.
 * Centraliza a nomenclatura canônica e garante payload consistente.
 * Ver: BECKEND/docs/V4_REALTIME_EVENT_CONTRACT.md
 */

import { randomUUID } from 'crypto';
import { eventBus } from './event-bus.service';
import {
  V4_INVENTORY_EVENTS,
  V4_CONTRACTS_EVENTS,
  V4_COMMERCIAL_EVENTS,
  V4_ALERTS_EVENTS,
  V4_OPERATIONS_EVENTS,
  V4_REPORTS_EVENTS,
  V4_SYSTEM_EVENTS,
  type V4EventType,
  type V4RealtimePayload,
} from './v4-events';
import { OPERATIONAL_EVENT_CATEGORIES, type OperationalEventSeverity } from './domain-events';

// ─── HELPER BASE ──────────────────────────────────────────────────────────────

interface EmitV4Options {
  tenantId: string;
  entityId: string;
  entityType: string;
  severity?: OperationalEventSeverity;
  payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

function emitV4(event: V4EventType, opts: EmitV4Options): V4RealtimePayload {
  const canonical: V4RealtimePayload = {
    id: randomUUID(),
    event,
    tenantId: opts.tenantId,
    entityId: opts.entityId,
    entityType: opts.entityType,
    timestamp: new Date().toISOString(),
    payload: opts.payload ?? {},
    metadata: opts.metadata ?? {},
  };

  const domain = event.split('.')[0] ?? 'system';
  const categoryMap: Record<string, string> = {
    inventory:  OPERATIONAL_EVENT_CATEGORIES.INVENTORY,
    contracts:  OPERATIONAL_EVENT_CATEGORIES.CONTRACTS,
    commercial: OPERATIONAL_EVENT_CATEGORIES.COMMERCIAL,
    alerts:     OPERATIONAL_EVENT_CATEGORIES.ALERTS,
    operations: OPERATIONAL_EVENT_CATEGORIES.OPERATIONS,
    reports:    OPERATIONAL_EVENT_CATEGORIES.REPORTS,
    system:     OPERATIONAL_EVENT_CATEGORIES.SYSTEM,
  };

  eventBus.emitFromInput({
    type: event as any,
    category: (categoryMap[domain] ?? OPERATIONAL_EVENT_CATEGORIES.SYSTEM) as any,
    entityType: opts.entityType,
    entityId: opts.entityId,
    severity: opts.severity ?? 'info',
    companyId: opts.tenantId,
    payload: { ...canonical },
    metadata: opts.metadata ?? {},
  });

  return canonical;
}

// ─── INVENTORY EMITTERS ───────────────────────────────────────────────────────

export const inventoryEmitter = {
  boardCreated(tenantId: string, placaId: string, extra: {
    numeroPlaca?: string;
    total?: number;
  } = {}) {
    return emitV4(V4_INVENTORY_EVENTS.BOARD_CREATED, {
      tenantId, entityId: placaId, entityType: 'board',
      payload: { placaId, ...extra },
    });
  },

  boardUpdated(tenantId: string, placaId: string, extra: {
    numeroPlaca?: string;
    changedFields?: string[];
    action?: string;
  } = {}) {
    return emitV4(V4_INVENTORY_EVENTS.BOARD_UPDATED, {
      tenantId, entityId: placaId, entityType: 'board',
      payload: { placaId, ...extra },
    });
  },

  boardAvailabilityChanged(tenantId: string, placaId: string, extra: {
    disponivel: boolean;
    previousStatus?: boolean;
    numeroPlaca?: string;
  }) {
    return emitV4(V4_INVENTORY_EVENTS.BOARD_AVAILABILITY_CHANGED, {
      tenantId, entityId: placaId, entityType: 'board',
      severity: 'info',
      payload: { placaId, ...extra },
    });
  },

  boardImageUpdated(tenantId: string, placaId: string, extra: {
    imageUrl?: string;
  } = {}) {
    return emitV4(V4_INVENTORY_EVENTS.BOARD_IMAGE_UPDATED, {
      tenantId, entityId: placaId, entityType: 'board',
      payload: { placaId, ...extra },
    });
  },

  boardDeleted(tenantId: string, placaId: string, extra: {
    numeroPlaca?: string;
  } = {}) {
    return emitV4(V4_INVENTORY_EVENTS.BOARD_DELETED, {
      tenantId, entityId: placaId, entityType: 'board',
      payload: { placaId, ...extra },
    });
  },

  summaryRefreshed(tenantId: string, extra: {
    totalBoards?: number;
    occupiedBoards?: number;
    occupancyRate?: number;
  } = {}) {
    return emitV4(V4_INVENTORY_EVENTS.SUMMARY_REFRESHED, {
      tenantId, entityId: tenantId, entityType: 'summary',
      payload: extra,
    });
  },

  regionUpdated(tenantId: string, regiaoId: string, extra: {
    nome?: string;
  } = {}) {
    return emitV4(V4_INVENTORY_EVENTS.REGION_UPDATED, {
      tenantId, entityId: regiaoId, entityType: 'region',
      payload: { regiaoId, ...extra },
    });
  },
};

// ─── CONTRACTS EMITTERS ───────────────────────────────────────────────────────

export const contractsEmitter = {
  created(tenantId: string, contractId: string, extra: {
    placaId?: string;
    clienteId?: string;
  } = {}) {
    return emitV4(V4_CONTRACTS_EVENTS.CREATED, {
      tenantId, entityId: contractId, entityType: 'contract',
      payload: { contractId, ...extra },
    });
  },

  updated(tenantId: string, contractId: string, extra: {
    changedFields?: string[];
    status?: string;
    reason?: string;
  } = {}) {
    return emitV4(V4_CONTRACTS_EVENTS.UPDATED, {
      tenantId, entityId: contractId, entityType: 'contract',
      payload: { contractId, ...extra },
    });
  },

  statusChanged(tenantId: string, contractId: string, extra: {
    status: string;
    previousStatus?: string;
  }) {
    return emitV4(V4_CONTRACTS_EVENTS.STATUS_CHANGED, {
      tenantId, entityId: contractId, entityType: 'contract',
      payload: { contractId, ...extra },
    });
  },

  cancelled(tenantId: string, contractId: string, extra: {
    reason?: string;
  } = {}) {
    return emitV4(V4_CONTRACTS_EVENTS.CANCELLED, {
      tenantId, entityId: contractId, entityType: 'contract',
      severity: 'warning',
      payload: { contractId, ...extra },
    });
  },

  renewed(tenantId: string, contractId: string, extra: {
    newEndDate?: string;
  } = {}) {
    return emitV4(V4_CONTRACTS_EVENTS.RENEWED, {
      tenantId, entityId: contractId, entityType: 'contract',
      payload: { contractId, ...extra },
    });
  },

  expiring(tenantId: string, extra: {
    expiring7Days?: number;
    expiring15Days?: number;
    expiring30Days?: number;
    activeContracts?: number;
  } = {}) {
    return emitV4(V4_CONTRACTS_EVENTS.EXPIRING, {
      tenantId, entityId: tenantId, entityType: 'contract',
      severity: 'warning',
      payload: extra,
    });
  },
};

// ─── COMMERCIAL EMITTERS ──────────────────────────────────────────────────────

export const commercialEmitter = {
  opportunityCreated(tenantId: string, opportunityId: string, extra: {
    stage?: string;
  } = {}) {
    return emitV4(V4_COMMERCIAL_EVENTS.OPPORTUNITY_CREATED, {
      tenantId, entityId: opportunityId, entityType: 'opportunity',
      payload: { opportunityId, ...extra },
    });
  },

  opportunityUpdated(tenantId: string, opportunityId: string, extra: {
    changedFields?: string[];
  } = {}) {
    return emitV4(V4_COMMERCIAL_EVENTS.OPPORTUNITY_UPDATED, {
      tenantId, entityId: opportunityId, entityType: 'opportunity',
      payload: { opportunityId, ...extra },
    });
  },

  opportunityStageChanged(tenantId: string, opportunityId: string, extra: {
    stage: string;
    previousStage?: string;
  }) {
    return emitV4(V4_COMMERCIAL_EVENTS.OPPORTUNITY_STAGE_CHANGED, {
      tenantId, entityId: opportunityId, entityType: 'opportunity',
      payload: { opportunityId, ...extra },
    });
  },

  proposalCreated(tenantId: string, proposalId: string, extra: {
    opportunityId?: string;
  } = {}) {
    return emitV4(V4_COMMERCIAL_EVENTS.PROPOSAL_CREATED, {
      tenantId, entityId: proposalId, entityType: 'proposal',
      payload: { proposalId, ...extra },
    });
  },

  proposalUpdated(tenantId: string, proposalId: string, extra: {
    changedFields?: string[];
  } = {}) {
    return emitV4(V4_COMMERCIAL_EVENTS.PROPOSAL_UPDATED, {
      tenantId, entityId: proposalId, entityType: 'proposal',
      payload: { proposalId, ...extra },
    });
  },

  proposalConverted(tenantId: string, proposalId: string, extra: {
    contractId?: string;
  } = {}) {
    return emitV4(V4_COMMERCIAL_EVENTS.PROPOSAL_CONVERTED, {
      tenantId, entityId: proposalId, entityType: 'proposal',
      payload: { proposalId, ...extra },
    });
  },

  activityCreated(tenantId: string, activityId: string, extra: {
    opportunityId?: string;
    type?: string;
  } = {}) {
    return emitV4(V4_COMMERCIAL_EVENTS.ACTIVITY_CREATED, {
      tenantId, entityId: activityId, entityType: 'activity',
      payload: { activityId, ...extra },
    });
  },

  regionCritical(tenantId: string, regiaoId: string, extra: {
    metric?: string;
    value?: number;
  } = {}) {
    return emitV4(V4_COMMERCIAL_EVENTS.REGION_CRITICAL, {
      tenantId, entityId: regiaoId, entityType: 'region',
      severity: 'critical',
      payload: { regiaoId, ...extra },
    });
  },

  occupancyLow(tenantId: string, regiaoId: string, extra: {
    occupancyRate?: number;
    threshold?: number;
  } = {}) {
    return emitV4(V4_COMMERCIAL_EVENTS.OCCUPANCY_LOW, {
      tenantId, entityId: regiaoId, entityType: 'occupancy',
      severity: 'warning',
      payload: { regiaoId, ...extra },
    });
  },
};

// ─── ALERTS EMITTERS ──────────────────────────────────────────────────────────

export const alertsEmitter = {
  created(tenantId: string, alertId: string, extra: {
    severity?: OperationalEventSeverity;
    domain?: string;
    message?: string;
  } = {}) {
    return emitV4(V4_ALERTS_EVENTS.CREATED, {
      tenantId, entityId: alertId, entityType: 'alert',
      severity: extra.severity ?? 'warning',
      payload: { alertId, ...extra },
    });
  },

  updated(tenantId: string, alertId: string, extra: {
    changedFields?: string[];
  } = {}) {
    return emitV4(V4_ALERTS_EVENTS.UPDATED, {
      tenantId, entityId: alertId, entityType: 'alert',
      payload: { alertId, ...extra },
    });
  },

  resolved(tenantId: string, alertId: string, extra: {
    resolvedBy?: string;
    resolution?: string;
  } = {}) {
    return emitV4(V4_ALERTS_EVENTS.RESOLVED, {
      tenantId, entityId: alertId, entityType: 'alert',
      payload: { alertId, ...extra },
    });
  },

  dismissed(tenantId: string, alertId: string, extra: {
    dismissedBy?: string;
  } = {}) {
    return emitV4(V4_ALERTS_EVENTS.DISMISSED, {
      tenantId, entityId: alertId, entityType: 'alert',
      payload: { alertId, ...extra },
    });
  },

  severityChanged(tenantId: string, alertId: string, extra: {
    severity: OperationalEventSeverity;
    previousSeverity?: OperationalEventSeverity;
  }) {
    return emitV4(V4_ALERTS_EVENTS.SEVERITY_CHANGED, {
      tenantId, entityId: alertId, entityType: 'alert',
      severity: extra.severity,
      payload: { alertId, ...extra },
    });
  },
};

// ─── OPERATIONS EMITTERS ──────────────────────────────────────────────────────

export const operationsEmitter = {
  taskCreated(tenantId: string, taskId: string, extra: {
    type?: string;
    owner?: string;
  } = {}) {
    return emitV4(V4_OPERATIONS_EVENTS.TASK_CREATED, {
      tenantId, entityId: taskId, entityType: 'task',
      payload: { taskId, ...extra },
    });
  },

  taskUpdated(tenantId: string, taskId: string, extra: {
    changedFields?: string[];
  } = {}) {
    return emitV4(V4_OPERATIONS_EVENTS.TASK_UPDATED, {
      tenantId, entityId: taskId, entityType: 'task',
      payload: { taskId, ...extra },
    });
  },

  taskCompleted(tenantId: string, taskId: string, extra: {
    completedBy?: string;
    completedAt?: string;
  } = {}) {
    return emitV4(V4_OPERATIONS_EVENTS.TASK_COMPLETED, {
      tenantId, entityId: taskId, entityType: 'task',
      payload: { taskId, ...extra },
    });
  },

  eventCreated(tenantId: string, eventId: string, extra: {
    type?: string;
    domain?: string;
  } = {}) {
    return emitV4(V4_OPERATIONS_EVENTS.EVENT_CREATED, {
      tenantId, entityId: eventId, entityType: 'event',
      payload: { eventId, ...extra },
    });
  },

  healthChanged(tenantId: string, extra: {
    metric?: string;
    value?: number;
    status?: string;
  } = {}) {
    return emitV4(V4_OPERATIONS_EVENTS.HEALTH_CHANGED, {
      tenantId, entityId: tenantId, entityType: 'health',
      severity: 'warning',
      payload: extra,
    });
  },

  inconsistencyDetected(tenantId: string, extra: {
    domain?: string;
    entity?: string;
    details?: string;
  } = {}) {
    return emitV4(V4_OPERATIONS_EVENTS.INCONSISTENCY_DETECTED, {
      tenantId, entityId: tenantId, entityType: 'data',
      severity: 'critical',
      payload: extra,
    });
  },
};

// ─── REPORTS EMITTERS ─────────────────────────────────────────────────────────

export const reportsEmitter = {
  updated(tenantId: string, extra: {
    reportType?: string;
    generatedAt?: string;
  } = {}) {
    return emitV4(V4_REPORTS_EVENTS.UPDATED, {
      tenantId, entityId: tenantId, entityType: 'report',
      payload: extra,
    });
  },

  exportCreated(tenantId: string, exportId: string, extra: {
    reportType?: string;
    format?: string;
  } = {}) {
    return emitV4(V4_REPORTS_EVENTS.EXPORT_CREATED, {
      tenantId, entityId: exportId, entityType: 'export',
      payload: { exportId, ...extra },
    });
  },

  exportCompleted(tenantId: string, exportId: string, extra: {
    downloadUrl?: string;
    expiresAt?: string;
  } = {}) {
    return emitV4(V4_REPORTS_EVENTS.EXPORT_COMPLETED, {
      tenantId, entityId: exportId, entityType: 'export',
      payload: { exportId, ...extra },
    });
  },
};

// ─── SYSTEM EMITTERS ──────────────────────────────────────────────────────────

export const systemEmitter = {
  statusChanged(tenantId: string, extra: {
    service?: string;
    status?: string;
    previousStatus?: string;
  } = {}) {
    return emitV4(V4_SYSTEM_EVENTS.STATUS_CHANGED, {
      tenantId, entityId: tenantId, entityType: 'system',
      severity: 'critical',
      payload: extra,
    });
  },

  dashboardInvalidated(tenantId: string, reason?: string) {
    return emitV4(V4_SYSTEM_EVENTS.DASHBOARD_INVALIDATED, {
      tenantId, entityId: tenantId, entityType: 'dashboard',
      payload: { reason: reason ?? 'manual' },
    });
  },
};
