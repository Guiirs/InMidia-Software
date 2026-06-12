/**
 * Commercial Projection V4.1 — Canonical commercial layer for plates.
 *
 * This is the single source of truth for the commercial state of a plate.
 * Plates are physical assets only; all commercial information comes from here.
 *
 * Status mapping from Temporal Engine:
 *   CONTRACTED_ACTIVE        ← CONTRACTED_ACTIVE
 *   RESERVED                 ← RESERVED_FUTURE + active PI reservation (sourceType=PI)
 *   FUTURE_RESERVED          ← RESERVED_FUTURE with only future reservations
 *   MAINTENANCE              ← BLOCKED | MAINTENANCE | INSTALLATION_PENDING | SCRAPING_PENDING
 *   UNKNOWN                  ← EXPIRED_PENDING_RELEASE or inconsistent state
 *   AVAILABLE                ← AVAILABLE
 */
export type CommercialStatus =
  | 'AVAILABLE'
  | 'RESERVED'
  | 'CONTRACTED_ACTIVE'
  | 'FUTURE_RESERVED'
  | 'MAINTENANCE'
  | 'UNKNOWN';

export interface CommercialProjectionActiveContract {
  /** TemporalReservation sourceId for the active/governing reservation */
  id: string;
  /** contract.numero (only when sourceType=CONTRACT) */
  contractCode?: string;
  clientId?: string;
  clientName?: string;
  startDate?: string;
  endDate?: string;
  /** piId linked from Contract */
  piId?: string;
  /** pi.pi_code */
  piCode?: string;
}

export interface CommercialProjectionReservation {
  /** True when there is an active (now-overlapping) blocking reservation */
  active: boolean;
  /** True when there is a future (not yet started) blocking reservation */
  future: boolean;
}

export interface CommercialProjectionPricing {
  /** Contract or PI total value (valorTotal) */
  contractValue?: number;
}

/**
 * Detalhes da operacao bloqueante ativa (sourceType=OPERATION) que impede
 * alocacao comercial da placa: instalacao, raspagem, manutencao ou bloqueio
 * operacional manual.
 */
export interface OperationalBlockInfo {
  blocked: true;
  reason: string;
  operationId: string;
  /** INSTALLATION | SCRAPING | MAINTENANCE | BLOCK | INSPECTION | OTHER */
  operationType: string;
  /** PENDING | SCHEDULED | IN_PROGRESS */
  operationStatus: string;
  status: string;
  /** Label localizado (pt-BR) — ex.: "Pendente de instalação" */
  label: string;
  /** Equipe/pessoa responsavel pela operacao (payload.assignedTo) */
  assignedTo?: string;
  /** Observacao opcional (payload.notes) */
  notes?: string;
  /** Equipe operacional vinculada a operacao (payload.teamSnapshot) */
  teamSnapshot?: {
    id: string;
    name: string;
    memberCount: number;
    members?: Array<{ name: string; role: string | null; phone: string | null }>;
  };
}

export interface CommercialProjection {
  placaId: string;
  empresaId: string;
  commercialStatus: CommercialStatus;
  activeContract?: CommercialProjectionActiveContract;
  reservation: CommercialProjectionReservation;
  pricing?: CommercialProjectionPricing;
  /** Presente quando ha uma operacao bloqueante ativa na placa */
  operationalBlock?: OperationalBlockInfo;
  /** ISO 8601 timestamp when this projection was resolved */
  resolvedAt: string;
}

/** DTO returned by the API endpoint */
export interface CommercialProjectionDTO {
  placaId: string;
  empresaId: string;
  commercialStatus: CommercialStatus;
  activeContract?: CommercialProjectionActiveContract;
  reservation: CommercialProjectionReservation;
  pricing?: CommercialProjectionPricing;
  operationalBlock?: OperationalBlockInfo;
  resolvedAt: string;
}
