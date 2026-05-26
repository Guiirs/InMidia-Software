import { getVisualScore }          from './visualChecklist.js';
import { getOperationalScore }     from './operationalChecklist.js';
import { getAccessibilityScore }   from './accessibilityChecklist.js';
import { getConsistencyScore }     from './consistencyChecklist.js';
import { getResponsivenessScore }  from './responsivenessChecklist.js';

export * from './visualChecklist.js';
export * from './operationalChecklist.js';
export * from './accessibilityChecklist.js';
export * from './consistencyChecklist.js';
export * from './responsivenessChecklist.js';

export function getOverallQualityScore() {
  const v = getVisualScore();
  const o = getOperationalScore();
  const a = getAccessibilityScore();
  const c = getConsistencyScore();
  const r = getResponsivenessScore();

  const totalItems  = v.total + o.total + a.total + c.total + r.total;
  const totalPassed = v.passed + o.passed + a.passed + c.passed + r.passed;
  const criticalFailed = v.criticalFailed + o.criticalFailed + a.criticalFailed + c.criticalFailed + r.criticalFailed;
  const overallScore = Math.round((totalPassed / totalItems) * 100);

  return {
    overallScore,
    criticalFailed,
    readyForRollout: criticalFailed === 0,
    breakdown: {
      visual:         v.score,
      operational:    o.score,
      accessibility:  a.score,
      consistency:    c.score,
      responsiveness: r.score,
    },
    summary: `${totalPassed}/${totalItems} critérios passando. Score: ${overallScore}%. ${criticalFailed === 0 ? 'Pronto para rollout.' : `${criticalFailed} critérios críticos falhando.`}`,
  };
}
