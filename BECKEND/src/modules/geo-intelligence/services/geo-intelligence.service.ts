import logger from '@shared/container/logger';
import { realtimeService } from '@modules/realtime';
import { CoverageAnalyzer } from '../analyzers/coverage.analyzer';
import { OccupancyAnalyzer } from '../analyzers/occupancy.analyzer';
import { OpportunityDetector } from '../analyzers/opportunity.detector';
import { RiskDetector } from '../analyzers/risk.detector';
import { DensityCalculator } from '../calculators/density.calculator';
import { RegionScoreCalculator } from '../calculators/region-score.calculator';
import type {
  GeoIntelligenceContext,
  GeoIntelligenceResult,
  GeoIntelligenceSnapshot,
} from '../contracts/geo-intelligence.contracts';

export class GeoIntelligenceService {
  constructor(
    private readonly coverageAnalyzer = new CoverageAnalyzer(),
    private readonly densityCalculator = new DensityCalculator(),
    private readonly occupancyAnalyzer = new OccupancyAnalyzer(),
    private readonly opportunityDetector = new OpportunityDetector(),
    private readonly riskDetector = new RiskDetector(),
    private readonly regionScoreCalculator = new RegionScoreCalculator(),
  ) {}

  analyzeCoverage(context: GeoIntelligenceContext) {
    return this.coverageAnalyzer.analyzeCoverage(context);
  }

  analyzeDensity(context: GeoIntelligenceContext) {
    return this.densityCalculator.analyzeDensity(context);
  }

  analyzeOccupancy(context: GeoIntelligenceContext) {
    return this.occupancyAnalyzer.analyzeOccupancy(context);
  }

  analyzeAvailability(context: GeoIntelligenceContext) {
    return this.occupancyAnalyzer.analyzeAvailability(context);
  }

  calculateRegionScore(context: GeoIntelligenceContext) {
    const coverage = this.analyzeCoverage(context);
    const occupancy = this.analyzeOccupancy(context);
    return this.regionScoreCalculator.calculateRegionScore({ coverage, occupancy });
  }

  detectGeoOpportunities(context: GeoIntelligenceContext) {
    const coverage = this.analyzeCoverage(context);
    const density = this.analyzeDensity(context);
    const occupancy = this.analyzeOccupancy(context);
    return this.opportunityDetector.detectGeoOpportunities({ coverage, density, occupancy });
  }

  detectGeoRisks(context: GeoIntelligenceContext) {
    const coverage = this.analyzeCoverage(context);
    const density = this.analyzeDensity(context);
    const occupancy = this.analyzeOccupancy(context);
    return this.riskDetector.detectGeoRisks({ coverage, density, occupancy });
  }

  buildGeoIntelligenceSnapshot(context: GeoIntelligenceContext): GeoIntelligenceResult {
    try {
      const coverage = this.analyzeCoverage(context);
      const density = this.analyzeDensity(context);
      const occupancy = this.analyzeOccupancy(context);
      const availability = this.analyzeAvailability(context);
      const regionScores = this.regionScoreCalculator.calculateRegionScore({ coverage, occupancy });
      const opportunities = this.opportunityDetector.detectGeoOpportunities({ coverage, density, occupancy });
      const risks = this.riskDetector.detectGeoRisks({ coverage, density, occupancy });

      const snapshot: GeoIntelligenceSnapshot = {
        coverage,
        density,
        occupancy,
        availability,
        regionScores,
        opportunities,
        risks,
        generatedAt: (context.now ?? new Date()).toISOString(),
        sourceProjectionId: context.snapshot.metadata.projectionId,
        sourceProjectionVersion: context.snapshot.metadata.version,
      };

      logger.info('[GeoIntelligence] Snapshot generated', {
        sourceProjectionId: snapshot.sourceProjectionId,
        sourceProjectionVersion: snapshot.sourceProjectionVersion,
        opportunities: opportunities.length,
        risks: risks.length,
      });

      if (coverage.status !== 'complete') {
        logger.warn('[GeoIntelligence] Insufficient territorial data', {
          status: coverage.status,
          missingCoordinateCount: coverage.missingCoordinateCount,
          uncoveredRegions: coverage.uncoveredRegionIds.length,
        });
      }

      risks
        .filter((risk) => risk.severity === 'critical' || risk.severity === 'high')
        .forEach((risk) => {
          logger.warn('[GeoIntelligence] High geo risk detected', {
            riskType: risk.type,
            severity: risk.severity,
            regionId: risk.regionId,
          });
        });

      this.emitRealtimeEvents(snapshot, context);

      return { ok: true, snapshot };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('[GeoIntelligence] Snapshot generation failed', { error: message });
      return { ok: false, error: message };
    }
  }

  private emitRealtimeEvents(snapshot: GeoIntelligenceSnapshot, context: GeoIntelligenceContext): void {
    const empresaId = context.snapshot.metadata.tenantId;
    const baseOptions = {
      empresaId,
      source: context.generatedBy ?? 'geo-intelligence',
      partial: false,
    };

    realtimeService.publishEvent('geo.coverage.updated', 'diagnostics', {
      coverage: snapshot.coverage,
    }, baseOptions);
    realtimeService.publishEvent('geo.density.updated', 'diagnostics', {
      density: snapshot.density,
    }, baseOptions);
    realtimeService.publishEvent('geo.snapshot.updated', 'diagnostics', {
      sourceProjectionId: snapshot.sourceProjectionId,
      sourceProjectionVersion: snapshot.sourceProjectionVersion,
      opportunities: snapshot.opportunities.length,
      risks: snapshot.risks.length,
    }, baseOptions);

    snapshot.opportunities.slice(0, 5).forEach((opportunity) => {
      realtimeService.publishEvent('geo.opportunity.detected', 'diagnostics', {
        opportunity,
      }, {
        ...baseOptions,
        regiaoId: opportunity.regionId,
        partial: true,
      });
    });

    snapshot.risks.slice(0, 5).forEach((risk) => {
      realtimeService.publishEvent('geo.risk.detected', 'diagnostics', {
        risk,
      }, {
        ...baseOptions,
        regiaoId: risk.regionId,
        partial: true,
      });
    });
  }
}

export const geoIntelligenceService = new GeoIntelligenceService();
