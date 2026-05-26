import crypto from 'crypto';
import logger from '@shared/container/logger';
import { MediaMetadataExtractor } from '../processors/metadata.extractor';
import { MediaVariantProcessor } from '../processors/variant.processor';
import { MediaStorageTargetResolver } from '../stores/media-store.target';
import { MediaValidator } from '../validators/media.validator';
import type {
  MediaAsset,
  MediaAssetStatus,
  MediaPipelineContext,
  MediaProcessingResult,
  MediaSource,
  MediaSummary,
} from '../contracts/media.contracts';

function inferSourceType(input: unknown): MediaSource['sourceType'] {
  if (!input) return 'unknown';
  if (typeof input === 'object' && input !== null && ('mimetype' in input || 'originalname' in input || 'key' in input)) {
    return 'upload-file';
  }
  if (typeof input === 'string') {
    if (/^https?:\/\//i.test(input)) return 'external-url';
    if (input.includes('/') || input.includes('\\')) return 'local-path';
    return 'legacy-filename';
  }
  return 'unknown';
}

export class MediaPipelineService {
  constructor(
    private readonly validator = new MediaValidator(),
    private readonly metadataExtractor = new MediaMetadataExtractor(),
    private readonly variantProcessor = new MediaVariantProcessor(),
    private readonly storageResolver = new MediaStorageTargetResolver(),
  ) {}

  normalizeMediaSource(input: unknown): MediaSource {
    if (typeof input === 'string') {
      const sourceType = inferSourceType(input);
      return {
        raw: input,
        url: sourceType === 'external-url' ? input : undefined,
        path: sourceType === 'local-path' ? input : undefined,
        filename: sourceType === 'legacy-filename' ? input : undefined,
        sourceType,
      };
    }

    if (input && typeof input === 'object') {
      const data = input as Record<string, unknown>;
      const explicitSourceType = typeof data.sourceType === 'string' ? data.sourceType as MediaSource['sourceType'] : undefined;
      const sourceType = explicitSourceType ?? inferSourceType(input);
      return {
        raw: typeof data.raw === 'string' ? data.raw : undefined,
        url: typeof data.url === 'string' ? data.url : typeof data.location === 'string' ? data.location : undefined,
        path: typeof data.path === 'string' ? data.path : undefined,
        filename: typeof data.filename === 'string' ? data.filename : undefined,
        originalname: typeof data.originalname === 'string' ? data.originalname : undefined,
        mimetype: typeof data.mimetype === 'string' ? data.mimetype : undefined,
        size: typeof data.size === 'number' ? data.size : undefined,
        key: typeof data.key === 'string' ? data.key : undefined,
        location: typeof data.location === 'string' ? data.location : undefined,
        bucket: typeof data.bucket === 'string' ? data.bucket : undefined,
        sourceType,
      };
    }

    return { sourceType: 'unknown' };
  }

  validateMediaAsset(source: MediaSource, context: MediaPipelineContext = {}) {
    return this.validator.validateMediaAsset(source, context.knownAssetIds);
  }

  extractMediaMetadata(source: MediaSource, context: MediaPipelineContext = {}) {
    return this.metadataExtractor.extractMediaMetadata(source, context.now ?? new Date());
  }

  generateMediaVariants(source: MediaSource, context: MediaPipelineContext = {}) {
    const metadata = this.extractMediaMetadata(source, context);
    return this.variantProcessor.generateMediaVariants(source, metadata);
  }

  buildMediaAsset(input: unknown, context: MediaPipelineContext = {}): MediaAsset {
    const source = this.normalizeMediaSource(input);
    const validation = this.validateMediaAsset(source, context);
    const metadata = this.extractMediaMetadata(source, context);
    const variants = this.variantProcessor.generateMediaVariants(source, metadata);
    const storage = this.storageResolver.resolve(source);
    const now = (context.now ?? new Date()).toISOString();
    const idSeed = context.assetId ?? source.key ?? source.url ?? source.path ?? source.filename ?? source.raw ?? crypto.randomUUID();

    return {
      id: crypto.createHash('sha1').update(String(idSeed)).digest('hex'),
      source,
      metadata,
      variants,
      storage,
      status: validation.status,
      warnings: validation.issues,
      createdAt: now,
      updatedAt: now,
    };
  }

  processMediaAsset(input: unknown, context: MediaPipelineContext = {}): MediaProcessingResult {
    try {
      const asset = this.buildMediaAsset(input, context);
      const hasError = asset.warnings.some((issue) => issue.level === 'error');
      const nextStatus: MediaAssetStatus = hasError ? 'invalid' : asset.status === 'unknown' ? 'unknown' : 'processed';
      const processed = { ...asset, status: nextStatus, updatedAt: (context.now ?? new Date()).toISOString() };

      if (hasError) {
        logger.warn('[MediaPipeline] Invalid media asset detected', {
          ownerType: context.ownerType,
          ownerId: context.ownerId,
          issues: asset.warnings.map((issue) => issue.code),
        });
      } else if (asset.metadata.partial) {
        logger.warn('[MediaPipeline] Partial media metadata extracted', {
          ownerType: context.ownerType,
          ownerId: context.ownerId,
          assetId: asset.id,
        });
      } else {
        logger.info('[MediaPipeline] Media asset processed', {
          ownerType: context.ownerType,
          ownerId: context.ownerId,
          assetId: asset.id,
          variants: asset.variants.length,
        });
      }

      return {
        ok: !hasError,
        asset: processed,
        status: processed.status,
        warnings: processed.warnings,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('[MediaPipeline] Media processing failed', {
        ownerType: context.ownerType,
        ownerId: context.ownerId,
        error: message,
      });

      return { ok: false, status: 'failed', warnings: [], error: message };
    }
  }

  archiveMediaAsset(asset: MediaAsset, context: MediaPipelineContext = {}): MediaAsset {
    const archived = {
      ...asset,
      status: 'archived' as const,
      updatedAt: (context.now ?? new Date()).toISOString(),
    };

    logger.info('[MediaPipeline] Media asset archived', {
      ownerType: context.ownerType,
      ownerId: context.ownerId,
      assetId: archived.id,
    });

    return archived;
  }

  buildMediaSummary(assets: MediaAsset[]): MediaSummary {
    return assets.reduce<MediaSummary>((summary, asset) => {
      summary.total += 1;
      if (asset.status === 'valid') summary.valid += 1;
      if (asset.status === 'invalid') summary.invalid += 1;
      if (asset.status === 'processed') summary.processed += 1;
      if (asset.status === 'archived') summary.archived += 1;
      if (asset.status === 'unknown') summary.unknown += 1;
      summary.warnings += asset.warnings.length;
      return summary;
    }, {
      total: 0,
      valid: 0,
      invalid: 0,
      processed: 0,
      archived: 0,
      unknown: 0,
      warnings: 0,
    });
  }
}

export const mediaPipelineService = new MediaPipelineService();
