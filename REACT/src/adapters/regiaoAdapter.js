/**
 * Adapter de Região.
 *
 * Converte respostas de /regioes para o contrato canônico RegiaoCanonica.
 */

/**
 * @param {unknown} raw
 * @returns {import('../contracts').RegiaoCanonica | null}
 */
export function normalizeRegiao(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const r = /** @type {any} */ (raw);

  const id = String(r.id ?? r._id ?? '');

  return {
    id,
    _id: r._id ? String(r._id) : id,
    nome: r.nome ?? '',
    codigo: r.codigo ?? undefined,
    ativo: typeof r.ativo === 'boolean' ? r.ativo : true,
  };
}

/**
 * Normaliza lista de regiões — aceita array ou payload paginado.
 * @param {unknown} payload
 * @returns {import('../contracts').RegiaoCanonica[]}
 */
export function normalizeRegioes(payload) {
  if (!payload) return [];

  const raw = /** @type {any} */ (payload);
  const list = Array.isArray(raw) ? raw : Array.isArray(raw.data) ? raw.data : [];

  return list.map(normalizeRegiao).filter(Boolean);
}
