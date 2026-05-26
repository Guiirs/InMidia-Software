/**
 * regionUtils.js — Utilitários de negócio para Regiões V4.1
 *
 * Centraliza:
 * - isBoardWithoutRegion: detecta placas sem vínculo territorial formal
 * - getRegionStatusMeta: mapeia status técnico para label/className em pt-BR
 */

// ── isBoardWithoutRegion ─────────────────────────────────────────────────────
/**
 * Retorna `true` quando a placa/board não tem vínculo territorial formal.
 *
 * Considera como "sem região":
 * - Qualquer field ausente / null / string vazia
 * - Valor explícito "no-region"
 *
 * Campos verificados (cobertura total dos campos legado + V4):
 *   board.regionId, board.regiaoId, board.regiao, board.loteRegional, board.regionalLot
 *
 * @param {object} board
 * @returns {boolean}
 */
export function isBoardWithoutRegion(board) {
  const fields = [
    board?.regionId,
    board?.regiaoId,
    board?.regiao,
    board?.loteRegional,
    board?.regionalLot,
  ];

  return fields.every((v) => {
    if (v == null) return true;
    if (typeof v === 'object') {
      const id = v.id ?? v._id ?? v.codigo ?? v.code ?? null;
      return id == null || String(id).trim() === '' || String(id).trim() === 'no-region';
    }
    const value = String(v).trim();
    return value === '' || value === 'no-region';
  });
}

// ── getRegionStatusMeta ──────────────────────────────────────────────────────
const STATUS_MAP = {
  active:   { label: 'Ativa',      className: 'is-active' },
  inactive: { label: 'Inativa',    className: 'is-inactive' },
  archived: { label: 'Arquivada',  className: 'is-archived' },
};

const STATUS_UNKNOWN = { label: 'Indefinida', className: 'is-unknown' };

/**
 * Mapeia status técnico (qualquer case) para label pt-BR e className semântica.
 *
 * @param {string|undefined|null} status
 * @returns {{ label: string, className: string }}
 */
export function getRegionStatusMeta(status) {
  const key = String(status ?? '').trim().toLowerCase();
  return STATUS_MAP[key] ?? STATUS_UNKNOWN;
}
