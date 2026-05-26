import type {
  ExportProfileSpec,
  ExportProfile,
} from '../contracts/export.contracts';

export const EXPORT_PROFILE_SPECS: Record<ExportProfile, ExportProfileSpec> = {
  'executive-summary': {
    profile: 'executive-summary',
    label: 'Resumo Executivo',
    description: 'Indicadores consolidados de desempenho operacional para visão executiva.',
    availableFormats: ['json', 'csv'],
    plannedFormats: ['pdf', 'xlsx'],
    visibility: 'executive',
  },
  'regional-performance': {
    profile: 'regional-performance',
    label: 'Desempenho Regional',
    description: 'KPIs por região: ocupação, qualidade, governança e disponibilidade.',
    availableFormats: ['json', 'csv'],
    plannedFormats: ['pdf', 'xlsx'],
    visibility: 'executive',
  },
  'inventory-health': {
    profile: 'inventory-health',
    label: 'Saúde do Inventário',
    description: 'Status de ativos, disponibilidade e conflitos do inventário.',
    availableFormats: ['json', 'csv'],
    plannedFormats: ['pdf', 'xlsx'],
    visibility: 'internal',
  },
  'quality-report': {
    profile: 'quality-report',
    label: 'Relatório de Qualidade',
    description: 'Scores de qualidade de dados por região e severidade.',
    availableFormats: ['json', 'csv'],
    plannedFormats: ['pdf', 'xlsx'],
    visibility: 'internal',
  },
  'governance-report': {
    profile: 'governance-report',
    label: 'Relatório de Governança',
    description: 'Scores de governança e decisões por região.',
    availableFormats: ['json', 'csv'],
    plannedFormats: ['pdf', 'xlsx'],
    visibility: 'restricted',
  },
};

/**
 * Returns all profile specs as an ordered array.
 */
export function getAllExportProfileSpecs(): ExportProfileSpec[] {
  return Object.values(EXPORT_PROFILE_SPECS);
}

/**
 * Returns the spec for a given profile, or undefined if not found.
 */
export function getExportProfileSpec(profile: string): ExportProfileSpec | undefined {
  return EXPORT_PROFILE_SPECS[profile as ExportProfile];
}
