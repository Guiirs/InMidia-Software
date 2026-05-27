import type { GeoPoint } from '@modules/spatial';
import type { MediaAssetStatus } from '@modules/media';
import type {
  InventoryCommercialStatus,
  InventoryOperationalStatus,
  InventoryPhysicalStatus,
} from '@modules/inventory';

/**
 * Public API scopes — controls what a partner's API key can access.
 *
 * Naming convention: resource:action
 * - inventory:read          list boards with status/location
 * - inventory:availability  availability summary per board
 * - media:read              board photo/media assets
 * - geo:read                coordinates and map data
 * - catalog:read            combined inventory + geo snapshot
 * - analytics:read          aggregated metrics (reserved — not yet active)
 * - export:inventory        bulk CSV/JSON export (reserved — not yet active)
 * - diagnostics:read        internal health counters (super-admin only)
 */
export type PublicApiScope =
  | 'inventory:read'
  | 'inventory:availability'
  | 'media:read'
  | 'geo:read'
  | 'catalog:read'
  | 'analytics:read'
  | 'export:inventory'
  | 'diagnostics:read';

/** Scopes granted to all partners by default on API key creation. */
export const PUBLIC_API_DEFAULT_SCOPES: PublicApiScope[] = [
  'inventory:read',
  'inventory:availability',
  'media:read',
  'geo:read',
  'catalog:read',
];

/** Reserved scopes — must be explicitly granted by super-admin. */
export const PUBLIC_API_RESTRICTED_SCOPES: PublicApiScope[] = [
  'analytics:read',
  'export:inventory',
  'diagnostics:read',
];

export interface PublicApiKey {
  id: string;
  keyHash?: string;
  keyPrefix?: string;
  partnerId: string;
  empresaId: string;
  scopes: PublicApiScope[];
  active: boolean;
  createdAt: string;
  expiresAt?: string;
  lastUsedAt?: string;
  rateLimit?: {
    requests: number;
    windowMs: number;
  };
}

export interface PublicApiPartner {
  id: string;
  name: string;
  empresaId: string;
  active: boolean;
  scopes: PublicApiScope[];
}

export interface PublicGeoPoint extends GeoPoint {
  precision: 'exact' | 'approximate' | 'unknown';
}

export interface PublicAvailability {
  status: InventoryCommercialStatus;
  available: boolean | null;
  reason: string;
}

export interface PublicMediaAsset {
  id: string;
  status: MediaAssetStatus;
  filename?: string;
  mimeType?: string;
  sourceType?: string;
  url?: string;
  variants: Array<{
    type: string;
    url?: string;
    planned: boolean;
  }>;
}

export interface PublicInventoryItem {
  id: string;
  boardNumber?: string;
  operationalNumber?: number;
  region?: {
    id?: string;
    name?: string;
  };
  location?: {
    street?: string;
    geo?: PublicGeoPoint;
  };
  size?: string;
  availability: PublicAvailability;
  status: {
    physical: InventoryPhysicalStatus;
    commercial: InventoryCommercialStatus;
    operational: InventoryOperationalStatus;
  };
  media?: PublicMediaAsset;
}

export interface PublicApiError {
  code:
    | 'PUBLIC_API_KEY_MISSING'
    | 'PUBLIC_API_KEY_INVALID'
    | 'PUBLIC_API_KEY_INACTIVE'
    | 'PUBLIC_API_SCOPE_FORBIDDEN'
    | 'PUBLIC_API_TENANT_FORBIDDEN'
    | 'PUBLIC_API_PAYLOAD_TOO_LARGE'
    | 'PUBLIC_API_NOT_FOUND'
    | 'PUBLIC_API_INTERNAL_ERROR';
  message: string;
  status: number;
}

export interface PublicApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: PublicApiError['code'];
    message: string;
  };
  meta: {
    requestId: string;
    version: 'v1';
    timestamp: string;
    count?: number;
  };
}

export interface PublicApiUsageLog {
  partnerId?: string;
  empresaId?: string;
  scopes: PublicApiScope[];
  endpoint: string;
  method: string;
  status: number;
  timestamp: string;
  errorCode?: PublicApiError['code'];
  itemCount?: number;
  requestId: string;
}

export interface PublicApiAuthContext {
  key: PublicApiKey;
  partner: PublicApiPartner;
  requestId: string;
}

export interface PublicApiQueryOptions {
  limit?: number;
  regionId?: string;
}
