/**
 * Converte uma string de env var para inteiro positivo, com fallback seguro
 * quando ausente, vazia, não numérica ou <= 0.
 */
export function parsePositiveInt(value: string | undefined, defaultValue: number): number {
  if (value === undefined || value === null || value.trim() === '') return defaultValue;
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return defaultValue;
  return parsed;
}
