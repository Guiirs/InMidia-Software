// src/utils/piStatusMeta.js
const STATUS_MAP = {
  DRAFT:              { label: 'Rascunho',              cssClass: 'draft' },
  PENDING_APPROVAL:   { label: 'Pendente de aprovação', cssClass: 'pending-approval' },
  APPROVED:           { label: 'Aprovada',              cssClass: 'approved' },
  REJECTED:           { label: 'Rejeitada',             cssClass: 'rejected' },
  CONTRACT_GENERATED: { label: 'Contrato gerado',       cssClass: 'contract-generated' },
  CANCELLED:          { label: 'Cancelada',             cssClass: 'cancelled' },
  // Legacy
  em_andamento:       { label: 'Em andamento',          cssClass: 'em-andamento' },
  concluida:          { label: 'Concluída',             cssClass: 'concluida' },
  vencida:            { label: 'Vencida',               cssClass: 'vencida' },
};

/**
 * Returns { label, cssClass } for a PI status string.
 * Falls back to the raw status if unknown.
 */
export function getPIStatusMeta(status) {
  return STATUS_MAP[status] || { label: status ?? '—', cssClass: 'unknown' };
}
