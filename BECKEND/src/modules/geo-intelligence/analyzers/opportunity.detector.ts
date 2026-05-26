import type {
  GeoCoverageSummary,
  GeoDensityResult,
  GeoOccupancyInsight,
  GeoOpportunity,
} from '../contracts/geo-intelligence.contracts';

export class OpportunityDetector {
  detectGeoOpportunities(input: {
    coverage: GeoCoverageSummary;
    density: GeoDensityResult;
    occupancy: GeoOccupancyInsight[];
  }): GeoOpportunity[] {
    const opportunities: GeoOpportunity[] = [];

    input.occupancy.forEach((region) => {
      if (region.available >= 5 || region.availabilityRate >= 60) {
        opportunities.push({
          id: `sales-${region.regionId}`,
          type: 'sales',
          regionId: region.regionId,
          title: 'Regiao com alta disponibilidade comercial',
          reason: 'Ha volume relevante de placas disponiveis para acao comercial.',
          score: Math.min(100, region.availabilityRate),
          meta: { available: region.available },
        });
      }

      if (region.saturated && region.available <= 1) {
        opportunities.push({
          id: `expansion-${region.regionId}`,
          type: 'expansion',
          regionId: region.regionId,
          title: 'Regiao saturada com baixa disponibilidade',
          reason: 'Alta ocupacao e pouca disponibilidade indicam possivel demanda por expansao.',
          score: region.occupancyRate,
        });
      }

      if (region.incomplete > 0) {
        opportunities.push({
          id: `data-quality-${region.regionId}`,
          type: 'data-quality',
          regionId: region.regionId,
          title: 'Melhoria de dados territoriais',
          reason: 'Placas incompletas reduzem confiabilidade de mapa e inventario.',
          score: Math.min(100, region.incomplete * 20),
          meta: { incomplete: region.incomplete },
        });
      }

      if (region.conflicts > 0) {
        opportunities.push({
          id: `ops-${region.regionId}`,
          type: 'operational-review',
          regionId: region.regionId,
          title: 'Revisao operacional territorial',
          reason: 'Conflitos operacionais recorrentes exigem verificacao regional.',
          score: Math.min(100, region.conflicts * 25),
          meta: { conflicts: region.conflicts },
        });
      }
    });

    input.coverage.uncoveredRegionIds.forEach((regionId) => {
      opportunities.push({
        id: `coverage-${regionId}`,
        type: 'expansion',
        regionId,
        title: 'Regiao sem cobertura cadastrada',
        reason: 'Regiao conhecida nao possui pontos validos projetados.',
        score: 70,
      });
    });

    input.density.lowConcentrationRegionIds.forEach((regionId) => {
      opportunities.push({
        id: `low-density-${regionId}`,
        type: 'expansion',
        regionId,
        title: 'Baixa concentracao territorial',
        reason: 'Densidade relativa abaixo da media das regioes atuais.',
        score: 55,
      });
    });

    return opportunities.sort((a, b) => b.score - a.score);
  }
}
