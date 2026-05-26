// Registro canônico de eventos V4. Convenção: domain.entity.action
// Ver: BECKEND/docs/V4_REALTIME_EVENT_CONTRACT.md

export const domainEvents = {
  // Inventory
  boardCreated:              'inventory.board.created',
  boardUpdated:              'inventory.board.updated',
  boardAvailabilityChanged:  'inventory.board.availability.changed',
  boardImageUpdated:         'inventory.board.image.updated',
  boardDeleted:              'inventory.board.deleted',
  inventorySummaryRefreshed: 'inventory.summary.refreshed',
  regionUpdated:             'inventory.region.updated',

  // Contracts
  contractsCreated:       'contracts.created',
  contractsUpdated:       'contracts.updated',
  contractsStatusChanged: 'contracts.status.changed',
  contractsCancelled:     'contracts.cancelled',
  contractsRenewed:       'contracts.renewed',
  contractsExpiring:      'contracts.expiring',

  // Commercial
  commercialOpportunityCreated:      'commercial.opportunity.created',
  commercialOpportunityUpdated:      'commercial.opportunity.updated',
  commercialOpportunityStageChanged: 'commercial.opportunity.stage.changed',
  commercialProposalCreated:         'commercial.proposal.created',
  commercialProposalUpdated:         'commercial.proposal.updated',
  commercialProposalConverted:       'commercial.proposal.converted',
  commercialActivityCreated:         'commercial.activity.created',
  commercialPipelineUpdated:         'commercial.pipeline.updated',
  commercialRegionCritical:          'commercial.region.critical',
  commercialOccupancyLow:            'commercial.occupancy.low',

  // Alerts
  alertsCreated:         'alerts.created',
  alertsUpdated:         'alerts.updated',
  alertsResolved:        'alerts.resolved',
  alertsDismissed:       'alerts.dismissed',
  alertsSeverityChanged: 'alerts.severity.changed',

  // Operations
  operationsTaskCreated:           'operations.task.created',
  operationsTaskUpdated:           'operations.task.updated',
  operationsTaskCompleted:         'operations.task.completed',
  operationsEventCreated:          'operations.event.created',
  operationsHealthChanged:         'operations.health.changed',
  operationsInconsistencyDetected: 'operations.inconsistency.detected',
  operationsSummaryRefreshed:      'operations.summary.refreshed',

  // Reports
  reportsUpdated:        'reports.updated',
  reportsExportCreated:  'reports.export.created',
  reportsExportCompleted:'reports.export.completed',

  // Dashboard
  dashboardUpdated: 'dashboard.updated',

  // System
  systemStatusChanged:       'system.status.changed',
  systemDashboardInvalidated:'system.dashboard.invalidated',

  // Auth & Mutations (framework — não chegam via SSE)
  authExpired:        'auth.expired',
  mutationCommitted:  'mutation.committed',
  mutationRolledBack: 'mutation.rolled_back',
  mutationConflicted: 'mutation.conflicted',
};

export function normalizeDomainEvent(event) {
  if (typeof event === 'string') return { type: event, payload: {}, source: 'manual' };
  return {
    type: event?.type ?? event?.eventType ?? event?.event,
    payload: event?.payload ?? {},
    source: event?.source ?? 'unknown',
    occurredAt: event?.occurredAt ?? Date.now(),
  };
}
