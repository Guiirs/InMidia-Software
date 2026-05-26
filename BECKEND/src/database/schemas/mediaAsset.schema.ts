import { Schema } from 'mongoose';

export const MediaOwnerTypes = ['PLATE', 'OPERATION', 'REGION', 'CONTRACT', 'CAMPAIGN', 'SYSTEM'] as const;
export const MediaCategories = ['MAIN', 'INSTALLATION', 'SCRAPING', 'MAINTENANCE', 'BEFORE', 'AFTER', 'GENERATED', 'DOCUMENT', 'OTHER'] as const;
export const MediaStatuses = ['AVAILABLE', 'PROCESSING', 'MISSING', 'BROKEN', 'DELETE_PENDING', 'DELETED'] as const;
export const MediaSources = ['UPLOAD', 'GENERATED', 'IMPORTED'] as const;

export type MediaOwnerType = (typeof MediaOwnerTypes)[number];
export type MediaCategory = (typeof MediaCategories)[number];
export type MediaStatus = (typeof MediaStatuses)[number];
export type MediaSource = (typeof MediaSources)[number];

export interface IMediaAsset {
  empresaId: Schema.Types.ObjectId | string;
  ownerType: MediaOwnerType;
  ownerId: Schema.Types.ObjectId | string;
  category: MediaCategory;
  status: MediaStatus;
  r2Key: string;
  url?: string;
  publicUrl?: string;
  thumbnailUrl?: string;
  filename?: string;
  mimeType?: string;
  size?: number;
  width?: number;
  height?: number;
  hash?: string;
  isMain: boolean;
  source: MediaSource;
  metadata?: Record<string, unknown>;
  generatedBy?: string;
  templateId?: string;
  generationSource?: string;
  overlayData?: Record<string, unknown>;
  version: number;
  uploadedBy?: Schema.Types.ObjectId | string;
  uploadedAt?: Date;
  deletedAt?: Date;
  deletedBy?: Schema.Types.ObjectId | string;
}

export const mediaAssetSchema = new Schema<IMediaAsset>(
  {
    empresaId: { type: Schema.Types.ObjectId, ref: 'Empresa', required: true, index: true },
    ownerType: { type: String, enum: MediaOwnerTypes, required: true, index: true },
    ownerId: { type: Schema.Types.ObjectId, required: true, index: true },
    category: { type: String, enum: MediaCategories, default: 'OTHER', index: true },
    status: { type: String, enum: MediaStatuses, default: 'PROCESSING', index: true },
    r2Key: { type: String, required: true, trim: true },
    url: { type: String, trim: true },
    publicUrl: { type: String, trim: true },
    thumbnailUrl: { type: String, trim: true },
    filename: { type: String, trim: true },
    mimeType: { type: String, trim: true },
    size: { type: Number },
    width: { type: Number },
    height: { type: Number },
    hash: { type: String, trim: true, index: true },
    isMain: { type: Boolean, default: false, index: true },
    source: { type: String, enum: MediaSources, default: 'UPLOAD' },
    metadata: { type: Schema.Types.Mixed, default: {} },
    generatedBy: { type: String, trim: true },
    templateId: { type: String, trim: true },
    generationSource: { type: String, trim: true },
    overlayData: { type: Schema.Types.Mixed },
    version: { type: Number, default: 1 },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    uploadedAt: { type: Date, default: Date.now },
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete (ret as Record<string, unknown>).r2Key;
        return ret;
      },
    },
    toObject: { virtuals: true },
  },
);

mediaAssetSchema.index({ empresaId: 1, ownerType: 1, ownerId: 1, status: 1 });
mediaAssetSchema.index({ empresaId: 1, ownerType: 1, ownerId: 1, isMain: 1 });
mediaAssetSchema.index({ empresaId: 1, hash: 1, ownerType: 1, ownerId: 1 });
