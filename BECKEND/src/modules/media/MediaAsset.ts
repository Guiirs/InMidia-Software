import mongoose, { Model } from 'mongoose';
import { IMediaAsset, mediaAssetSchema } from '@database/schemas/mediaAsset.schema';

const MediaAsset: Model<IMediaAsset> = mongoose.models.MediaAsset
  || mongoose.model<IMediaAsset>('MediaAsset', mediaAssetSchema);

export default MediaAsset;
