/**
 * Period Service - Utility Functions
 * Funções auxiliares para manipulação de períodos
 */

import { PeriodType, NormalizedPeriod } from './period.types';

/**
 * Verifica se dois períodos se sobrepõem
 */
export function periodsOverlap(period1: NormalizedPeriod, period2: NormalizedPeriod): boolean {
  if (!period1.startDate || !period1.endDate || !period2.startDate || !period2.endDate) {
    return false;
  }

  const start1 = new Date(period1.startDate);
  const end1 = new Date(period1.endDate);
  const start2 = new Date(period2.startDate);
  const end2 = new Date(period2.endDate);

  return start1 < end2 && start2 < end1;
}

/**
 * Calcula duração de um período em dias
 */
export function calculateDurationInDays(startDate: Date | string, endDate: Date | string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end.getTime() - start.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1; // +1 para incluir o último dia
}

/**
 * Formata data para DD/MM/YYYY
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return 'N/A';
  const d = new Date(date);
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Converte período do formato antigo para o novo
 */
export function convertOldFormatToNew(oldFormat: any): NormalizedPeriod | null {
  if (!oldFormat) return null;

  const hasBiWeeks = (oldFormat.bi_week_ids && oldFormat.bi_week_ids.length > 0) ||
                     (oldFormat.bi_weeks && oldFormat.bi_weeks.length > 0);

  return {
    periodType: hasBiWeeks ? PeriodType.BI_WEEK : PeriodType.CUSTOM,
    startDate: oldFormat.data_inicio || oldFormat.startDate,
    endDate: oldFormat.data_fim || oldFormat.endDate,
    biWeekIds: oldFormat.bi_week_ids || oldFormat.biWeekIds || [],
    biWeeks: oldFormat.bi_weeks || oldFormat.biWeeks || []
  };
}
