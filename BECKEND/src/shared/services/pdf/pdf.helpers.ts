/**
 * PDF Service - Funções Auxiliares
 * Formatação de datas, valores e geração de ranges
 */

/**
 * Formata data para DD/MM/YYYY
 */
export function formatDate(date: any): string {
  if (!date) return 'N/A';
  const d = new Date(date);
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

/**
 * Formata data curta para DD/MM
 */
export function formatShortDate(date: any): string {
  if (!date) return '';
  const d = new Date(date);
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Formata valor monetário para R$ X.XXX,XX
 */
export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'R$ 0,00';
  return `R$ ${value.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

/**
 * Gera array de datas entre início e fim (máximo 31 dias)
 */
export function generateDateRange(dataInicio: string, dataFim: string): Date[] {
  const dates: Date[] = [];
  const timezone = process.env.TIMEZONE_OFFSET || '-03:00';
  const start = new Date(dataInicio + 'T00:00:00' + timezone);
  const end = new Date(dataFim + 'T00:00:00' + timezone);
  
  let current = new Date(start);
  while (current <= end && dates.length < 31) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}

/**
 * Verifica se há espaço suficiente na página
 */
export function hasEnoughSpace(currentY: number, requiredHeight: number, pageHeight: number, margin: number): boolean {
  return currentY + requiredHeight <= pageHeight - margin - 100;
}

/**
 * Monta endereço completo a partir de partes
 */
export function buildFullAddress(endereco?: string, bairro?: string, cidade?: string): string {
  return [endereco, bairro, cidade].filter(Boolean).join(', ') || 'N/A';
}

/**
 * Monta informações de contato (CNPJ + Telefone)
 */
export function buildContactInfo(cnpj?: string, telefone?: string): string {
  return `${cnpj || 'N/A'}\n${telefone || ''}`;
}
