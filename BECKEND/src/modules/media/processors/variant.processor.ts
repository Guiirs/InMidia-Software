import path from 'path';
import type { MediaMetadata, MediaSource, MediaVariant } from '../contracts/media.contracts';

const VARIANT_SUFFIX: Record<MediaVariant['type'], string> = {
  original: 'original',
  thumbnail: 'thumb',
  preview: 'preview',
  optimized: 'optimized',
  'map-marker': 'marker',
};

export class MediaVariantProcessor {
  generateMediaVariants(source: MediaSource, metadata: MediaMetadata): MediaVariant[] {
    const filename = metadata.filename ?? source.filename ?? 'asset';
    const extension = metadata.extension || path.extname(filename) || '.jpg';
    const baseName = filename.replace(new RegExp(`${extension.replace('.', '\\.')}$`), '');
    const basePath = source.key ?? source.path ?? source.url ?? source.raw ?? filename;

    return (Object.keys(VARIANT_SUFFIX) as Array<MediaVariant['type']>).map((type) => {
      if (type === 'original') {
        return {
          type,
          path: source.path ?? source.key ?? source.raw,
          url: source.url ?? source.location,
          planned: false,
          mimeType: metadata.mimeType,
        };
      }

      return {
        type,
        path: `${path.dirname(basePath)}/${baseName}.${VARIANT_SUFFIX[type]}${extension}`.replace(/\\/g, '/'),
        planned: true,
        mimeType: metadata.mimeType,
      };
    });
  }
}
