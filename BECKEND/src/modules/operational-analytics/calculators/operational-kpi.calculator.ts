import type {
  AnalyticsAvailabilitySummary,
  AnalyticsGovernanceSummary,
  AnalyticsKPI,
  AnalyticsOccupancySummary,
  AnalyticsQualitySummary,
  AnalyticsSummary,
} from '../contracts/operational-analytics.contracts';

export class OperationalKPICalculator {
  calculate(input: {
    summary: AnalyticsSummary;
    occupancy: AnalyticsOccupancySummary;
    availability: AnalyticsAvailabilitySummary;
    quality: AnalyticsQualitySummary;
    governance: AnalyticsGovernanceSummary;
  }): AnalyticsKPI[] {
    const { summary, occupancy, availability, quality, governance } = input;

    return [
      { key: 'total-placas', label: 'Total de placas', value: summary.totalPlacas, unit: 'count', category: 'inventory', description: 'Quantidade total de placas projetadas.' },
      { key: 'placas-ativas', label: 'Placas ativas', value: summary.placasAtivas, unit: 'count', category: 'inventory', description: 'Quantidade de placas fisicamente ativas.' },
      { key: 'ocupacao', label: 'Ocupacao', value: occupancy.occupancyRate, unit: 'percent', category: 'occupancy', description: 'Percentual operacional ocupado no snapshot atual.' },
      { key: 'disponibilidade', label: 'Disponibilidade', value: availability.availabilityRate, unit: 'percent', category: 'availability', description: 'Percentual de disponibilidade comercial atual.' },
      { key: 'regioes-cobertas', label: 'Regioes cobertas', value: summary.coveredRegions, unit: 'count', category: 'territorial', description: 'Quantidade de regioes cobertas por pontos validos.' },
      { key: 'regioes-saturadas', label: 'Regioes saturadas', value: summary.saturatedRegions, unit: 'count', category: 'territorial', description: 'Regioes com ocupacao territorial elevada.' },
      { key: 'regioes-subutilizadas', label: 'Regioes subutilizadas', value: summary.underutilizedRegions, unit: 'count', category: 'territorial', description: 'Regioes com baixa ocupacao e disponibilidade ociosa.' },
      { key: 'qualidade-media', label: 'Qualidade media', value: quality.globalScore, unit: 'score', category: 'quality', description: 'Score global de qualidade operacional.' },
      { key: 'conflitos-operacionais', label: 'Quantidade de conflitos', value: quality.conflicts, unit: 'count', category: 'quality', description: 'Conflitos operacionais consolidados no inventario projetado.' },
      { key: 'qualidade-territorial', label: 'Qualidade territorial', value: quality.averageTerritorialQuality, unit: 'score', category: 'territorial', description: 'Media dos scores territoriais consolidados.' },
      { key: 'densidade-operacional', label: 'Densidade operacional', value: summary.operationalDensity, unit: 'score', category: 'territorial', description: 'Densidade operacional media por regiao coberta.' },
      { key: 'midia-valida-media', label: 'Media de midia valida', value: quality.mediaScore, unit: 'score', category: 'media', description: 'Score medio da disponibilidade/validade de midia.' },
      { key: 'governanca-media', label: 'Score medio de governanca', value: governance.averageScore, unit: 'score', category: 'governance', description: 'Score derivado das decisoes e violacoes de governanca.' },
    ];
  }
}