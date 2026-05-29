import type { DomainMetricSnapshot } from './domain-metrics';
import type { ProjectionMetricSnapshot } from './projection-metrics';

export interface SloDefinition {
  domain: string;
  description?: string;
  latencyP95Ms: number;
  availability: number;  // target: 0-1 (e.g. 0.995 = 99.5%)
  errorRate: number;     // max acceptable: 0-1 (e.g. 0.01 = 1%)
}

export type SloComplianceLevel = 'compliant' | 'warning' | 'violated';

export interface SloStatus {
  domain: string;
  compliant: boolean;
  level: SloComplianceLevel;
  observed: {
    avgMs: number;
    maxMs: number;
    errorRate: number;
    availability: number;
  };
  targets: {
    latencyP95Ms: number;
    errorRate: number;
    availability: number;
  };
  violations: string[];
}

export interface SloComplianceReport {
  overall: SloComplianceLevel;
  compliantCount: number;
  warningCount: number;
  violatedCount: number;
  slos: SloStatus[];
  evaluatedAt: string;
}

const DEFAULT_SLOS: SloDefinition[] = [
  {
    domain: 'api',
    description: 'General API requests',
    latencyP95Ms: 500,
    availability: 0.999,
    errorRate: 0.01,
  },
  {
    domain: 'dashboard',
    description: 'Dashboard data endpoints',
    latencyP95Ms: 800,
    availability: 0.995,
    errorRate: 0.02,
  },
  {
    domain: 'inventory',
    description: 'Inventory listing and summary',
    latencyP95Ms: 600,
    availability: 0.995,
    errorRate: 0.02,
  },
  {
    domain: 'contracts',
    description: 'Contract lifecycle operations',
    latencyP95Ms: 600,
    availability: 0.999,
    errorRate: 0.01,
  },
  {
    domain: 'commercial',
    description: 'Commercial availability projection',
    latencyP95Ms: 400,
    availability: 0.999,
    errorRate: 0.01,
  },
  {
    domain: 'temporal',
    description: 'Temporal reservation engine',
    latencyP95Ms: 300,
    availability: 0.9999,
    errorRate: 0.005,
  },
  {
    domain: 'public_api',
    description: 'Public-facing plate and availability API',
    latencyP95Ms: 400,
    availability: 0.999,
    errorRate: 0.01,
  },
  {
    domain: 'realtime',
    description: 'SSE and real-time event streams',
    latencyP95Ms: 200,
    availability: 0.99,
    errorRate: 0.02,
  },
  {
    domain: 'projections',
    description: 'Projection rebuild latency (commercial, dashboard, inventory)',
    latencyP95Ms: 1_000,
    availability: 0.99,
    errorRate: 0.05,
  },
  {
    domain: 'database',
    description: 'MongoDB query layer',
    latencyP95Ms: 100,
    availability: 0.9999,
    errorRate: 0.001,
  },
];

function level(violations: string[]): SloComplianceLevel {
  if (violations.length === 0) return 'compliant';
  if (violations.length === 1) return 'warning';
  return 'violated';
}

export class SloRegistry {
  private readonly slos = new Map<string, SloDefinition>(
    DEFAULT_SLOS.map((slo) => [slo.domain, slo]),
  );

  register(slo: SloDefinition): void {
    this.slos.set(slo.domain, slo);
  }

  getAll(): SloDefinition[] {
    return Array.from(this.slos.values()).sort((a, b) => a.domain.localeCompare(b.domain));
  }

  get(domain: string): SloDefinition | undefined {
    return this.slos.get(domain);
  }

  evaluate(
    domainMetrics: DomainMetricSnapshot[],
    projectionMetrics?: ProjectionMetricSnapshot[],
  ): SloComplianceReport {
    const statuses: SloStatus[] = [];

    for (const slo of this.slos.values()) {
      const metric = domainMetrics.find((m) => m.domain === slo.domain);
      const projMetric = projectionMetrics?.find((m) => m.projection === slo.domain);

      // Use projection metrics for 'projections' domain
      const avgMs = projMetric?.avgMs ?? metric?.avgMs ?? 0;
      const maxMs = metric?.maxMs ?? projMetric?.maxMs ?? 0;
      const requests = metric?.requests ?? 0;
      const errors = metric?.errors ?? 0;
      const observedErrorRate = requests > 0 ? errors / requests : 0;
      const observedAvailability = 1 - observedErrorRate;

      const violations: string[] = [];

      if (requests > 0) {
        if (avgMs > slo.latencyP95Ms) {
          violations.push(`latency ${avgMs}ms > target ${slo.latencyP95Ms}ms`);
        }
        if (observedErrorRate > slo.errorRate) {
          violations.push(`errorRate ${(observedErrorRate * 100).toFixed(2)}% > target ${(slo.errorRate * 100).toFixed(2)}%`);
        }
        if (observedAvailability < slo.availability) {
          violations.push(`availability ${(observedAvailability * 100).toFixed(3)}% < target ${(slo.availability * 100).toFixed(3)}%`);
        }
      }

      statuses.push({
        domain: slo.domain,
        compliant: violations.length === 0,
        level: level(violations),
        observed: {
          avgMs,
          maxMs,
          errorRate: Number(observedErrorRate.toFixed(6)),
          availability: Number(observedAvailability.toFixed(6)),
        },
        targets: {
          latencyP95Ms: slo.latencyP95Ms,
          errorRate: slo.errorRate,
          availability: slo.availability,
        },
        violations,
      });
    }

    const violated = statuses.filter((s) => s.level === 'violated').length;
    const warning = statuses.filter((s) => s.level === 'warning').length;
    const compliant = statuses.filter((s) => s.compliant).length;

    const overall: SloComplianceLevel =
      violated > 0 ? 'violated' : warning > 0 ? 'warning' : 'compliant';

    return {
      overall,
      compliantCount: compliant,
      warningCount: warning,
      violatedCount: violated,
      slos: statuses.sort((a, b) => a.domain.localeCompare(b.domain)),
      evaluatedAt: new Date().toISOString(),
    };
  }
}

export const sloRegistry = new SloRegistry();
