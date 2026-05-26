import type { GeoPoint, GeoPointInput } from '@modules/spatial';

export type InventoryPhysicalStatus = 'active' | 'inactive' | 'maintenance' | 'removed' | 'unknown';
export type InventoryCommercialStatus = 'available' | 'reserved' | 'occupied' | 'unavailable' | 'unknown';
export type InventoryOperationalStatus = 'healthy' | 'attention' | 'conflict' | 'incomplete' | 'unknown';

export interface InventoryStatus {
  physical: InventoryPhysicalStatus;
  commercial: InventoryCommercialStatus;
  operational: InventoryOperationalStatus;
}

export interface InventoryAvailability {
  status: InventoryCommercialStatus;
  available: boolean | null;
  reason: string;
}

export interface InventoryOccupancy {
  occupied: boolean;
  reserved: boolean;
  activeSourceIds: string[];
  futureSourceIds: string[];
}

export type InventoryConflictSeverity = 'info' | 'warning' | 'critical';

export interface InventoryConflict {
  code:
    | 'AVAILABLE_WITH_ACTIVE_CONTRACT'
    | 'OCCUPIED_WITHOUT_OPERATIONAL_LINK'
    | 'INVALID_MAP_COORDINATES'
    | 'MISSING_OPERATIONAL_NUMBER'
    | 'DUPLICATED_OPERATIONAL_NUMBER';
  severity: InventoryConflictSeverity;
  message: string;
  placaId?: string;
  meta?: Record<string, unknown>;
}

export interface InventoryItem {
  placaId: string;
  empresaId?: string;
  regiaoId?: string;
  numeroPlaca?: string;
  numeroOperacional?: number;
  coordinates?: GeoPoint;
  status: InventoryStatus;
  availability: InventoryAvailability;
  occupancy: InventoryOccupancy;
  conflicts: InventoryConflict[];
}

export interface InventoryPeriodSource {
  id?: string;
  status?: string;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  placaId?: unknown;
}

export interface InventoryContractSource {
  id?: string;
  status?: string;
  placaIds?: unknown[];
}

export interface InventorySource {
  placa: {
    _id?: unknown;
    id?: unknown;
    empresaId?: unknown;
    regiaoId?: unknown;
    numero_placa?: string;
    numeroOperacional?: number | null;
    coordenadas?: GeoPointInput | null;
    disponivel?: boolean | null;
    ativa?: boolean | null;
    statusAluguel?: string | null;
    aluguel_ativo?: boolean | null;
    aluguel_futuro?: boolean | null;
  };
  alugueis?: InventoryPeriodSource[];
  contratos?: InventoryContractSource[];
  usedOnMap?: boolean;
}

export interface InventoryEvaluationContext {
  now?: Date;
  sources?: InventorySource[];
}

export interface InventoryEvaluationResult {
  item: InventoryItem;
  diagnostics: InventoryConflict[];
}

export interface InventorySummary {
  total: number;
  available: number;
  reserved: number;
  occupied: number;
  unavailable: number;
  unknown: number;
  healthy: number;
  attention: number;
  conflicts: number;
  incomplete: number;
  diagnostics: InventoryConflict[];
}
