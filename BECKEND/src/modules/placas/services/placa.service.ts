/**
 * Placa Service
 * Camada de lógica de negócios com Result Pattern
 */

import { Result, DomainError } from '@shared/core';
import {
  PlacaNotFoundError,
  BusinessRuleViolationError,
  ValidationError,
  NotFoundError,
  toDomainError
} from '@shared/core';
import { Log } from '@shared/core';
import { safeDeleteFromR2 } from '@shared/infra/http/middlewares/upload.middleware';
import { extractR2Key } from '@shared/infra/storage/r2-key.helper';
import Aluguel from '@modules/alugueis/Aluguel';
import Regiao from '@modules/regioes/Regiao';
import { commercialProjectionService } from '@modules/commercial-projection/commercial-projection.service';
import { inventoryService } from '@modules/inventory';
import { projectionService } from '@modules/projections';
import { mediaPipelineService } from '@modules/media';
import { mediaService } from '@modules/media/media.service';
import { plateMediaService } from '@modules/media/plate-media.service';
import { temporalEngine } from '@modules/temporal';
import { commercialAvailabilityProjection } from '@modules/commercial-availability';
import type { IPlacaRepository } from '../repositories/placa.repository';
import { resolvePlateHealth } from '../utils/plate-health.utils';
import { mapCommercialStatusToLegacyStatusComercial } from '../utils/commercial-status.utils';
import {
  validateCreatePlaca,
  validateUpdatePlaca,
  validateListQuery,
  validateReorderPlacas,
  validatePlacaImage,
  validateUploadPlateImage,
  validateArchivePlaca,
  toListItems,
  type PlacaEntity,
  type PaginatedPlacasResponse,
  type ReorderPlacasDTO,
  type PlateHealthResult,
} from '../dtos/placa.dto';
import type { PlateImageCategory } from '@database/schemas/placa.schema';

interface S3File {
  key: string;
  location: string;
  bucket: string;
  mimetype: string;
  originalname: string;
  size: number;
  buffer?: Buffer;
}

function storageKeyFromFile(file: S3File): string {
  const raw = (file.key || file.location || '').trim();
  return raw ? (extractR2Key(raw) ?? '') : '';
}

async function safeDeleteStoredImage(plateId: string, empresaId: string): Promise<void> {
  const pm = await plateMediaService.getPlateMedia(plateId, empresaId);
  const key = pm?.activeKey;
  if (!key) return;
  try { await safeDeleteFromR2(key); } catch { /* non-critical */ }
}

const BLOCKING_COMMERCIAL_STATUSES: readonly string[] = [
  'CONTRACTED_ACTIVE',
  'RESERVED',
  'FUTURE_RESERVED',
  'UNKNOWN',
];

function validationErrorFromZod(error: unknown): ValidationError {
  const issues = Array.isArray((error as any)?.issues) ? (error as any).issues : [];
  const first = issues[0];
  const field = Array.isArray(first?.path) && first.path.length > 0 ? String(first.path[0]) : 'data';
  const message = typeof first?.message === 'string' ? first.message : 'Dados de entrada invalidos';
  return new ValidationError([{ field, message }], message);
}

export class PlacaService {
  constructor(private readonly repository: IPlacaRepository) {}

  // ──────────────────────────────────────────────────────────────────────────
  // CRUD
  // ──────────────────────────────────────────────────────────────────────────

  async createPlaca(
    data: unknown,
    file: S3File | undefined,
    empresaId: string,
    userId?: string,
  ): Promise<Result<PlacaEntity, DomainError>> {
    try {
      const validatedData = validateCreatePlaca(data);

      if (validatedData.numeroOperacional === undefined) {
        const nextNumberResult = await this.repository.getNextOperationalNumber(empresaId);
        if (nextNumberResult.isFailure) return Result.fail(nextNumberResult.error);
        (validatedData as any).numeroOperacional = nextNumberResult.value;
      }

      // Validar região
      const regiaoExists = await Regiao.findOne({
        _id: validatedData.regiaoId,
        empresaId,
        status: { $ne: 'ARCHIVED' },
      }).lean();

      if (!regiaoExists) {
        return Result.fail(new NotFoundError('Região', validatedData.regiaoId));
      }

      // Processar imagem
      if (file) {
        const mediaResult = mediaPipelineService.processMediaAsset(file, { ownerType: 'placa', empresaId });
        if (mediaResult.warnings.length > 0) {
          Log.warn('[PlacaService] Diagnósticos de media no upload', { empresaId, warnings: mediaResult.warnings.map((w) => w.code) });
        }
        validatePlacaImage({ mimetype: file.mimetype, size: file.size, filename: file.originalname });
      }

      const result = await this.repository.create(validatedData, empresaId, userId);
      if (result.isFailure) return Result.fail(result.error);
      let createdPlate = result.value;

      if (file?.buffer) {
        await mediaService.uploadMedia(file as any, {
          ownerType: 'PLATE',
          ownerId: String(result.value._id),
          category: 'MAIN',
          source: 'UPLOAD',
          setAsMain: true,
          preservePreviousMain: false,
          version: 1,
        }, empresaId, userId);

        const refreshed = await this.repository.findById(String(result.value._id), empresaId);
        if (refreshed.isSuccess && refreshed.value) createdPlate = refreshed.value;
      }

      // Registrar evento temporal
      await temporalEngine.recordEvent({
        empresaId,
        plateId: String(createdPlate._id),
        eventType: 'TEMPORAL_PLATE_RELEASED',
        message: `Placa ${createdPlate.numero_placa} cadastrada no sistema.`,
        metadata: { action: 'PLATE_CREATED', userId },
        createdBy: userId,
      });

      Log.info('[PlacaService] Placa criada', { placaId: createdPlate._id, empresaId });
      return Result.ok(createdPlate);
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        return Result.fail(validationErrorFromZod(error));
      }
      const domainError = toDomainError(error);
      Log.error('[PlacaService] Erro ao criar placa', { error: domainError.message, empresaId });
      return Result.fail(domainError);
    }
  }

  async updatePlaca(
    id: string,
    data: unknown,
    file: S3File | undefined,
    empresaId: string,
    userId?: string,
  ): Promise<Result<PlacaEntity, DomainError>> {
    try {
      const validatedData = validateUpdatePlaca(data);

      const existsResult = await this.repository.findById(id, empresaId);
      if (existsResult.isFailure) return Result.fail(existsResult.error);
      const placaExistente = existsResult.value;
      if (!placaExistente) return Result.fail(new PlacaNotFoundError(id));

      // Bloquear edição de placa arquivada
      if ((placaExistente as any).archivedAt || (placaExistente as any).statusOperacional === 'ARCHIVED') {
        return Result.fail(new BusinessRuleViolationError('Placa arquivada não pode ser editada. Restaure primeiro.'));
      }

      const changedFields = [
        ...Object.keys(validatedData || {}),
        ...(file ? ['imagem'] : []),
      ];
      const override = (data as any)?.temporalOverride === true || (data as any)?.adminOverride === true;
      try {
        await temporalEngine.assertPlateCanBeEdited(id, changedFields, { empresaId, override });
      } catch (temporalError) {
        return Result.fail(toDomainError(temporalError));
      }

      // Validar região se alterada
      if (validatedData.regiaoId) {
        const regiaoExists = await Regiao.findOne({
          _id: validatedData.regiaoId,
          empresaId,
          status: { $ne: 'ARCHIVED' },
        }).lean();
        if (!regiaoExists) return Result.fail(new NotFoundError('Região', validatedData.regiaoId));
      }

      // Processar imagem — toda imagem vai para PlateMedia (fonte canônica)
      if (file) {
        const mediaResult = mediaPipelineService.processMediaAsset(file, { ownerType: 'placa', ownerId: id, empresaId });
        if (mediaResult.warnings.length > 0) {
          Log.warn('[PlacaService] Diagnósticos de media na atualização', { placaId: id, warnings: mediaResult.warnings.map((w) => w.code) });
        }
        validatePlacaImage({ mimetype: file.mimetype, size: file.size, filename: file.originalname });
        if (file.buffer) {
          // uploadMedia handles: R2 upload, old-image deletion via replaceMain, and
          // PlateMedia sync via syncPlateMedia. Do NOT call safeDeleteStoredImage or
          // setActivePlateImage here — they would act on the already-updated PlateMedia
          // (new key), causing the newly uploaded image to be deleted from R2.
          await mediaService.uploadMedia(file as any, {
            ownerType: 'PLATE',
            ownerId: id,
            category: 'MAIN',
            source: 'UPLOAD',
            setAsMain: true,
            preservePreviousMain: false,
            version: 1,
          }, empresaId, userId);
        } else {
          const imageKey = storageKeyFromFile(file);
          if (!imageKey) {
            return Result.fail(new ValidationError([{ field: 'imagem', message: 'Referência de imagem inválida' }]));
          }
          await safeDeleteStoredImage(id, empresaId);
          await plateMediaService.setActivePlateImage(id, empresaId, {
            key: imageKey,
            source: 'upload',
          });
        }
      } else if ('imagem' in validatedData && (validatedData as any).imagem === null) {
        await safeDeleteStoredImage(id, empresaId);
        await plateMediaService.clearActivePlateImage(id, empresaId);
        delete (validatedData as any).imagem;
      }

      const result = await this.repository.update(id, validatedData, empresaId, userId);
      if (result.isFailure) return Result.fail(result.error);

      Log.info('[PlacaService] Placa atualizada', { placaId: id, empresaId });
      return Result.ok(result.value);
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        return Result.fail(validationErrorFromZod(error));
      }
      const domainError = toDomainError(error);
      Log.error('[PlacaService] Erro ao atualizar placa', { error: domainError.message, placaId: id, empresaId });
      return Result.fail(domainError);
    }
  }

  async listPlacas(
    empresaId: string,
    query: unknown,
  ): Promise<Result<PaginatedPlacasResponse, DomainError>> {
    try {
      const validatedQuery = validateListQuery(query);
      const result = await this.repository.findAll(empresaId, validatedQuery);
      if (result.isFailure) return Result.fail(result.error);

      const { data, total } = result.value;
      const { page, limit } = validatedQuery;
      const placasComAluguel = await this.enrichWithAluguelData(data, empresaId);
      const plateIds = placasComAluguel.map((p: any) => String((p as any)._id || (p as any).id));
      const plateMediaMap = await plateMediaService.batchResolvePlateMedia(plateIds, empresaId);
      const items = toListItems(placasComAluguel, plateMediaMap as any);
      const totalPages = Math.ceil(total / limit);

      return Result.ok({
        data: items,
        pagination: {
          totalDocs: total,
          totalPages,
          currentPage: page,
          limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        return Result.fail(new ValidationError([{ field: 'query', message: 'Parâmetros de consulta inválidos' }]));
      }
      const domainError = toDomainError(error);
      Log.error('[PlacaService] Erro ao listar placas', { error: domainError.message, empresaId });
      return Result.fail(domainError);
    }
  }

  async getPlacaById(
    id: string,
    empresaId: string,
  ): Promise<Result<PlacaEntity, DomainError>> {
    try {
      const result = await this.repository.findById(id, empresaId);
      if (result.isFailure) return Result.fail(result.error);
      if (!result.value) return Result.fail(new PlacaNotFoundError(id));
      return Result.ok(result.value);
    } catch (error) {
      const domainError = toDomainError(error);
      Log.error('[PlacaService] Erro ao buscar placa', { error: domainError.message, placaId: id, empresaId });
      return Result.fail(domainError);
    }
  }

  async deletePlaca(
    id: string,
    empresaId: string,
  ): Promise<Result<void, DomainError>> {
    try {
      const placaResult = await this.repository.findById(id, empresaId);
      if (placaResult.isFailure) return Result.fail(placaResult.error);
      if (!placaResult.value) return Result.fail(new PlacaNotFoundError(id));

      try {
        await temporalEngine.assertPlateCanBeEdited(
          id,
          ['numero_placa', 'nomeDaRua', 'coordenadas', 'imagem', 'regiaoId', 'statusComercial'],
          { empresaId },
        );
      } catch (temporalError) {
        return Result.fail(toDomainError(temporalError));
      }

      // Verificar status comercial via Commercial Projection
      let commercialStatus: string;
      try {
        const projection = await commercialProjectionService.resolve(id, empresaId);
        commercialStatus = projection.commercialStatus;
      } catch {
        commercialStatus = 'UNKNOWN';
      }

      if (BLOCKING_COMMERCIAL_STATUSES.includes(commercialStatus)) {
        return Result.fail(new BusinessRuleViolationError('Não é possível apagar uma placa que está atualmente alugada ou reservada'));
      }

      await safeDeleteStoredImage(id, empresaId);

      const deleteResult = await this.repository.delete(id, empresaId);
      if (deleteResult.isFailure) return Result.fail(deleteResult.error);

      Log.info('[PlacaService] Placa deletada', { placaId: id, empresaId });
      return Result.ok(undefined);
    } catch (error) {
      const domainError = toDomainError(error);
      Log.error('[PlacaService] Erro ao deletar placa', { error: domainError.message, placaId: id, empresaId });
      return Result.fail(domainError);
    }
  }

  async reorderPlacas(
    empresaId: string,
    payload: unknown,
  ): Promise<Result<PlacaEntity[], DomainError>> {
    try {
      const validatedPayload: ReorderPlacasDTO = validateReorderPlacas(payload);
      const result = await this.repository.reorderOperationalNumbers(empresaId, validatedPayload.items);
      if (result.isFailure) return Result.fail(result.error);
      return Result.ok(result.value);
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        return Result.fail(new ValidationError([{ field: 'items', message: 'Dados de organização inválidos' }]));
      }
      const domainError = toDomainError(error);
      Log.error('[PlacaService] Erro ao reorganizar placas', { error: domainError.message, empresaId });
      return Result.fail(domainError);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // IMAGENS
  // ──────────────────────────────────────────────────────────────────────────

  async uploadPlacaImage(
    id: string,
    file: S3File,
    body: unknown,
    empresaId: string,
    userId?: string,
  ): Promise<Result<PlacaEntity, DomainError>> {
    try {
      // Confirmar que placa existe
      const placaResult = await this.repository.findById(id, empresaId);
      if (placaResult.isFailure) return Result.fail(placaResult.error);
      if (!placaResult.value) return Result.fail(new PlacaNotFoundError(id));

      const dto = validateUploadPlateImage(body);
      validatePlacaImage({ mimetype: file.mimetype, size: file.size, filename: file.originalname });

      const mediaResult = mediaPipelineService.processMediaAsset(file, { ownerType: 'placa', ownerId: id, empresaId });
      if (mediaResult.warnings.length > 0) {
        Log.warn('[PlacaService] Diagnósticos de media no upload de imagem adicional', { placaId: id, warnings: mediaResult.warnings.map((w) => w.code) });
      }

      await mediaService.uploadMedia(file as any, {
        ownerType: 'PLATE',
        ownerId: id,
        category: dto.category as PlateImageCategory,
        source: 'UPLOAD',
        setAsMain: dto.setAsMain || dto.category === 'MAIN',
        preservePreviousMain: false,
        generatedBy: dto.generatedBy,
        templateId: dto.templateId,
        generationSource: dto.generationSource,
        overlayData: dto.overlayData as Record<string, unknown> | string | undefined,
        version: dto.version ?? 1,
      }, empresaId, userId);

      const result = await this.repository.findById(id, empresaId);
      if (result.isFailure) return Result.fail(result.error);
      if (!result.value) return Result.fail(new PlacaNotFoundError(id));

      // Registrar evento temporal
      await temporalEngine.recordEvent({
        empresaId,
        plateId: id,
        eventType: 'TEMPORAL_PLATE_RELEASED',
        message: `Imagem ${dto.category} adicionada à placa.`,
        metadata: { action: 'PLATE_IMAGE_UPLOADED', category: dto.category, source: 'UPLOAD', userId },
        createdBy: userId,
      });

      Log.info('[PlacaService] Imagem adicionada à placa', { placaId: id, category: dto.category, empresaId });
      return Result.ok(result.value);
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        return Result.fail(new ValidationError([{ field: 'imagem', message: 'Dados de imagem inválidos' }]));
      }
      const domainError = toDomainError(error);
      Log.error('[PlacaService] Erro ao fazer upload de imagem', { error: domainError.message, placaId: id });
      return Result.fail(domainError);
    }
  }

  async setMainImage(
    id: string,
    imageId: string,
    empresaId: string,
    userId?: string,
  ): Promise<Result<PlacaEntity, DomainError>> {
    try {
      try {
        await mediaService.setMain(imageId, empresaId, userId);
        const refreshed = await this.repository.findById(id, empresaId);
        if (refreshed.isFailure) return Result.fail(refreshed.error);
        if (refreshed.value) {
          await temporalEngine.recordEvent({
            empresaId,
            plateId: id,
            eventType: 'TEMPORAL_PLATE_RELEASED',
            message: 'Imagem principal da placa alterada.',
            metadata: { action: 'PLATE_MAIN_IMAGE_CHANGED', imageId, userId },
            createdBy: userId,
          });
          return Result.ok(refreshed.value);
        }
      } catch {
        // Imagem legada sem MediaAsset: usa compatibilidade antiga.
      }

      const result = await this.repository.setMainImage(id, empresaId, imageId);
      if (result.isFailure) return Result.fail(result.error);

      await temporalEngine.recordEvent({
        empresaId,
        plateId: id,
        eventType: 'TEMPORAL_PLATE_RELEASED',
        message: 'Imagem principal da placa alterada.',
        metadata: { action: 'PLATE_MAIN_IMAGE_CHANGED', imageId, userId },
        createdBy: userId,
      });

      return Result.ok(result.value);
    } catch (error) {
      return Result.fail(toDomainError(error));
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SOFT DELETE
  // ──────────────────────────────────────────────────────────────────────────

  async removeImage(
    id: string,
    imageId: string,
    empresaId: string,
    userId?: string,
  ): Promise<Result<PlacaEntity, DomainError>> {
    try {
      try {
        await mediaService.deleteMedia(imageId, empresaId, userId);
        const refreshed = await this.repository.findById(id, empresaId);
        if (refreshed.isFailure) return Result.fail(refreshed.error);
        if (refreshed.value) {
          await temporalEngine.recordEvent({
            empresaId,
            plateId: id,
            eventType: 'TEMPORAL_PLATE_RELEASED',
            message: 'Imagem removida da galeria da placa.',
            metadata: { action: 'PLATE_IMAGE_REMOVED', imageId, userId },
            createdBy: userId,
          });
          return Result.ok(refreshed.value);
        }
      } catch {
        // Imagem legada sem MediaAsset: usa compatibilidade antiga.
      }

      const result = await this.repository.removeImage(id, empresaId, imageId);
      if (result.isFailure) return Result.fail(result.error);

      await temporalEngine.recordEvent({
        empresaId,
        plateId: id,
        eventType: 'TEMPORAL_PLATE_RELEASED',
        message: 'Imagem removida da galeria da placa.',
        metadata: { action: 'PLATE_IMAGE_REMOVED', imageId, userId },
        createdBy: userId,
      });

      return Result.ok(result.value);
    } catch (error) {
      return Result.fail(toDomainError(error));
    }
  }

  async archivePlaca(
    id: string,
    data: unknown,
    empresaId: string,
    userId?: string,
  ): Promise<Result<PlacaEntity, DomainError>> {
    try {
      const placaResult = await this.repository.findById(id, empresaId);
      if (placaResult.isFailure) return Result.fail(placaResult.error);
      if (!placaResult.value) return Result.fail(new PlacaNotFoundError(id));

      const placa = placaResult.value;

      // Não arquivar se já está arquivada
      if ((placa as any).archivedAt) {
        return Result.fail(new BusinessRuleViolationError('Placa já está arquivada.'));
      }

      // Verificar contrato ativo via Temporal Engine
      try {
        await temporalEngine.assertPlateCanBeEdited(
          id,
          ['statusComercial', 'disponivel'],
          { empresaId },
        );
      } catch (temporalError) {
        return Result.fail(new BusinessRuleViolationError('Placa com contrato ativo não pode ser arquivada.'));
      }

      // Verificar status comercial via Commercial Projection
      let commercialStatus: string;
      try {
        const projection = await commercialProjectionService.resolve(id, empresaId);
        commercialStatus = projection.commercialStatus;
      } catch {
        commercialStatus = 'UNKNOWN';
      }

      if (BLOCKING_COMMERCIAL_STATUSES.includes(commercialStatus)) {
        return Result.fail(new BusinessRuleViolationError('Placa com contrato ativo não pode ser arquivada.'));
      }

      validateArchivePlaca(data);

      const result = await this.repository.archive(id, empresaId, userId);
      if (result.isFailure) return Result.fail(result.error);

      await temporalEngine.recordEvent({
        empresaId,
        plateId: id,
        eventType: 'TEMPORAL_PLATE_RELEASED',
        message: `Placa ${placa.numero_placa} arquivada.`,
        metadata: { action: 'PLATE_ARCHIVED', userId },
        createdBy: userId,
      });

      Log.info('[PlacaService] Placa arquivada', { placaId: id, empresaId });
      return Result.ok(result.value);
    } catch (error) {
      const domainError = toDomainError(error);
      Log.error('[PlacaService] Erro ao arquivar placa', { error: domainError.message, placaId: id });
      return Result.fail(domainError);
    }
  }

  async restorePlaca(
    id: string,
    empresaId: string,
    userId?: string,
  ): Promise<Result<PlacaEntity, DomainError>> {
    try {
      const placaResult = await this.repository.findById(id, empresaId);
      if (placaResult.isFailure) return Result.fail(placaResult.error);
      if (!placaResult.value) return Result.fail(new PlacaNotFoundError(id));

      const placa = placaResult.value;
      if (!(placa as any).archivedAt) {
        return Result.fail(new BusinessRuleViolationError('Placa não está arquivada.'));
      }

      const result = await this.repository.restore(id, empresaId, userId);
      if (result.isFailure) return Result.fail(result.error);

      await temporalEngine.recordEvent({
        empresaId,
        plateId: id,
        eventType: 'TEMPORAL_PLATE_RELEASED',
        message: `Placa ${placa.numero_placa} restaurada do arquivo.`,
        metadata: { action: 'PLATE_RESTORED', userId },
        createdBy: userId,
      });

      Log.info('[PlacaService] Placa restaurada', { placaId: id, empresaId });
      return Result.ok(result.value);
    } catch (error) {
      const domainError = toDomainError(error);
      Log.error('[PlacaService] Erro ao restaurar placa', { error: domainError.message, placaId: id });
      return Result.fail(domainError);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TIMELINE / DISPONIBILIDADE / HEALTH
  // ──────────────────────────────────────────────────────────────────────────

  async getPlacaTimeline(
    id: string,
    empresaId: string,
  ): Promise<Result<{ reservations: unknown[]; events: unknown[] }, DomainError>> {
    try {
      const placaResult = await this.repository.findById(id, empresaId);
      if (placaResult.isFailure) return Result.fail(placaResult.error);
      if (!placaResult.value) return Result.fail(new PlacaNotFoundError(id));

      const timeline = await temporalEngine.getPlateTimeline(id, empresaId);
      return Result.ok(timeline);
    } catch (error) {
      return Result.fail(toDomainError(error));
    }
  }

  async getPlacaAvailability(
    id: string,
    startDate: string,
    endDate: string,
    empresaId: string,
  ): Promise<Result<{ available: boolean; conflicts: unknown[] }, DomainError>> {
    try {
      const placaResult = await this.repository.findById(id, empresaId);
      if (placaResult.isFailure) return Result.fail(placaResult.error);
      if (!placaResult.value) return Result.fail(new PlacaNotFoundError(id));

      const result = await temporalEngine.checkPlateAvailability(id, startDate, endDate, { empresaId });
      return Result.ok(result);
    } catch (error) {
      return Result.fail(toDomainError(error));
    }
  }

  async getPlacasDisponiveis(
    empresaId: string,
    startDate: string,
    endDate: string,
    query: Record<string, unknown> = {},
  ): Promise<PlacaEntity[]> {
    const from = new Date(startDate);
    const to = new Date(endDate);

    if (!empresaId || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
      return [];
    }

    const listResult = await this.repository.findAll(empresaId, {
      page: 1,
      limit: 1000,
      sortBy: 'numero_placa',
      order: 'asc',
      search: typeof query.search === 'string' ? query.search : undefined,
      regiaoId: typeof query.regiao === 'string'
        ? query.regiao
        : typeof query.regiaoId === 'string'
          ? query.regiaoId
          : undefined,
      tipo: typeof query.tipo === 'string' ? query.tipo as any : undefined,
      includeArchived: false,
    });

    if (listResult.isFailure) return [];

    const available: PlacaEntity[] = [];
    for (const placa of listResult.value.data) {
      const placaId = String((placa as any)._id || (placa as any).id);
      const [commercialStatus, periodAvailability] = await Promise.all([
        commercialAvailabilityProjection.resolvePlateCommercialStatus({
          empresaId,
          placaId,
          at: from,
        }),
        temporalEngine.checkPlateAvailability(placaId, startDate, endDate, { empresaId }),
      ]);

      if (commercialStatus.isCommerciallyAvailable && periodAvailability.available) {
        available.push(placa);
      }
    }

    return available;
  }

  async getPlacaHealth(
    id: string,
    empresaId: string,
  ): Promise<Result<PlateHealthResult, DomainError>> {
    try {
      const placaResult = await this.repository.findById(id, empresaId);
      if (placaResult.isFailure) return Result.fail(placaResult.error);
      if (!placaResult.value) return Result.fail(new PlacaNotFoundError(id));

      const placa = placaResult.value as any;
      let temporalStatus: string | undefined;
      try {
        temporalStatus = await temporalEngine.resolvePlateTemporalStatus(id, new Date(), empresaId);
      } catch {
        // non-critical
      }

      const pm = await plateMediaService.resolvePlateMainImage(id, empresaId);
      const health = resolvePlateHealth({ ...placa, temporalStatus, plateMediaResolved: pm.hasImage });
      return Result.ok(health);
    } catch (error) {
      return Result.fail(toDomainError(error));
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ──────────────────────────────────────────────────────────────────────────

  private async enrichWithAluguelData(
    placas: PlacaEntity[],
    empresaId: string,
  ): Promise<Array<PlacaEntity & any>> {
    if (placas.length === 0) return [];

    const hoje = new Date();
    const placaIds = placas.map((p) => String((p as any)._id || (p as any).id));

    // Primary path: Commercial Projection (O(1) DB round trips via resolveBatch)
    try {
      const projectionMap = await commercialProjectionService.resolveBatch(placaIds, empresaId, hoje);

      const enriched = placas.map((placa: any) => {
        const placaId = String(placa._id || placa.id);
        const projection = projectionMap.get(placaId);

        if (projection) {
          const { commercialStatus, reservation, activeContract } = projection;

          placa.aluguel_ativo = reservation.active || commercialStatus === 'CONTRACTED_ACTIVE';
          placa.aluguel_futuro = reservation.future || commercialStatus === 'FUTURE_RESERVED';
          placa.cliente_nome = activeContract?.clientName;
          // Fonte primária: CP pricing. Fallback: campo legado da placa (schema default 0).
          placa.valor_mensal = projection.pricing?.contractValue ?? placa.valor_mensal;
          // Derivar statusComercial (legado) a partir do status canônico da CP.
          placa.statusComercial = mapCommercialStatusToLegacyStatusComercial(commercialStatus);

          if (commercialStatus === 'CONTRACTED_ACTIVE') {
            placa.statusAluguel = 'alugada';
          } else if (commercialStatus === 'RESERVED' || commercialStatus === 'FUTURE_RESERVED') {
            placa.statusAluguel = 'reservada';
          } else if (commercialStatus === 'AVAILABLE') {
            placa.statusAluguel = 'disponivel';
          } else {
            // MAINTENANCE or UNKNOWN — safe fallback, preserve existing or default to disponivel
            placa.statusAluguel = placa.statusAluguel ?? 'disponivel';
          }
        } else {
          placa.aluguel_ativo = false;
          placa.aluguel_futuro = false;
          placa.statusAluguel = 'disponivel';
        }

        return placa;
      });

      const summary = inventoryService.buildInventorySummary(
        enriched.map((placa: any) => ({
          placa,
          alugueis: [],
          usedOnMap: true,
        })),
        { now: hoje },
      );

      if (summary.diagnostics.length > 0) {
        Log.warn('[PlacaService] Diagnósticos de inventário detectados', {
          empresaId,
          totalDiagnostics: summary.diagnostics.length,
          conflictCodes: summary.diagnostics.map((d) => d.code),
        });
      }

      const projectionResult = projectionService.rebuildProjection(
        {
          inventorySources: enriched.map((placa: any) => ({
            placa,
            alugueis: [],
            usedOnMap: true,
          })),
        },
        { tenantId: empresaId, source: 'placa-service', now: hoje },
      );

      if (!projectionResult.ok) {
        Log.warn('[PlacaService] Falha ao reconstruir projection snapshot', { empresaId, error: projectionResult.error });
      }

      return enriched;
    } catch (error) {
      // Contador: legacy_commercial_fallback_used_total (integrar com sistema de métricas quando disponível)
      Log.warn('[PlacaService] LEGACY_COMMERCIAL_FALLBACK_USED', {
        tag: 'LEGACY_COMMERCIAL_FALLBACK_USED',
        empresaId,
        placasCount: placas.length,
        reason: toDomainError(error).message,
        timestamp: new Date().toISOString(),
      });
      return this.enrichWithAluguelDataLegacy(placas, empresaId, hoje);
    }
  }

  /** Fallback: enriches plates from Aluguel queries when Commercial Projection is unavailable. */
  private async enrichWithAluguelDataLegacy(
    placas: PlacaEntity[],
    empresaId: string,
    hoje: Date,
  ): Promise<Array<PlacaEntity & any>> {
    const placaIds = placas.map((p) => (p as any)._id);

    try {
      const alugueisAtivos = await Aluguel.find({
        $and: [
          { $or: [{ placaId: { $in: placaIds } }, { placa: { $in: placaIds } }] },
          { $or: [{ empresaId }, { empresa: empresaId }] },
          { $or: [{ endDate: { $gte: hoje } }, { data_fim: { $gte: hoje } }] },
        ],
      })
      .sort({ startDate: 1, data_inicio: 1 })
      .populate('clienteId', 'nome')
      .lean();

      const aluguelMap = alugueisAtivos.reduce((map: any, aluguel: any) => {
        const placaId = (aluguel.placaId || aluguel.placa)?.toString();
        if (placaId && !map[placaId]) {
          map[placaId] = {
            ...aluguel,
            startDate: aluguel.startDate || aluguel.data_inicio,
            endDate: aluguel.endDate || aluguel.data_fim,
            cliente: aluguel.clienteId || aluguel.cliente,
          };
        }
        return map;
      }, {});

      return placas.map((placa: any) => {
        const aluguel = aluguelMap[placa._id.toString()];
        if (aluguel?.cliente) {
          const dataInicio = new Date(aluguel.startDate);
          const dataFim = new Date(aluguel.endDate);
          placa.cliente_nome = aluguel.cliente.nome;
          placa.aluguel_data_inicio = aluguel.startDate;
          placa.aluguel_data_fim = aluguel.endDate;
          placa.aluguel_ativo = true;
          placa.aluguel_futuro = dataInicio > hoje;
          placa.statusAluguel = dataInicio > hoje ? 'reservada' : dataFim >= hoje ? 'alugada' : 'disponivel';
        } else {
          placa.aluguel_ativo = false;
          placa.aluguel_futuro = false;
          placa.statusAluguel = 'disponivel';
        }
        return placa;
      });
    } catch (error) {
      Log.warn('[PlacaService] Erro ao enriquecer com dados de aluguel (legado)', { error: toDomainError(error).message });
      return placas as any;
    }
  }
}
