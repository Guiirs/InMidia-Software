import type { Response } from 'express';
import type { ProjectionEvent, ProjectionSnapshot } from '@modules/projections';
import type { InventoryConflict, InventoryItem } from '@modules/inventory';
import type { GeoPoint } from '@modules/spatial';

export type RealtimeStreamName = 'inventory' | 'dashboard' | 'spatial' | 'diagnostics' | 'projections';
export type RealtimeEventType =
  | 'realtime.connected'
  | 'realtime.heartbeat'
  | 'inventory.updated'
  | 'dashboard.updated'
  | 'spatial.updated'
  | 'diagnostics.updated'
  | 'projection.updated'
  | 'projection.rebuilt'
  | 'placa.updated'
  | 'geo.coverage.updated'
  | 'geo.density.updated'
  | 'geo.opportunity.detected'
  | 'geo.risk.detected'
  | 'geo.snapshot.updated';

export interface RealtimeMetadata {
  eventId: string;
  stream: RealtimeStreamName;
  empresaId?: string;
  regiaoId?: string;
  source: string;
  occurredAt: string;
  receivedAt: string;
  correlationId?: string;
  version: number;
  partial: boolean;
}

export type RealtimePayload = Record<string, unknown>;

export interface RealtimeEvent<TPayload extends RealtimePayload = RealtimePayload> {
  type: RealtimeEventType;
  payload: TPayload;
  metadata: RealtimeMetadata;
}

export interface RealtimeStream {
  name: RealtimeStreamName;
  events: RealtimeEvent[];
  version: number;
  lastEventAt?: string;
  failures: number;
}

export interface RealtimeSubscriber {
  id: string;
  empresaId?: string;
  regiaoId?: string;
  channels: RealtimeStreamName[];
  connectedAt: string;
  lastEventId?: string;
  lastHeartbeatAt?: string;
  reconnects: number;
  response?: Response;
  send?: (event: RealtimeEvent) => boolean;
}

export interface RealtimeSnapshot {
  streams: Array<{
    name: RealtimeStreamName;
    version: number;
    eventCount: number;
    lastEventAt?: string;
    failures: number;
  }>;
  subscribers: {
    total: number;
    byEmpresa: Record<string, number>;
    byRegion: Record<string, number>;
  };
  generatedAt: string;
}

export interface RealtimeSyncState {
  lastSyncAt?: string;
  snapshotVersion: number;
  eventCount: number;
  localLatencyMs: number;
  activeSubscribers: number;
  activeStreams: RealtimeStreamName[];
  streamIntegrity: 'healthy' | 'degraded';
}

export interface ProjectionRealtimeUpdate extends RealtimePayload {
  projectionEvent: ProjectionEvent;
  snapshotVersion?: number;
  itemCount?: number;
}

export interface InventoryRealtimeUpdate extends RealtimePayload {
  items?: InventoryItem[];
  conflicts?: InventoryConflict[];
  changedIds?: string[];
}

export interface SpatialRealtimeUpdate extends RealtimePayload {
  points?: Array<{
    placaId: string;
    coordinates: GeoPoint;
  }>;
  invalidPointIds?: string[];
  changedIds?: string[];
}

export interface DashboardRealtimeUpdate extends RealtimePayload {
  totalPlacas?: number;
  available?: number;
  occupied?: number;
  conflicts?: number;
  incomplete?: number;
}

export interface RealtimeSubscribeOptions {
  empresaId?: string;
  regiaoId?: string;
  channels?: RealtimeStreamName[];
  lastEventId?: string;
  response?: Response;
  send?: (event: RealtimeEvent) => boolean;
}

export interface RealtimePublishOptions {
  empresaId?: string;
  regiaoId?: string;
  source?: string;
  correlationId?: string;
  partial?: boolean;
}

export interface ProjectionSnapshotRealtimePayload extends RealtimePayload {
  snapshot: ProjectionSnapshot;
}
