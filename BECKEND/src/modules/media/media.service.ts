import crypto from 'crypto';
import { Types } from 'mongoose';
import { safeDeleteFromR2, safeUploadBufferToR2 } from '@shared/infra/http/middlewares/upload.middleware';
import { Log } from '@shared/core';
import Placa from '@modules/placas/Placa';
import type { IMediaAsset, MediaCategory, MediaOwnerType } from '@database/schemas/mediaAsset.schema';
import { mediaRepository, MediaRepository } from './media.repository';
import { parseJsonLike, UploadMediaDTO, validateUploadFile } from './media.dto';

type PublicMediaAsset = Omit<IMediaAsset, 'r2Key'> & {
  _id?: unknown;
  id?: string;
  publicUrl?: string;
};

function objectId(id: string): Types.ObjectId {
  return new Types.ObjectId(id);
}

function extensionFromMime(mimeType: string): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

function publicUrlFromKey(r2Key: string): string {
  const base = (process.env.R2_PUBLIC_URL || process.env.VITE_R2_PUBLIC_URL || '').replace(/\/+$/, '');
  return base ? `${base}/${r2Key}` : r2Key;
}

function ownerPath(ownerType: MediaOwnerType, ownerId: string, category: MediaCategory, mediaId: string, extension: string): string {
  if (ownerType === 'PLATE') {
    const folder = category === 'MAIN' ? 'main' : category === 'GENERATED' ? 'generated' : 'history';
    return `plates/${ownerId}/${folder}/${mediaId}.${extension}`;
  }
  if (ownerType === 'OPERATION') return `operations/${ownerId}/${mediaId}.${extension}`;
  return `${ownerType.toLowerCase()}s/${ownerId}/${mediaId}.${extension}`;
}

function buildR2Key(empresaId: string, ownerType: MediaOwnerType, ownerId: string, category: MediaCategory, mediaId: string, extension: string): string {
  return `empresas/${empresaId}/${ownerPath(ownerType, ownerId, category, mediaId, extension)}`;
}

function stripPrivateFields(asset: any): PublicMediaAsset {
  const plain = typeof asset?.toObject === 'function' ? asset.toObject() : { ...asset };
  delete plain.r2Key;
  plain.id = String(plain._id ?? plain.id);
  return plain;
}

function toPlateImageDoc(asset: any) {
  return {
    _id: asset._id,
    id: String(asset._id),
    url: asset.publicUrl || asset.url,
    key: asset.publicUrl || asset.url,
    filename: asset.filename,
    mimeType: asset.mimeType,
    size: asset.size,
    category: asset.category,
    isMain: Boolean(asset.isMain),
    source: asset.source,
    uploadedBy: asset.uploadedBy,
    uploadedAt: asset.uploadedAt,
    updatedAt: new Date(),
    generatedBy: asset.generatedBy,
    templateId: asset.templateId,
    generationSource: asset.generationSource,
    overlayData: asset.overlayData,
    version: asset.version,
  };
}

export class MediaService {
  constructor(private readonly repository: MediaRepository = mediaRepository) {}

  async uploadMedia(file: Express.Multer.File, dto: UploadMediaDTO, empresaId: string, userId?: string): Promise<PublicMediaAsset> {
    validateUploadFile(file);
    if (!file.buffer) throw new Error('Upload invalido: arquivo sem buffer para envio centralizado ao R2.');

    const mediaId = new Types.ObjectId();
    const category = dto.category;
    const isMain = dto.setAsMain || category === 'MAIN';
    const extension = extensionFromMime(file.mimetype);
    const r2Key = buildR2Key(empresaId, dto.ownerType, dto.ownerId, category, String(mediaId), extension);
    const hash = crypto.createHash('sha256').update(file.buffer).digest('hex');

    await safeUploadBufferToR2(file.buffer, r2Key, file.mimetype);

    const publicUrl = publicUrlFromKey(r2Key);
    const asset = await this.repository.create({
      _id: mediaId,
      empresaId: objectId(empresaId) as any,
      ownerType: dto.ownerType,
      ownerId: objectId(dto.ownerId) as any,
      category,
      status: 'AVAILABLE',
      r2Key,
      url: publicUrl,
      publicUrl,
      filename: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      hash,
      isMain,
      source: dto.source,
      metadata: parseJsonLike(dto.metadata) ?? {},
      generatedBy: dto.generatedBy,
      templateId: dto.templateId,
      generationSource: dto.generationSource,
      overlayData: parseJsonLike(dto.overlayData),
      version: dto.version,
      uploadedBy: userId ? objectId(userId) as any : undefined,
      uploadedAt: new Date(),
    } as Partial<IMediaAsset> as IMediaAsset);

    if (isMain) {
      await this.replaceMain(asset, Boolean(dto.preservePreviousMain), userId);
    }

    if (dto.ownerType === 'PLATE') {
      await this.syncPlateMedia(asset);
    }

    Log.info('[MediaService] MEDIA_UPLOADED', { mediaId: String(asset._id), ownerType: dto.ownerType, ownerId: dto.ownerId, empresaId });
    return stripPrivateFields(asset);
  }

  async getMedia(id: string, empresaId: string): Promise<PublicMediaAsset | null> {
    const asset = await this.repository.findById(id, empresaId);
    return asset ? stripPrivateFields(asset) : null;
  }

  async getByOwner(ownerType: MediaOwnerType, ownerId: string, empresaId: string): Promise<PublicMediaAsset[]> {
    const assets = await this.repository.findByOwner(empresaId, ownerType, ownerId);
    return assets.map(stripPrivateFields);
  }

  async setMain(mediaId: string, empresaId: string, userId?: string): Promise<PublicMediaAsset> {
    const asset = await this.repository.findDocumentById(mediaId, empresaId);
    if (!asset) throw new Error('Midia nao encontrada.');
    if (asset.status !== 'AVAILABLE') throw new Error('Midia indisponivel para principal.');

    asset.isMain = true;
    asset.category = 'MAIN';
    await asset.save();
    await this.replaceMain(asset, true, userId);
    if (asset.ownerType === 'PLATE') await this.syncPlateMedia(asset);

    Log.info('[MediaService] MEDIA_MAIN_CHANGED', { mediaId, empresaId });
    return stripPrivateFields(asset);
  }

  async deleteMedia(mediaId: string, empresaId: string, userId?: string): Promise<PublicMediaAsset> {
    const asset = await this.repository.findDocumentById(mediaId, empresaId);
    if (!asset) throw new Error('Midia nao encontrada.');

    try {
      await safeDeleteFromR2(asset.r2Key);
      asset.status = 'DELETED';
      asset.deletedAt = new Date();
      if (userId) asset.deletedBy = objectId(userId) as any;
      Log.info('[MediaService] MEDIA_DELETED', { mediaId, empresaId });
    } catch {
      asset.status = 'DELETE_PENDING';
      Log.warn('[MediaService] MEDIA_DELETE_PENDING', { mediaId, empresaId });
    }
    asset.isMain = false;
    await asset.save();
    if (asset.ownerType === 'PLATE') await this.removePlateMedia(asset);
    return stripPrivateFields(asset);
  }

  async cleanupDeletePendingMedia(limit = 100): Promise<Record<string, unknown>> {
    const assets = await this.repository.findDeletePending(limit);
    const report = { scanned: assets.length, deleted: 0, failed: 0, skippedMain: 0, errors: [] as string[] };
    for (const asset of assets) {
      if (asset.isMain) {
        report.skippedMain += 1;
        continue;
      }
      try {
        await safeDeleteFromR2(asset.r2Key);
        await this.repository.updateOne({ _id: asset._id }, { $set: { status: 'DELETED', deletedAt: new Date() } });
        report.deleted += 1;
      } catch (error) {
        report.failed += 1;
        report.errors.push(error instanceof Error ? error.message : String(error));
      }
    }
    return report;
  }

  async findOrphanMediaAssets(limit = 100): Promise<Record<string, unknown>> {
    const assets = await this.repository.findOrphans(limit);
    return { scanned: assets.length, assets: assets.map(stripPrivateFields) };
  }

  private async replaceMain(asset: any, preservePrevious: boolean, userId?: string): Promise<void> {
    const previous = await this.repository.findMain(String(asset.empresaId), asset.ownerType, String(asset.ownerId));
    await this.repository.updateMany({
      empresaId: asset.empresaId,
      ownerType: asset.ownerType,
      ownerId: asset.ownerId,
      _id: { $ne: asset._id },
    }, { $set: { isMain: false } });

    if (!previous || String(previous._id) === String(asset._id) || preservePrevious) return;

    try {
      await safeDeleteFromR2(previous.r2Key);
      await this.repository.updateOne({ _id: previous._id }, {
        $set: { status: 'DELETED', deletedAt: new Date(), isMain: false, ...(userId ? { deletedBy: objectId(userId) } : {}) },
      });
      if (asset.ownerType === 'PLATE') await this.removePlateMedia(previous);
      Log.info('[MediaService] MEDIA_REPLACED', { oldMediaId: String(previous._id), newMediaId: String(asset._id) });
    } catch {
      await this.repository.updateOne({ _id: previous._id }, { $set: { status: 'DELETE_PENDING', isMain: false } });
      if (asset.ownerType === 'PLATE') await this.removePlateMedia(previous);
      Log.warn('[MediaService] MEDIA_DELETE_PENDING', { mediaId: String(previous._id) });
    }
  }

  private async syncPlateMedia(asset: any): Promise<void> {
    const imageDoc = toPlateImageDoc(asset);
    if (asset.isMain) {
      await Placa.updateOne({ _id: asset.ownerId, empresaId: asset.empresaId }, { $set: { 'imagens.$[].isMain': false } });
    }
    await Placa.updateOne(
      { _id: asset.ownerId, empresaId: asset.empresaId, 'imagens.id': { $ne: String(asset._id) } },
      { $push: { imagens: imageDoc } },
    );
    if (asset.isMain) {
      await Placa.updateOne(
        { _id: asset.ownerId, empresaId: asset.empresaId },
        {
          $set: {
            imagemPrincipal: asset.publicUrl || asset.url,
            imagem: asset.publicUrl || asset.url,
            'imagens.$[img].isMain': true,
          },
        },
        { arrayFilters: [{ 'img.id': String(asset._id) }] },
      );
    }
  }

  private async removePlateMedia(asset: any): Promise<void> {
    const plate = await Placa.findOne({ _id: asset.ownerId, empresaId: asset.empresaId }).lean();
    if (!plate) return;
    const remaining = ((plate as any).imagens ?? []).filter((image: any) => String(image.id) !== String(asset._id) && String(image._id) !== String(asset._id));
    const fallbackMain = remaining.find((image: any) => image.isMain) ?? remaining[0] ?? null;
    await Placa.updateOne(
      { _id: asset.ownerId, empresaId: asset.empresaId },
      { $set: { imagens: remaining, imagemPrincipal: fallbackMain?.url ?? null, imagem: fallbackMain?.url ?? null } },
    );
  }
}

export const mediaService = new MediaService();
