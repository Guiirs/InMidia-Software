import { mediaPipelineService } from '@modules/media';
import type { MediaAsset, MediaSource } from '@modules/media';
import type { PublicMediaAsset } from '../contracts/public-api.contracts';

function publicUrlFromSource(source: MediaSource): string | undefined {
  if (source.sourceType === 'remote-url' || source.sourceType === 'external-url') {
    return source.url ?? source.location ?? source.raw;
  }
  return undefined;
}

export class PublicMediaPresenter {
  static fromSource(sourceInput: unknown, assetId?: string): PublicMediaAsset | undefined {
    if (!sourceInput) return undefined;
    const asset = mediaPipelineService.buildMediaAsset(sourceInput, { assetId });
    return this.fromAsset(asset);
  }

  static fromAsset(asset: MediaAsset): PublicMediaAsset {
    const publicUrl = asset.storage.kind === 'external-url'
      ? asset.storage.url ?? asset.storage.publicUrl
      : publicUrlFromSource(asset.source);

    return {
      id: asset.id,
      status: asset.status,
      filename: asset.metadata.filename,
      mimeType: asset.metadata.mimeType,
      sourceType: asset.source.sourceType,
      url: publicUrl,
      variants: asset.variants.map((variant) => ({
        type: variant.type,
        url: variant.url,
        planned: variant.planned,
      })),
    };
  }
}
