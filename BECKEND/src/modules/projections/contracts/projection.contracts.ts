import type { BoundingBox, GeoPoint } from '@modules/spatial';
import type {
  InventoryItem,
  InventorySource,
  InventorySummary,
} from '@modules/inventory';

export type ProjectionType = 'inventory' | 'spatial' | 'dashboard' | 'snapshot';
export type ProjectionEventType =
  | 'inventory.updated'
  | 'placa.updated'
  | 'spatial.updated'
  | 'projection.rebuilt'
  | 'dashboard.updated';

export interface ProjectionEvent {
  id: string;
  type: ProjectionEventType;
  projectionType: ProjectionType;
  tenantId?: string;
  occurredAt: string;
  source: string;
  correlationId?: string;
  payload?: Record<string, unknown>;
}

export interface ProjectionContext {
  tenantId?: string;
  source?: string;
  correlationId?: string;
  actorId?: string;
  now?: Date;
  partialSourceIds?: string[];
}

export interface ProjectionMetadata {
  projectionId: string;
  projectionType: ProjectionType;
  version: number;
  tenantId?: string;
  source: string;
  builtAt: string;
  durationMs: number;
  itemCount: number;
  partial: boolean;
  events: ProjectionEvent[];
}

export interface ProjectionBuildInput {
  inventorySources: InventorySource[];
}

export interface InventoryProjection {
  items: InventoryItem[];
  summary: InventorySummary;
}

export interface SpatialProjectionPoint {
  placaId: string;
  empresaId?: string;
  regiaoId?: string;
  numeroOperacional?: number;
  coordinates: GeoPoint;
}

export interface SpatialProjectionGroup {
  key: string;
  count: number;
  center: GeoPoint;
}

export interface SpatialProjection {
  points: SpatialProjectionPoint[];
  invalidPointIds: string[];
  boundingBox?: BoundingBox;
  groups: SpatialProjectionGroup[];
  status: 'ready' | 'partial' | 'empty';
}

export interface DashboardProjection {
  totalPlacas: number;
  available: number;
  reserved: number;
  occupied: number;
  unavailable: number;
  unknown: number;
  conflicts: number;
  incomplete: number;
  validMapPoints: number;
  invalidMapPoints: number;
  occupancyRate: number;
}

export interface ProjectionSnapshot {
  inventory: InventoryProjection;
  spatial: SpatialProjection;
  dashboard: DashboardProjection;
  metadata: ProjectionMetadata;
}

export interface ProjectionBuildResult<TProjection = ProjectionSnapshot> {
  ok: boolean;
  projection?: TProjection;
  metadata: ProjectionMetadata;
  events: ProjectionEvent[];
  error?: string;
}
