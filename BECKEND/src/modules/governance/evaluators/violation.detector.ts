import type { GovernanceContext, GovernanceViolation } from '../contracts/governance.contracts';
import { createViolation } from './governance.helpers';

export class GovernanceViolationDetector {
  detect(context: GovernanceContext): GovernanceViolation[] {
    const violations: GovernanceViolation[] = [];

    if (context.projectionSnapshot && !context.projectionSnapshot.metadata.source) {
      violations.push(createViolation('SNAPSHOT_WITHOUT_SOURCE', 'high', 'Snapshot sem origem de calculo.', 'governance.structural.default', context.projectionSnapshot.metadata.projectionId));
    }

    if (context.usageLog && !context.usageLog.partnerId) {
      violations.push(createViolation('USAGE_LOG_WITHOUT_PARTNER', 'medium', 'Usage log publico sem partner associado.', 'governance.usage.default', context.usageLog.requestId));
    }

    const criticalIssues = context.dataQualitySnapshot?.summary.bySeverity.critical ?? 0;
    if (criticalIssues > 0 && context.hasAuditTrail === false) {
      violations.push(createViolation('CRITICAL_DATA_WITHOUT_AUDIT', 'critical', 'Dado critico sem trilha de auditoria confirmada.', 'governance.audit.default', context.dataQualitySnapshot?.sourceProjectionId));
    }

    return violations;
  }
}
