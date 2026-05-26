export type MediaAssetStatus =
  | 'pending'
  | 'valid'
  | 'invalid'
  | 'processing'
  | 'processed'
  | 'failed'
  | 'archived'
  | 'unknown';

export type MediaSourceType = 'local-path' | 'remote-url' | 'external-url' | 'upload-file' | 'legacy-filename' | 'unknown';
export type MediaVariantType = 'original' | 'thumbnail' | 'preview' | 'optimized' | 'map-marker';
export type MediaStorageKind = 'local' | 'remote' | 'external-url' | 'unknown';
export type MediaValidationLevel = 'error' | 'warning';

export interface MediaSource {
  raw?: string;
  url?: string;
  path?: string;
  filename?: string;
  originalname?: string;
  mimetype?: string;
  size?: number;
  key?: string;
  location?: string;
  bucket?: string;
  sourceType: MediaSourceType;
}

export interface MediaMetadata {
  filename?: string;
  extension?: string;
  mimeType?: string;
  size?: number;
  width?: number;
  height?: number;
  sourceType: MediaSourceType;
  createdAt: string;
  updatedAt: string;
  hash?: string;
  partial: boolean;
}

export interface MediaVariant {
  type: MediaVariantType;
  path?: string;
  url?: string;
  planned: boolean;
  width?: number;
  height?: number;
  mimeType?: string;
}

export interface MediaStorageTarget {
  kind: MediaStorageKind;
  bucket?: string;
  key?: string;
  path?: string;
  url?: string;
  publicUrl?: string;
}

export interface MediaValidationIssue {
  code:
    | 'ASSET_MISSING'
    | 'INVALID_URL'
    | 'INVALID_LOCAL_PATH'
    | 'EXTENSION_NOT_ALLOWED'
    | 'MIME_TYPE_NOT_ALLOWED'
    | 'SIZE_TOO_LARGE'
    | 'DUPLICATE_ASSET'
    | 'UNSAFE_SOURCE'
    | 'INSUFFICIENT_METADATA';
  level: MediaValidationLevel;
  message: string;
  meta?: Record<string, unknown>;
}

export interface MediaValidationResult {
  ok: boolean;
  status: MediaAssetStatus;
  issues: MediaValidationIssue[];
}

export interface MediaAsset {
  id: string;
  source: MediaSource;
  metadata: MediaMetadata;
  variants: MediaVariant[];
  storage: MediaStorageTarget;
  status: MediaAssetStatus;
  warnings: MediaValidationIssue[];
  createdAt: string;
  updatedAt: string;
}

export interface MediaProcessingResult {
  ok: boolean;
  asset?: MediaAsset;
  status: MediaAssetStatus;
  warnings: MediaValidationIssue[];
  error?: string;
}

export interface MediaPipelineContext {
  assetId?: string;
  ownerType?: 'placa' | 'cliente' | 'checking' | 'unknown';
  ownerId?: string;
  empresaId?: string;
  now?: Date;
  knownAssetIds?: string[];
}

export interface MediaSummary {
  total: number;
  valid: number;
  invalid: number;
  processed: number;
  archived: number;
  unknown: number;
  warnings: number;
}
