import type { EnterpriseBIContext, EnterpriseBIDataset, EnterpriseBIMetric, EnterpriseBIRecord, EnterpriseBIExportProfile, EnterpriseBIGrain, EnterpriseBIVisibility } from '../contracts/enterprise-bi.contracts';

function metric(key: string, label: string, value: number, unit: EnterpriseBIMetric['unit'], category: EnterpriseBIMetric['category'], grain: EnterpriseBIGrain, meta?: Record<string, unknown>): EnterpriseBIMetric {
  return { key, label, value, unit, category, grain, meta };
}

function buildDataset(
  context: EnterpriseBIContext,
  input: {
    id: string;
    name: string;
    description: string;
    grain: EnterpriseBIGrain;
    profile: EnterpriseBIExportProfile;
    visibility: EnterpriseBIVisibility;
    rows: EnterpriseBIRecord[];
    metrics: EnterpriseBIMetric[];
  },
): EnterpriseBIDataset {
  return {
    id: input.id,
    name: input.name,
    description: input.description,
    grain: input.grain,
    profile: input.profile,
    visibility: input.visibility,
    generatedAt: (context.now ?? new Date()).toISOString(),
    rowCount: input.rows.length,
    metrics: input.metrics,
    rows: input.rows,
    filtersApplied: context.grain ? [{ field: 'grain', operator: 'eq', value: context.grain }] : [],
    completeness: input.rows.length > 0 ? 'complete' : 'partial',
    source: {
      operationalAnalyticsSnapshotId: context.operationalAnalyticsSnapshot.id,
      projectionSnapshotId: context.projectionSnapshot.metadata.projectionId,
      geoSnapshotId: context.geoSnapshot?.sourceProjectionId,
      qualitySnapshotId: context.qualitySnapshot?.sourceProjectionId,
      governanceSnapshotId: context.governanceSnapshot?.sourceProjectionId,
    },
  };
}

function buildPeriod(context: EnterpriseBIContext): { start?: string; end?: string } {
  const current = (context.now ?? new Date()).toISOString();
  return context.period ?? { start: current, end: current };
}

function baseRecord(context: EnterpriseBIContext, grain: EnterpriseBIGrain, profile: EnterpriseBIExportProfile, label: string, id: string): EnterpriseBIRecord {
  return {
    id,
    grain,
    profile,
    visibility: context.visibility ?? 'internal',
    label,
    tenantId: context.tenantId ?? context.operationalAnalyticsSnapshot.tenantId,
    empresaId: context.empresaId,
    regiaoId: context.regiaoId,
    period: buildPeriod(context),
    metrics: [],
  };
}

export class EnterpriseBIDatasetFactory {
  buildExecutiveDataset(context: EnterpriseBIContext): EnterpriseBIDataset {
    const snapshot = context.operationalAnalyticsSnapshot;
    const row = baseRecord(context, 'global', 'executive-summary', 'Executive summary', `executive:${snapshot.id}`);
    row.metrics = [
      metric('executive.total-placas', 'Total de placas', snapshot.summary.totalPlacas, 'count', 'executive', 'global'),
      metric('executive.occupancy-rate', 'Ocupacao', snapshot.summary.occupancyRate, 'percent', 'executive', 'global'),
      metric('executive.availability-rate', 'Disponibilidade', snapshot.summary.availabilityRate, 'percent', 'executive', 'global'),
      metric('executive.quality', 'Qualidade media', snapshot.quality.globalScore, 'score', 'executive', 'global'),
      metric('executive.governance', 'Governanca media', snapshot.governance.averageScore, 'score', 'executive', 'global'),
    ];

    return buildDataset(context, {
      id: 'executive',
      name: 'Executivo',
      description: 'Visao executiva consolidada do ecossistema Inmidia.',
      grain: 'global',
      profile: 'executive-summary',
      visibility: 'executive',
      rows: [row],
      metrics: row.metrics,
    });
  }

  buildRegionalDataset(context: EnterpriseBIContext): EnterpriseBIDataset {
    const rows = context.operationalAnalyticsSnapshot.regions.map((region) => {
      const row = baseRecord(context, 'regiao', 'regional-performance', `Regiao ${region.regionId}`, `regional:${region.regionId}`);
      row.regiaoId = region.regionId;
      row.empresaId = region.empresaId;
      row.status = region.coverageStatus;
      row.availability = region.available > 0 ? 'available' : 'unavailable';
      row.occupancyRate = region.occupancyRate;
      row.qualityScore = region.qualityScore;
      row.governanceScore = region.governanceScore;
      row.severity = region.saturated ? 'high' : region.underutilized ? 'medium' : 'low';
      row.metrics = [
        metric('regional.total-placas', 'Total de placas', region.totalPlacas, 'count', 'geo', 'regiao'),
        metric('regional.occupancy-rate', 'Ocupacao', region.occupancyRate, 'percent', 'occupancy', 'regiao'),
        metric('regional.availability-rate', 'Disponibilidade', region.availabilityRate, 'percent', 'availability', 'regiao'),
        metric('regional.quality', 'Qualidade', region.qualityScore, 'score', 'quality', 'regiao'),
      ];
      return row;
    });

    return buildDataset(context, {
      id: 'regional',
      name: 'Regional',
      description: 'Analise regional executiva por cobertura, ocupacao e qualidade.',
      grain: 'regiao',
      profile: 'regional-performance',
      visibility: 'internal',
      rows,
      metrics: rows.flatMap((row) => row.metrics),
    });
  }

  buildInventoryDataset(context: EnterpriseBIContext): EnterpriseBIDataset {
    const rows = context.projectionSnapshot.inventory.items.map((item) => {
      const row = baseRecord(context, 'placa', 'inventory-health', `Placa ${item.numeroPlaca ?? item.placaId}`, `inventory:${item.placaId}`);
      row.placaId = item.placaId;
      row.empresaId = item.empresaId;
      row.regiaoId = item.regiaoId;
      row.status = item.status.operational;
      row.availability = item.availability.status;
      row.occupancyRate = item.availability.status === 'occupied' ? 100 : item.availability.status === 'available' ? 0 : 50;
      row.qualityScore = item.status.operational === 'healthy' ? 100 : item.status.operational === 'attention' ? 80 : item.status.operational === 'conflict' ? 50 : 60;
      row.severity = item.conflicts.some((conflict) => conflict.severity === 'critical') ? 'critical' : item.conflicts.length > 0 ? 'high' : 'low';
      row.mediaValid = item.status.operational !== 'incomplete';
      row.metrics = [
        metric('inventory.conflicts', 'Conflitos', item.conflicts.length, 'count', 'inventory', 'placa'),
        metric('inventory.quality', 'Qualidade', row.qualityScore, 'score', 'quality', 'placa'),
      ];
      return row;
    });

    return buildDataset(context, {
      id: 'inventory',
      name: 'Inventario',
      description: 'Leitura detalhada do inventario com foco em saude operacional.',
      grain: 'placa',
      profile: 'inventory-health',
      visibility: 'internal',
      rows,
      metrics: rows.flatMap((row) => row.metrics),
    });
  }

  buildQualityDataset(context: EnterpriseBIContext): EnterpriseBIDataset {
    const rows: EnterpriseBIRecord[] = [];

    rows.push({
      ...baseRecord(context, 'global', 'quality-report', 'Qualidade global', 'quality:global'),
      qualityScore: context.operationalAnalyticsSnapshot.quality.globalScore,
      severity: context.operationalAnalyticsSnapshot.quality.degraded ? 'high' : 'low',
      metrics: [metric('quality.global', 'Score global', context.operationalAnalyticsSnapshot.quality.globalScore, 'score', 'quality', 'global')],
    });

    context.operationalAnalyticsSnapshot.regions.forEach((region) => {
      rows.push({
        ...baseRecord(context, 'regiao', 'quality-report', `Qualidade ${region.regionId}`, `quality:${region.regionId}`),
        regiaoId: region.regionId,
        qualityScore: region.qualityScore,
        severity: region.qualityScore >= 80 ? 'low' : region.qualityScore >= 60 ? 'medium' : 'high',
        metrics: [metric('quality.score', 'Score de qualidade', region.qualityScore, 'score', 'quality', 'regiao')],
      });
    });

    return buildDataset(context, {
      id: 'quality',
      name: 'Qualidade',
      description: 'Qualidade executiva e territorial consolidada.',
      grain: 'regiao',
      profile: 'quality-report',
      visibility: 'restricted',
      rows,
      metrics: rows.flatMap((row) => row.metrics),
    });
  }

  buildGovernanceDataset(context: EnterpriseBIContext): EnterpriseBIDataset {
    const rows: EnterpriseBIRecord[] = [];
    const governance = context.governanceSnapshot;

    if (governance) {
      rows.push({
        ...baseRecord(context, 'global', 'governance-report', 'Governanca global', `governance:${governance.generatedAt}`),
        governanceScore: context.operationalAnalyticsSnapshot.governance.averageScore,
        severity: governance.summary.highestSeverity ?? 'low',
        status: governance.summary.decision,
        metrics: [
          metric('governance.score', 'Score de governanca', context.operationalAnalyticsSnapshot.governance.averageScore, 'score', 'governance', 'global'),
          metric('governance.violations', 'Violacoes', governance.summary.totalViolations, 'count', 'governance', 'global'),
        ],
      });
    }

    context.operationalAnalyticsSnapshot.regions.forEach((region) => {
      rows.push({
        ...baseRecord(context, 'regiao', 'governance-report', `Governanca ${region.regionId}`, `governance:${region.regionId}`),
        regiaoId: region.regionId,
        governanceScore: region.governanceScore,
        severity: region.governanceScore >= 80 ? 'low' : 'medium',
        metrics: [metric('governance.region-score', 'Score regional', region.governanceScore, 'score', 'governance', 'regiao')],
      });
    });

    return buildDataset(context, {
      id: 'governance',
      name: 'Governanca',
      description: 'Leitura de governanca e risco operacional para BI interno.',
      grain: 'regiao',
      profile: 'governance-report',
      visibility: 'restricted',
      rows,
      metrics: rows.flatMap((row) => row.metrics),
    });
  }

  buildAvailabilityDataset(context: EnterpriseBIContext): EnterpriseBIDataset {
    const rows: EnterpriseBIRecord[] = context.operationalAnalyticsSnapshot.regions.map((region) => ({
      ...baseRecord(context, 'regiao', 'regional-performance', `Disponibilidade ${region.regionId}`, `availability:${region.regionId}`),
      regiaoId: region.regionId,
      availability: (region.available > 0 ? 'available' : 'unavailable') as EnterpriseBIRecord['availability'],
      occupancyRate: region.occupancyRate,
      qualityScore: region.qualityScore,
      metrics: [
        metric('availability.available', 'Disponiveis', region.available, 'count', 'availability', 'regiao'),
        metric('availability.rate', 'Taxa de disponibilidade', region.availabilityRate, 'percent', 'availability', 'regiao'),
      ],
    }));

    return buildDataset(context, {
      id: 'availability',
      name: 'Disponibilidade',
      description: 'Disponibilidade comercial e territorial consolidada.',
      grain: 'regiao',
      profile: 'regional-performance',
      visibility: 'internal',
      rows,
      metrics: rows.flatMap((row) => row.metrics),
    });
  }

  buildOccupancyDataset(context: EnterpriseBIContext): EnterpriseBIDataset {
    const rows: EnterpriseBIRecord[] = context.operationalAnalyticsSnapshot.regions.map((region) => ({
      ...baseRecord(context, 'regiao', 'regional-performance', `Ocupacao ${region.regionId}`, `occupancy:${region.regionId}`),
      regiaoId: region.regionId,
      occupancyRate: region.occupancyRate,
      availability: (region.available > 0 ? 'available' : 'unavailable') as EnterpriseBIRecord['availability'],
      severity: (region.saturated ? 'high' : region.underutilized ? 'medium' : 'low') as EnterpriseBIRecord['severity'],
      metrics: [
        metric('occupancy.rate', 'Taxa de ocupacao', region.occupancyRate, 'percent', 'occupancy', 'regiao'),
        metric('occupancy.total', 'Total de placas', region.totalPlacas, 'count', 'occupancy', 'regiao'),
      ],
    }));

    return buildDataset(context, {
      id: 'occupancy',
      name: 'Ocupacao',
      description: 'Ocupacao territorial e operacional por regiao.',
      grain: 'regiao',
      profile: 'regional-performance',
      visibility: 'internal',
      rows,
      metrics: rows.flatMap((row) => row.metrics),
    });
  }

  buildMediaDataset(context: EnterpriseBIContext): EnterpriseBIDataset {
    const rows = context.projectionSnapshot.inventory.items.map((item) => {
      const row = baseRecord(context, 'placa', 'inventory-health', `Midia ${item.numeroPlaca ?? item.placaId}`, `media:${item.placaId}`);
      row.placaId = item.placaId;
      row.empresaId = item.empresaId;
      row.regiaoId = item.regiaoId;
      row.mediaValid = item.status.operational !== 'incomplete' && item.coordinates !== undefined;
      row.severity = row.mediaValid ? 'low' : 'medium';
      row.metrics = [metric('media.valid', 'Midia valida', row.mediaValid ? 1 : 0, 'count', 'media', 'placa')];
      return row;
    });

    return buildDataset(context, {
      id: 'media',
      name: 'Midia',
      description: 'Leitura de validade e saude de midia sem expor detalhes privados.',
      grain: 'placa',
      profile: 'inventory-health',
      visibility: 'restricted',
      rows,
      metrics: rows.flatMap((row) => row.metrics),
    });
  }

  buildGeoIntelligenceDataset(context: EnterpriseBIContext): EnterpriseBIDataset {
    const rows: EnterpriseBIRecord[] = [];
    const geo = context.geoSnapshot;

    if (geo) {
      rows.push({
        ...baseRecord(context, 'global', 'regional-performance', 'Geo coverage', `geo:${geo.sourceProjectionId}`),
        severity: (geo.coverage.status === 'complete' ? 'low' : 'medium') as EnterpriseBIRecord['severity'],
        qualityScore: geo.coverage.coveragePercent,
        metrics: [
          metric('geo.coverage', 'Cobertura territorial', geo.coverage.coveragePercent, 'percent', 'geo', 'global'),
          metric('geo.risks', 'Riscos geograficos', geo.risks.length, 'count', 'geo', 'global'),
        ],
      });
    }

    return buildDataset(context, {
      id: 'geo',
      name: 'Geo Intelligence',
      description: 'Leitura executiva dos sinais geograficos e riscos territoriais.',
      grain: 'global',
      profile: 'regional-performance',
      visibility: 'internal',
      rows,
      metrics: rows.flatMap((row) => row.metrics),
    });
  }

  buildCompleteDatasets(context: EnterpriseBIContext): EnterpriseBIDataset[] {
    return [
      this.buildExecutiveDataset(context),
      this.buildRegionalDataset(context),
      this.buildInventoryDataset(context),
      this.buildAvailabilityDataset(context),
      this.buildOccupancyDataset(context),
      this.buildQualityDataset(context),
      this.buildGovernanceDataset(context),
      this.buildMediaDataset(context),
      this.buildGeoIntelligenceDataset(context),
    ];
  }
}
