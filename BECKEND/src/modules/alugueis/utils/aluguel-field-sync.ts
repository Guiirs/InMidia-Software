/**
 * Sincroniza os pares de campos novos (EN) <-> legados (PT) do Aluguel
 * para updates que nao disparam o hook pre('save') do schema
 * (findOneAndUpdate, updateMany, etc).
 *
 * Para cada par, se qualquer um dos dois lados estiver presente no input,
 * o resultado tera ambos os lados setados com o valor do campo canonico (novo).
 * Se apenas o campo legado vier, ele se torna o valor canonico para os dois.
 *
 * Pura e idempotente: aplicar duas vezes produz o mesmo resultado da primeira.
 */

const FIELD_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['startDate', 'data_inicio'],
  ['endDate', 'data_fim'],
  ['biWeekIds', 'bi_week_ids'],
];

export function syncAluguelFields<T extends Record<string, unknown>>(input: T): T {
  const result: Record<string, unknown> = { ...input };

  for (const [canonicalField, legacyField] of FIELD_PAIRS) {
    const hasCanonical = Object.prototype.hasOwnProperty.call(input, canonicalField)
      && input[canonicalField] !== undefined;
    const hasLegacy = Object.prototype.hasOwnProperty.call(input, legacyField)
      && input[legacyField] !== undefined;

    if (!hasCanonical && !hasLegacy) continue;

    const canonicalValue = hasCanonical ? input[canonicalField] : input[legacyField];

    result[canonicalField] = canonicalValue;
    result[legacyField] = canonicalValue;
  }

  return result as T;
}
