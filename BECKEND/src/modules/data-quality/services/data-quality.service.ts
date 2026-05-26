import logger from '@shared/container/logger';
import type {
  DataCompletenessResult,
  DataConsistencyResult,
  DataIntegrityResult,
  DataQualityContext,
  DataQualityIssue,
  DataQualityResult,
  DataQualityScore,
  DataQualitySeverity,
  DataQualitySignal,
  DataQualitySnapshot,
  DataQualitySummary,
} from '../contracts/data-quality.contracts';
import { CompletenessAnalyzer } from '../analyzers/completeness.analyzer';
import { ConsistencyAnalyzer } from '../analyzers/consistency.analyzer';
import { IntegrityAnalyzer } from '../analyzers/integrity.analyzer';
import { GeoQualityScorer } from '../scorers/geo-quality.scorer';
import { InventoryQualityScorer } from '../scorers/inventory-quality.scorer';
import { MediaQualityScorer } from '../scorers/media-quality.scorer';
import { OperationalQualityScorer } from '../scorers/operational-quality.scorer';
import { severityRank } from '../diagnostics/data-quality.issue-factory';

const severities: DataQualitySeverity[] = ['low', 'medium', 'high', 'critical'];

export class DataQualityService {
  constructor(
    private readonly completenessAnalyzer = new CompletenessAnalyzer(),
    private readonly consistencyAnalyzer = new ConsistencyAnalyzer(),
    private readonly integrityAnalyzer = new IntegrityAnalyzer(),
    private readonly geoScorer = new GeoQualityScorer(),
    private readonly inventoryScorer = new InventoryQualityScorer(),
    private readonly mediaScorer = new MediaQualityScorer(),
    private readonly operationalScorer = new OperationalQualityScorer(),
  ) {}

  analyzeDataQuality(context: DataQualityContext): DataQualityResult {
    try {
      const snapshot = this.buildQualitySnapshot(context);

      logger.info('[DataQuality] Snapshot built', {
        score: snapshot.score.global,
        totalIssues: snapshot.summary.totalIssues,
        highestSeverity: snapshot.summary.highestSeverity,
        sourceProjectionId: snapshot.sourceProjectionId,
      });

      if (snapshot.summary.degraded) {
        logger.warn('[DataQuality] Quality degraded', {
          score: snapshot.score.global,
          signals: snapshot.signals.map((signal) => signal.type),
        });
      }

      return { ok: true, snapshot };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('[DataQuality] Analysis failed', { error: message });
      return { ok: false, error: message };
    }
  }

  calculateQualityScore(context: DataQualityContext): DataQualityScore {
    const geo = this.geoScorer.score(context);
    const inventory = this.inventoryScorer.score(context);
    const media = this.mediaScorer.score(context);
    const operational = this.operationalScorer.score(context);
    const global = Math.round((geo + inventory + media + operational) / 4);

    return { global, geo, inventory, media, operational };
  }

  analyzeCompleteness(context: DataQualityContext): DataCompletenessResult {
    return this.completenessAnalyzer.analyze(context);
  }

  analyzeConsistency(context: DataQualityContext): DataConsistencyResult {
    return this.consistencyAnalyzer.analyze(context);
  }

  analyzeIntegrity(context: DataQualityContext): DataIntegrityResult {
    return this.integrityAnalyzer.analyze(context);
  }

  detectDataIssues(context: DataQualityContext): DataQualityIssue[] {
    return [
      ...this.analyzeCompleteness(context).issues,
      ...this.analyzeConsistency(context).issues,
      ...this.analyzeIntegrity(context).issues,
    ];
  }

  buildQualitySnapshot(context: DataQualityContext): DataQualitySnapshot {
    const completeness = this.analyzeCompleteness(context);
    const consistency = this.analyzeConsistency(context);
    const integrity = this.analyzeIntegrity(context);
    const issues = this.dedupeIssues([
      ...completeness.issues,
      ...consistency.issues,
      ...integrity.issues,
    ]);
    const score = this.calculateQualityScore(context);
    const summary = this.buildQualitySummary(issues, score);
    const signals = this.buildSignals(score, issues, context.now ?? new Date());

    return {
      score,
      completeness,
      consistency,
      integrity,
      issues,
      signals,
      summary,
      generatedAt: (context.now ?? new Date()).toISOString(),
      sourceProjectionId: context.snapshot?.metadata.projectionId,
      sourceProjectionVersion: context.snapshot?.metadata.version,
    };
  }

  buildQualitySummary(issues: DataQualityIssue[], score?: DataQualityScore): DataQualitySummary {
    const bySeverity = severities.reduce<Record<DataQualitySeverity, number>>((acc, severity) => {
      acc[severity] = issues.filter((issue) => issue.severity === severity).length;
      return acc;
    }, { low: 0, medium: 0, high: 0, critical: 0 });

    const categories = [
      'geo',
      'inventory',
      'media',
      'operational',
      'structural',
      'availability',
      'territorial',
      'consistency',
    ] as const;

    const byCategory = categories.reduce<DataQualitySummary['byCategory']>((acc, category) => {
      acc[category] = issues.filter((issue) => issue.category === category).length;
      return acc;
    }, {
      geo: 0,
      inventory: 0,
      media: 0,
      operational: 0,
      structural: 0,
      availability: 0,
      territorial: 0,
      consistency: 0,
    });

    const highestSeverity = issues.reduce<DataQualitySeverity | null>((highest, issue) => {
      if (!highest) return issue.severity;
      return severityRank(issue.severity) > severityRank(highest) ? issue.severity : highest;
    }, null);

    return {
      totalIssues: issues.length,
      bySeverity,
      byCategory,
      degraded: (score?.global ?? 100) < 80 || bySeverity.critical > 0 || bySeverity.high > 0,
      highestSeverity,
    };
  }

  private buildSignals(score: DataQualityScore, issues: DataQualityIssue[], now: Date): DataQualitySignal[] {
    const emittedAt = now.toISOString();
    const signals: DataQualitySignal[] = [];

    if (score.global < 80) {
      signals.push({ id: `dq:${emittedAt}`, type: 'data-quality.degraded', severity: 'high', message: 'Score global de qualidade degradado.', emittedAt, meta: { score: score.global } });
    }
    if (score.geo < 75) {
      signals.push({ id: `geo:${emittedAt}`, type: 'geo-quality.low', severity: 'medium', message: 'Qualidade geografica abaixo do esperado.', emittedAt, meta: { score: score.geo } });
    }
    if (score.inventory < 75) {
      signals.push({ id: `inventory:${emittedAt}`, type: 'inventory-quality.low', severity: 'medium', message: 'Qualidade do inventario abaixo do esperado.', emittedAt, meta: { score: score.inventory } });
    }
    if (score.media < 75 || issues.some((issue) => issue.code === 'INVALID_MEDIA')) {
      signals.push({ id: `media:${emittedAt}`, type: 'media-quality.invalid', severity: 'medium', message: 'Qualidade de midia requer atencao.', emittedAt, meta: { score: score.media } });
    }
    if (issues.some((issue) => issue.code === 'SNAPSHOT_INCONSISTENT' || issue.code === 'PROJECTION_WITHOUT_SOURCE')) {
      signals.push({ id: `projection:${emittedAt}`, type: 'projection.integrity.failed', severity: 'high', message: 'Integridade da projection falhou.', emittedAt });
    }
    if (issues.some((issue) => issue.category === 'territorial')) {
      signals.push({ id: `territorial:${emittedAt}`, type: 'territorial.consistency.warning', severity: 'medium', message: 'Consistencia territorial requer revisao.', emittedAt });
    }

    return signals;
  }

  private dedupeIssues(issues: DataQualityIssue[]): DataQualityIssue[] {
    const seen = new Set<string>();
    return issues.filter((issue) => {
      if (seen.has(issue.id)) return false;
      seen.add(issue.id);
      return true;
    });
  }
}

export const dataQualityService = new DataQualityService();
