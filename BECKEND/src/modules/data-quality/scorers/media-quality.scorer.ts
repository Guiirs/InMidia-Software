import type { DataQualityContext } from '../contracts/data-quality.contracts';

export class MediaQualityScorer {
  score(context: DataQualityContext): number {
    const publicItems = context.publicInventory ?? [];
    const assets = context.mediaAssets ?? [];

    if (publicItems.length === 0 && assets.length === 0) return 100;

    const missingPublicMedia = publicItems.filter((item) => !item.media).length;
    const invalidAssets = assets.filter((asset) => asset.status === 'invalid' || asset.status === 'failed').length;
    const partialAssets = assets.filter((asset) => asset.metadata.partial).length;
    const total = Math.max(publicItems.length + assets.length, 1);

    return Math.max(0, Math.round(100 - ((missingPublicMedia + invalidAssets) / total) * 70 - (partialAssets / total) * 30));
  }
}
