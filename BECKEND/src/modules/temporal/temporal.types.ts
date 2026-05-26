export type TemporalSourceType = 'PI' | 'CONTRACT' | 'OPERATION' | 'MANUAL_BLOCK' | 'LEGACY_RENTAL';

export type TemporalReservationStatus =
  | 'RESERVED'
  | 'ACTIVE'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'BLOCKED';

export type PlateTemporalStatus =
  | 'AVAILABLE'
  | 'RESERVED_FUTURE'
  | 'CONTRACTED_ACTIVE'
  | 'EXPIRED_PENDING_RELEASE'
  | 'BLOCKED'
  | 'MAINTENANCE'
  | 'INSTALLATION_PENDING'
  | 'SCRAPING_PENDING';

export type TemporalEventType =
  | 'TEMPORAL_RESERVATION_CREATED'
  | 'TEMPORAL_RESERVATION_CONFLICT'
  | 'TEMPORAL_BACKFILL_STARTED'
  | 'TEMPORAL_BACKFILL_COMPLETED'
  | 'TEMPORAL_BACKFILL_CONFLICT'
  | 'TEMPORAL_RESERVATION_CANCELLED'
  | 'TEMPORAL_RESERVATION_EXPIRED'
  | 'TEMPORAL_CONTRACT_ACTIVATED'
  | 'TEMPORAL_CONTRACT_EXPIRED'
  | 'TEMPORAL_CONTRACT_ENDING_SOON'
  | 'TEMPORAL_EXPIRED_PENDING_RELEASE'
  | 'TEMPORAL_ORPHAN_RESERVATION_DETECTED'
  | 'TEMPORAL_INTEGRITY_ISSUE_DETECTED'
  | 'TEMPORAL_SCHEDULER_STARTED'
  | 'TEMPORAL_SCHEDULER_COMPLETED'
  | 'TEMPORAL_SCHEDULER_FAILED'
  | 'TEMPORAL_SCHEDULER_SKIPPED_ALREADY_RUNNING'
  | 'TEMPORAL_PLATE_LOCKED'
  | 'TEMPORAL_PLATE_RELEASED'
  | 'TEMPORAL_CRITICAL_UPDATE_BLOCKED';

export const TEMPORAL_BLOCKING_STATUSES: TemporalReservationStatus[] = [
  'RESERVED',
  'ACTIVE',
  'BLOCKED',
];

export const TEMPORAL_CRITICAL_PLATE_FIELDS = [
  'numero_placa',
  'numeroPlaca',
  'codigo',
  'nomeDaRua',
  'endereco',
  'localizacao',
  'coordenadas',
  'latitude',
  'longitude',
  'imagem',
  'imagemPrincipal',
  'regiaoId',
  'regiao',
  'loteRegional',
  'statusComercial',
  'disponivel',
  'ativa',
];

export interface TemporalConflict {
  plateId: string;
  message: string;
  conflictingReservation: {
    id: string;
    sourceType: TemporalSourceType;
    sourceId: string;
    status: TemporalReservationStatus;
    startDate: string;
    endDate: string;
    reason?: string;
  };
}

export interface TemporalAvailabilityResult {
  available: boolean;
  conflicts: TemporalConflict[];
}

export interface CreateTemporalReservationPayload {
  empresaId: string;
  plateId: string;
  sourceType: TemporalSourceType;
  sourceId: string;
  customerId?: string;
  startDate: Date | string;
  endDate: Date | string;
  status?: TemporalReservationStatus;
  reason?: string;
  createdBy?: string;
  allowSameSource?: boolean;
}
