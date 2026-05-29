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
import Aluguel from '@modules/alugueis/Aluguel';
import Regiao from '@modules/regioes/Regiao';
import { inventoryService } from '@modules/inventory';
import { projectionService } from '@modules/projections';
import { mediaPipelineService } from '@modules/media';
import { mediaService } from '@modules/media/media.service';
import { temporalEngine } from '@modules/temporal';
import { commercialAvailabilityProjection } from '@modules/commercial-availability';
import type { IPlacaRepository } from '../repositories/placa.repository';
import { resolvePlateHealth } from '../utils/plate-health.utils';
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
  return file.key || file.location || '';
}

function deleteKeyFromStoredImage(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const raw = value.trim();

  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      return url.pathname.replace(/^\/+/, '') || null;
    } catch {
      return null;
    }
  }

  if (raw.includes('/')) return raw.replace(/^\/+/, '');
  return `inmidia-uploads-sistema/inmidia-uploads-sistema/${raw}`;
}

async function safeDeleteStoredImage(value: unknown): Promise<void> {
  const key = deleteKeyFromStoredImage(value);
  if (!key) return;
  try { await safeDeleteFromR2(key); } catch { /* non-critical */ }
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
        return Result.fail(new ValidationError([{ field: 'data', message: 'Dados de entrada inválidos' }]));
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

      // Processar imagem
      if (file) {
        const mediaResult = mediaPipelineService.processMediaAsset(file, { ownerType: 'placa', ownerId: id, empresaId });
        if (mediaResult.warnings.length > 0) {
          Log.warn('[PlacaService] Diagnósticos de media na atualização', { placaId: id, warnings: mediaResult.warnings.map((w) => w.code) });
        }
        validatePlacaImage({ mimetype: file.mimetype, size: file.size, filename: file.originalname });
        if (file.buffer) {
          const asset = await mediaService.uploadMedia(file as any, {
            ownerType: 'PLATE',
            ownerId: id,
            category: 'MAIN',
            source: 'UPLOAD',
            setAsMain: true,
            preservePreviousMain: false,
            version: 1,
          }, empresaId, userId);
          (validatedData as any).imagem = asset.publicUrl || asset.url;
          (validatedData as any).imagemPrincipal = asset.publicUrl || asset.url;
        } else {
          const imageKey = storageKeyFromFile(file);
          (validatedData as any).imagem = imageKey;
          (validatedData as any).imagemPrincipal = imageKey;
        }

        if (placaExistente.imagem) {
          await safeDeleteStoredImage((placaExistente as any).imagemPrincipal || placaExistente.imagem);
        }
      } else if ('imagem' in validatedData && (validatedData as any).imagem === null) {
        if (placaExistente.imagem) {
          await safeDeleteStoredImage((placaExistente as any).imagemPrincipal || placaExistente.imagem);
        }
        (validatedData as any).imagem = undefined;
        (validatedData as any).imagemPrincipal = undefined;
      }

      const result = await this.repository.update(id, validatedData, empresaId, userId);
      if (result.isFailure) return Result.fail(result.error);

      Log.info('[PlacaService] Placa atualizada', { placaId: id, empresaId });
      return Result.ok(result.value);
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        return Result.fail(new ValidationError([{ field: 'data', message: 'Dados de entrada inválidos' }]));
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
      const items = toListItems(placasComAluguel);
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

      const placa = placaResult.value;

      try {
        await temporalEngine.assertPlateCanBeEdited(
          id,
          ['numero_placa', 'nomeDaRua', 'coordenadas', 'imagem', 'regiaoId', 'statusComercial'],
          { empresaId },
        );
      } catch (temporalError) {
        return Result.fail(toDomainError(temporalError));
      }

      // Verificar aluguel ativo
      const hoje = new Date();
      const aluguelAtivo = await Aluguel.findOne({
        $and: [
          { $or: [{ placa: id }, { placaId: id }] },
          { $or: [{ empresa: empresaId }, { empresaId }] },
          { $or: [{ data_inicio: { $lte: hoje } }, { startDate: { $lte: hoje } }] },
          { $or: [{ data_fim: { $gte: hoje } }, { endDate: { $gte: hoje } }] },
        ],
      }).lean();

      if (aluguelAtivo) {
        return Result.fail(new BusinessRuleViolationError('Não é possível apagar uma placa que está atualmente alugada'));
      }

      await safeDeleteStoredImage((placa as any).imagemPrincipal || placa.imagem);

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

      // Verificar aluguel ativo
      const hoje = new Date();
      const aluguelAtivo = await Aluguel.findOne({
        $and: [
          { $or: [{ placa: id }, { placaId: id }] },
          { $or: [{ empresa: empresaId }, { empresaId }] },
          { $or: [{ data_inicio: { $lte: hoje } }, { startDate: { $lte: hoje } }] },
          { $or: [{ data_fim: { $gte: hoje } }, { endDate: { $gte: hoje } }] },
        ],
      }).lean();

      if (aluguelAtivo) {
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

      const health = resolvePlateHealth({ ...placa, temporalStatus });
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
    const placaIds = placas.map((p) => p._id);

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

      const enriched = placas.map((placa: any) => {
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

      const summary = inventoryService.buildInventorySummary(
        enriched.map((placa: any) => ({
          placa,
          alugueis: aluguelMap[placa._id.toString()] ? [aluguelMap[placa._id.toString()]] : [],
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
            alugueis: aluguelMap[placa._id.toString()] ? [aluguelMap[placa._id.toString()]] : [],
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
      Log.warn('[PlacaService] Erro ao enriquecer com dados de aluguel', { error: toDomainError(error).message });
      return placas as any;
    }
  }
}
