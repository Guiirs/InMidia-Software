import { Types } from 'mongoose';
import PlateMedia from './PlateMedia';
import type { IPlateMedia, PlateMediaSource } from '@database/schemas/plateMedia.schema';
import logger from '@shared/container/logger';

// ─── DTOs ──────────────────────────────────────────────────────────────────────

export interface SetActivePlateImageOptions {
  key: string;
  mimeType?: string | null;
  size?: number | null;
  width?: number | null;
  height?: number | null;
  source?: PlateMediaSource;
}

export interface PlateImageResolution {
  hasImage: boolean;
  activeKey: string | null;
  /** Timestamp ms como string — usado para cache-busting de URL (?v=). */
  version: string;
  mimeType: string | null;
  /** 'plate-media' quando resolvido pela fonte canônica; 'none' em fallback. */
  source: 'plate-media' | 'none';
}

// ─── Service ───────────────────────────────────────────────────────────────────

/**
 * PlateMediaService — fonte canônica da imagem principal de cada placa.
 *
 * Arquitetura:
 *   Upload → MediaAsset → setActivePlateImage (PlateMedia) → R2
 *   Proxy  → getPlateMedia (PlateMedia) → R2
 *
 * Todas as operações são silently resilient: nunca lançam exceção para o caller.
 * Falhas são logadas como warn e retornam o estado mais seguro possível.
 */
export class PlateMediaService {
  /**
   * Retorna o documento PlateMedia de uma placa, ou null se não existir.
   * Usado pelo proxy de imagem (caminho rápido antes do MongoDB).
   */
  async getPlateMedia(plateId: string, empresaId?: string): Promise<IPlateMedia | null> {
    try {
      if (!Types.ObjectId.isValid(plateId)) return null;
      const filter: Record<string, Types.ObjectId> = { plateId: new Types.ObjectId(plateId) };
      if (empresaId) {
        if (!Types.ObjectId.isValid(empresaId)) return null;
        filter.empresaId = new Types.ObjectId(empresaId);
      }
      return await PlateMedia.findOne(filter).lean();
    } catch (err) {
      logger.warn('[PlateMedia] getPlateMedia error', {
        plateId,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  /**
   * Define a imagem ativa de uma placa.
   * Cria o documento se ainda não existir (upsert).
   * Move a entrada anterior para history (isActive=false).
   * Mantém no máximo 50 entradas no history.
   */
  async setActivePlateImage(
    plateId: string,
    empresaId: string,
    options: SetActivePlateImageOptions,
  ): Promise<void> {
    try {
      if (!Types.ObjectId.isValid(plateId) || !Types.ObjectId.isValid(empresaId)) return;
      const plateObjectId = new Types.ObjectId(plateId);
      const empresaObjectId = new Types.ObjectId(empresaId);

      const version = String(Date.now());
      const historyEntry: IPlateMedia['history'][number] = {
        key: options.key,
        mimeType: options.mimeType ?? null,
        size: options.size ?? null,
        uploadedAt: new Date(),
        isActive: true,
        source: options.source ?? 'upload',
      };

      await PlateMedia.findOneAndUpdate(
        { plateId: plateObjectId, empresaId: empresaObjectId },
        {
          $set: {
            plateId:   plateObjectId,
            empresaId: empresaObjectId,
            activeKey: options.key,
            status:    'active',
            version,
            mimeType:  options.mimeType ?? null,
            size:      options.size ?? null,
            width:     options.width ?? null,
            height:    options.height ?? null,
          },
          $push: {
            history: {
              $each:     [historyEntry],
              $position: 0,
              $slice:    50,
            },
          },
        },
        { upsert: true, new: true },
      );

      logger.info('[PlateMedia] setActivePlateImage', { plateId, empresaId, source: options.source ?? 'upload' });
    } catch (err) {
      logger.warn('[PlateMedia] setActivePlateImage failed', {
        plateId,
        empresaId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Limpa a imagem ativa da placa (sem imagem principal).
   * Mantém o history intacto.
   */
  async clearActivePlateImage(plateId: string, empresaId: string): Promise<void> {
    try {
      if (!Types.ObjectId.isValid(plateId) || !Types.ObjectId.isValid(empresaId)) return;

      await PlateMedia.findOneAndUpdate(
        { plateId: new Types.ObjectId(plateId), empresaId: new Types.ObjectId(empresaId) },
        {
          $set: {
            activeKey: null,
            status:    'missing',
            version:   String(Date.now()),
          },
        },
        { upsert: false },
      );

      logger.info('[PlateMedia] clearActivePlateImage', { plateId, empresaId });
    } catch (err) {
      logger.warn('[PlateMedia] clearActivePlateImage failed', {
        plateId,
        empresaId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Resolve a imagem principal de uma placa via PlateMedia (fonte canônica exclusiva).
   */
  async resolvePlateMainImage(plateId: string, empresaId?: string): Promise<PlateImageResolution> {
    try {
      if (!Types.ObjectId.isValid(plateId)) {
        return { hasImage: false, activeKey: null, version: '', mimeType: null, source: 'none' };
      }
      const filter: Record<string, Types.ObjectId> = { plateId: new Types.ObjectId(plateId) };
      if (empresaId) {
        if (!Types.ObjectId.isValid(empresaId)) {
          return { hasImage: false, activeKey: null, version: '', mimeType: null, source: 'none' };
        }
        filter.empresaId = new Types.ObjectId(empresaId);
      }

      const pm = await PlateMedia.findOne(filter).lean();
      if (pm?.activeKey) {
        return {
          hasImage:  true,
          activeKey: pm.activeKey,
          version:   pm.version,
          mimeType:  pm.mimeType,
          source:    'plate-media',
        };
      }
    } catch (err) {
      logger.warn('[PlateMedia] resolvePlateMainImage error', {
        plateId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    return { hasImage: false, activeKey: null, version: '', mimeType: null, source: 'none' };
  }

  /**
   * Resolve em batch para listagens (uma query para N placas).
   * Retorna Map<plateId string → IPlateMedia>.
   */
  async batchResolvePlateMedia(plateIds: string[], empresaId?: string): Promise<Map<string, IPlateMedia>> {
    if (plateIds.length === 0) return new Map();
    try {
      const validIds = plateIds.filter(id => Types.ObjectId.isValid(id)).map(id => new Types.ObjectId(id));
      if (validIds.length === 0) return new Map();
      const filter: Record<string, unknown> = { plateId: { $in: validIds } };
      if (empresaId) {
        if (!Types.ObjectId.isValid(empresaId)) return new Map();
        filter.empresaId = new Types.ObjectId(empresaId);
      }

      const docs = await PlateMedia.find(filter).lean();
      return new Map(docs.map(doc => [String(doc.plateId), doc]));
    } catch (err) {
      logger.warn('[PlateMedia] batchResolvePlateMedia error', {
        error: err instanceof Error ? err.message : String(err),
      });
      return new Map();
    }
  }
}

export const plateMediaService = new PlateMediaService();
