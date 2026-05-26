import type { FilterQuery, UpdateQuery } from 'mongoose';
import MediaAsset from './MediaAsset';
import type { IMediaAsset } from '@database/schemas/mediaAsset.schema';

export class MediaRepository {
  create(data: Partial<IMediaAsset>): Promise<any> {
    return MediaAsset.create(data);
  }

  findById(id: string, empresaId: string): Promise<any> {
    return MediaAsset.findOne({ _id: id, empresaId }).lean();
  }

  findDocumentById(id: string, empresaId: string): Promise<any> {
    return MediaAsset.findOne({ _id: id, empresaId });
  }

  findByOwner(empresaId: string, ownerType: string, ownerId: string): Promise<any[]> {
    return MediaAsset.find({
      empresaId,
      ownerType,
      ownerId,
      status: { $ne: 'DELETED' },
    })
      .sort({ isMain: -1, uploadedAt: -1, createdAt: -1 })
      .lean();
  }

  findMain(empresaId: string, ownerType: string, ownerId: string): Promise<any> {
    return MediaAsset.findOne({
      empresaId,
      ownerType,
      ownerId,
      isMain: true,
      status: { $ne: 'DELETED' },
    }).lean();
  }

  updateMany(filter: FilterQuery<IMediaAsset>, update: UpdateQuery<IMediaAsset>): Promise<any> {
    return MediaAsset.updateMany(filter, update);
  }

  updateOne(filter: FilterQuery<IMediaAsset>, update: UpdateQuery<IMediaAsset>): Promise<any> {
    return MediaAsset.updateOne(filter, update);
  }

  findDeletePending(limit = 100): Promise<any[]> {
    return MediaAsset.find({ status: 'DELETE_PENDING' }).limit(limit).lean();
  }

  findOrphans(limit = 100): Promise<any[]> {
    return MediaAsset.find({
      ownerType: { $in: ['OPERATION', 'REGION', 'CONTRACT', 'CAMPAIGN', 'SYSTEM'] },
      status: { $nin: ['DELETED', 'DELETE_PENDING'] },
      isMain: { $ne: true },
    }).limit(limit).lean();
  }
}

export const mediaRepository = new MediaRepository();
