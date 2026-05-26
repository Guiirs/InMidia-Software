import crypto from 'crypto';
import path from 'path';
import type { MediaMetadata, MediaSource } from '../contracts/media.contracts';

function sourceValue(source: MediaSource): string | undefined {
  return source.filename ?? source.originalname ?? source.path ?? source.url ?? source.raw ?? source.key;
}

export class MediaMetadataExtractor {
  extractMediaMetadata(source: MediaSource, now = new Date()): MediaMetadata {
    const value = sourceValue(source);
    const filename = source.filename ?? source.originalname ?? (value ? path.basename(value.split('?')[0] || value) : undefined);
    const extension = filename ? path.extname(filename).toLowerCase() : undefined;
    const hashInput = source.key ?? source.url ?? source.path ?? source.raw ?? filename;

    return {
      filename,
      extension,
      mimeType: source.mimetype,
      size: source.size,
      sourceType: source.sourceType,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      hash: hashInput ? crypto.createHash('sha1').update(hashInput).digest('hex') : undefined,
      partial: !source.size || !source.mimetype,
    };
  }
}
