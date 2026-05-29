import {
  SloRegistry,
  sloRegistry,
} from '../../shared/infra/monitoring/slo-registry';
import type { DomainMetricSnapshot } from '../../shared/infra/monitoring/domain-metrics';
import type { ProjectionMetricSnapshot } from '../../shared/infra/monitoring/projection-metrics';

function makeDomainMetric(
  domain: DomainMetricSnapshot['domain'],
  requests = 100,
  errors = 0,
  avgMs = 50,
  maxMs = 200,
): DomainMetricSnapshot {
  return { domain, requests, avgMs, maxMs, errors };
}

describe('SloRegistry', () => {
  let registry: SloRegistry;

  beforeEach(() => {
    registry = new SloRegistry();
  });

  describe('getAll', () => {
    it('returns all default SLO definitions', () => {
      const slos = registry.getAll();
      expect(slos.length).toBeGreaterThanOrEqual(9);
    });

    it('includes required domains', () => {
      const domains = registry.getAll().map((s) => s.domain);
      expect(domains).toContain('api');
      expect(domains).toContain('dashboard');
      expect(domains).toContain('inventory');
      expect(domains).toContain('temporal');
      expect(domains).toContain('public_api');
      expect(domains).toContain('database');
    });

    it('is sorted by domain name', () => {
      const names = registry.getAll().map((s) => s.domain);
      const sorted = [...names].sort();
      expect(names).toEqual(sorted);
    });
  });

  describe('register', () => {
    it('adds a new SLO definition', () => {
      registry.register({ domain: 'custom', latencyP95Ms: 200, availability: 0.99, errorRate: 0.02 });
      expect(registry.get('custom')).toBeDefined();
    });

    it('overrides existing definition', () => {
      registry.register({ domain: 'dashboard', latencyP95Ms: 100, availability: 0.9999, errorRate: 0.001 });
      expect(registry.get('dashboard')!.latencyP95Ms).toBe(100);
    });
  });

  describe('evaluate — compliant scenario', () => {
    it('returns compliant when metrics are within targets', () => {
      const metrics: DomainMetricSnapshot[] = [
        makeDomainMetric('dashboard', 1000, 5, 200),   // errorRate=0.5%, latency=200ms
        makeDomainMetric('inventory', 500, 2, 100),
      ];
      const report = registry.evaluate(metrics);
      const dashboard = report.slos.find((s) => s.domain === 'dashboard')!;
      expect(dashboard.compliant).toBe(true);
      expect(dashboard.level).toBe('compliant');
    });

    it('reports 0 violations for compliant domain', () => {
      const metrics: DomainMetricSnapshot[] = [makeDomainMetric('dashboard', 100, 0, 50)];
      const report = registry.evaluate(metrics);
      const dash = report.slos.find((s) => s.domain === 'dashboard')!;
      expect(dash.violations).toHaveLength(0);
    });
  });

  describe('evaluate — violation scenarios', () => {
    it('detects latency violation', () => {
      // dashboard target: 800ms
      const metrics: DomainMetricSnapshot[] = [makeDomainMetric('dashboard', 100, 0, 1200)];
      const report = registry.evaluate(metrics);
      const dash = report.slos.find((s) => s.domain === 'dashboard')!;
      expect(dash.compliant).toBe(false);
      expect(dash.violations.some((v) => v.includes('latency'))).toBe(true);
    });

    it('detects error rate violation', () => {
      // dashboard target: 2% error rate
      const metrics: DomainMetricSnapshot[] = [makeDomainMetric('dashboard', 100, 10, 50)]; // 10% errors
      const report = registry.evaluate(metrics);
      const dash = report.slos.find((s) => s.domain === 'dashboard')!;
      expect(dash.compliant).toBe(false);
      expect(dash.violations.some((v) => v.includes('errorRate'))).toBe(true);
    });

    it('multiple violations set level to violated', () => {
      // Both latency AND error rate violated for dashboard
      const metrics: DomainMetricSnapshot[] = [makeDomainMetric('dashboard', 100, 10, 1000)];
      const report = registry.evaluate(metrics);
      const dash = report.slos.find((s) => s.domain === 'dashboard')!;
      expect(dash.level).toBe('violated');
      expect(dash.violations.length).toBeGreaterThanOrEqual(2);
    });

    it('single violation sets level to warning', () => {
      // Only latency violated for dashboard (target 800ms, observed 900ms)
      const metrics: DomainMetricSnapshot[] = [makeDomainMetric('dashboard', 100, 0, 900)];
      const report = registry.evaluate(metrics);
      const dash = report.slos.find((s) => s.domain === 'dashboard')!;
      expect(dash.level).toBe('warning');
      expect(dash.violations).toHaveLength(1);
    });
  });

  describe('evaluate — zero-traffic domains', () => {
    it('does not flag violations for domains with no requests', () => {
      const metrics: DomainMetricSnapshot[] = [];
      const report = registry.evaluate(metrics);
      // All SLOs should be compliant since requests=0 skips evaluation
      report.slos.forEach((slo) => {
        expect(slo.violations).toHaveLength(0);
      });
    });
  });

  describe('evaluate — overall level', () => {
    it('overall is compliant when all metrics pass', () => {
      const metrics: DomainMetricSnapshot[] = [
        makeDomainMetric('dashboard', 100, 0, 50),
        makeDomainMetric('inventory', 100, 0, 50),
      ];
      const report = registry.evaluate(metrics);
      expect(['compliant', 'warning']).toContain(report.overall);
    });

    it('overall is violated when at least one domain has multiple violations', () => {
      // dashboard: 50% errors + 2000ms latency — definitely violated
      const metrics: DomainMetricSnapshot[] = [makeDomainMetric('dashboard', 100, 50, 2000)];
      const report = registry.evaluate(metrics);
      const dash = report.slos.find((s) => s.domain === 'dashboard')!;
      expect(dash.level).toBe('violated');
      expect(report.violatedCount).toBeGreaterThanOrEqual(1);
    });

    it('counts compliant/warning/violated correctly', () => {
      const metrics: DomainMetricSnapshot[] = [
        makeDomainMetric('dashboard', 100, 0, 50),   // compliant
        makeDomainMetric('inventory', 100, 50, 2000), // violated
      ];
      const report = registry.evaluate(metrics);
      const inv = report.slos.find((s) => s.domain === 'inventory')!;
      expect(inv.level).toBe('violated');
      expect(report.compliantCount + report.warningCount + report.violatedCount).toBe(report.slos.length);
    });
  });

  describe('evaluate — with projection metrics', () => {
    it('does not crash with projection metrics provided', () => {
      const projectionMetrics: ProjectionMetricSnapshot[] = [
        {
          projection: 'commercial',
          calls: 50, avgMs: 30, maxMs: 100,
          totalPlates: 500, avgPlates: 10,
          fallbackCount: 0, fallbackRate: 0,
          cacheHits: 40, cacheMisses: 10, cacheHitRate: 0.8,
          rebuildCount: 10,
        },
      ];
      expect(() => registry.evaluate([], projectionMetrics)).not.toThrow();
    });
  });

  describe('sloRegistry singleton', () => {
    it('has all default domains registered', () => {
      const domains = sloRegistry.getAll().map((s) => s.domain);
      expect(domains).toContain('dashboard');
      expect(domains).toContain('inventory');
      expect(domains).toContain('temporal');
    });
  });
});
