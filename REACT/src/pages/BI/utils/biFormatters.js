/**
 * BI Visual Layer — formatting utilities.
 * Pure functions, no side-effects.
 */

/**
 * Format a number as a percentage string.
 * @param {number|null|undefined} value
 * @param {number} decimals
 */
export function formatPercent(value, decimals = 1) {
  if (value == null || Number.isNaN(value)) return '—';
  return `${Number(value).toFixed(decimals)}%`;
}

/**
 * Format a score (0–100) as a styled string.
 * @param {number|null|undefined} value
 */
export function formatScore(value) {
  if (value == null || Number.isNaN(value)) return '—';
  return Number(value).toFixed(0);
}

/**
 * Format a plain count.
 * @param {number|null|undefined} value
 */
export function formatCount(value) {
  if (value == null || Number.isNaN(value)) return '—';
  return Number(value).toLocaleString('pt-BR');
}

/**
 * Map availability string to display label.
 * @param {string|null|undefined} availability
 */
export function availabilityLabel(availability) {
  const map = {
    available: 'Disponível',
    reserved: 'Reservada',
    occupied: 'Ocupada',
    unavailable: 'Indisponível',
    unknown: 'Desconhecida',
  };
  return map[availability] ?? availability ?? '—';
}

/**
 * Map severity string to display label.
 * @param {string|null|undefined} severity
 */
export function severityLabel(severity) {
  const map = {
    low: 'Baixo',
    medium: 'Médio',
    high: 'Alto',
    critical: 'Crítico',
  };
  return map[severity] ?? severity ?? '—';
}

/**
 * Return a CSS color variable name for a severity level.
 * @param {string|null|undefined} severity
 */
export function severityColor(severity) {
  const map = {
    low: 'var(--color-success, #22c55e)',
    medium: 'var(--color-warning, #f59e0b)',
    high: 'var(--color-error, #ef4444)',
    critical: 'var(--color-critical, #7c3aed)',
  };
  return map[severity] ?? 'var(--color-muted, #94a3b8)';
}

/**
 * Extract metric value by key from a metrics array.
 * @param {Array} metrics
 * @param {string} key
 */
export function metricValue(metrics, key) {
  if (!Array.isArray(metrics)) return null;
  const m = metrics.find((item) => item.key === key);
  return m?.value ?? null;
}

/**
 * Format a date ISO string for display.
 * @param {string|null|undefined} iso
 */
export function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/**
 * Classify a score (0–100) as 'good', 'warning', or 'critical'.
 * @param {number|null|undefined} score
 */
export function scoreClass(score) {
  if (score == null) return 'unknown';
  if (score >= 80) return 'good';
  if (score >= 50) return 'warning';
  return 'critical';
}
