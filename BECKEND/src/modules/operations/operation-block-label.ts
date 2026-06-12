/**
 * Labels (pt-BR) para o status de bloqueio operacional de uma placa,
 * derivados do tipo e status canonicos de uma operacao (OperationRecord).
 *
 * Reutilizado por temporal.service.ts (resolvePlateTemporalStatus) e
 * commercial-projection.service.ts (enriquecimento de operationalBlock).
 */

const IN_PROGRESS_LABELS: Record<string, string> = {
  INSTALLATION: 'Instalação em andamento',
  SCRAPING: 'Raspagem em andamento',
  MAINTENANCE: 'Manutenção em andamento',
  BLOCK: 'Bloqueio operacional',
  BLOCKING: 'Bloqueio operacional',
  CRITICAL: 'Operação crítica em andamento',
  CLEANING: 'Limpeza em andamento',
  INSPECTION: 'Inspeção em andamento',
  REMOVAL: 'Remoção em andamento',
  OTHER: 'Operação em andamento',
};

const PENDING_LABELS: Record<string, string> = {
  INSTALLATION: 'Pendente de instalação',
  SCRAPING: 'Raspagem pendente',
  MAINTENANCE: 'Manutenção pendente',
  BLOCK: 'Bloqueio operacional',
  BLOCKING: 'Bloqueio operacional',
  CRITICAL: 'Operação crítica pendente',
  CLEANING: 'Limpeza pendente',
  INSPECTION: 'Inspeção pendente',
  REMOVAL: 'Remoção pendente',
  OTHER: 'Operação pendente',
};

const DEFAULT_LABEL = 'Operação em andamento';

export function resolveOperationBlockLabel(operationType: string, operationStatus: string): string {
  const type = String(operationType ?? '').toUpperCase();
  const status = String(operationStatus ?? '').toUpperCase();

  if (status === 'IN_PROGRESS') {
    return IN_PROGRESS_LABELS[type] ?? DEFAULT_LABEL;
  }

  return PENDING_LABELS[type] ?? DEFAULT_LABEL;
}
