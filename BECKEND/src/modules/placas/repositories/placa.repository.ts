/**
 * Placa Repository
 * Camada de acesso a dados com Result pattern
 */

import mongoose, { FilterQuery, Types } from 'mongoose';
import Placa from '../Placa';
import { Result, DomainError } from '@shared/core';
import { 
  DatabaseError, 
  PlacaNotFoundError,
  DuplicateKeyError,
  ValidationError,
  toDomainError
} from '@shared/core';
import { Log } from '@shared/core';
import type { 
  PlacaEntity, 
  CreatePlacaDTO, 
  UpdatePlacaDTO,
  ListPlacasQueryDTO 
} from '../dtos/placa.dto';

export interface IPlacaRepository {
  create(data: CreatePlacaDTO, empresaId: string, createdBy?: string): Promise<Result<PlacaEntity, DomainError>>;
  findById(id: string, empresaId: string): Promise<Result<PlacaEntity | null, DomainError>>;
  findAll(empresaId: string, query: ListPlacasQueryDTO): Promise<Result<{ data: PlacaEntity[], total: number }, DomainError>>;
  update(id: string, data: UpdatePlacaDTO, empresaId: string, updatedBy?: string): Promise<Result<PlacaEntity, DomainError>>;
  delete(id: string, empresaId: string): Promise<Result<void, DomainError>>;
  archive(id: string, empresaId: string, archivedBy?: string): Promise<Result<PlacaEntity, DomainError>>;
  restore(id: string, empresaId: string, updatedBy?: string): Promise<Result<PlacaEntity, DomainError>>;
  addImage(id: string, empresaId: string, image: Record<string, unknown>): Promise<Result<PlacaEntity, DomainError>>;
  setMainImage(id: string, empresaId: string, imageId: string): Promise<Result<PlacaEntity, DomainError>>;
  removeImage(id: string, empresaId: string, imageId: string): Promise<Result<PlacaEntity, DomainError>>;
  exists(id: string, empresaId: string): Promise<Result<boolean, DomainError>>;
  countByRegiao(regiaoId: string, empresaId: string): Promise<Result<number, DomainError>>;
  findByNumeroPlaca(numeroPlaca: string, empresaId: string): Promise<Result<PlacaEntity | null, DomainError>>;
  getNextOperationalNumber(empresaId: string): Promise<Result<number, DomainError>>;
  reorderOperationalNumbers(
    empresaId: string,
    items: Array<{ placaId: string; numeroOperacional: number }>
  ): Promise<Result<PlacaEntity[], DomainError>>;
}

export class PlacaRepository implements IPlacaRepository {
  
  /**
   * Cria uma nova placa
   */
  async create(
    data: CreatePlacaDTO,
    empresaId: string,
    createdBy?: string,
  ): Promise<Result<PlacaEntity, DomainError>> {
    try {
      const placa = new Placa({
        ...data,
        empresaId,
        ativa: data.ativa ?? true,
        ...(createdBy ? { createdBy } : {}),
      });

      await placa.save();
      await placa.populate('regiaoId', 'nome');
      
      Log.info('[PlacaRepository] Placa criada', { 
        placaId: placa._id,
        numeroPlaca: placa.numero_placa,
        empresaId 
      });

      return Result.ok(placa.toObject<PlacaEntity>());

    } catch (error) {
      // Mongoose duplicate key error
      if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
        const field = 'keyPattern' in error && error.keyPattern && typeof error.keyPattern === 'object'
          ? Object.keys(error.keyPattern)[0] || 'desconhecido'
          : 'desconhecido';
        
        Log.warn('[PlacaRepository] Tentativa de criar placa duplicada', { field, empresaId });
        return Result.fail(new DuplicateKeyError(field));
      }

      const domainError = toDomainError(error);
      Log.error('[PlacaRepository] Erro ao criar placa', { 
        error: domainError.message,
        empresaId 
      });
      
      return Result.fail(new DatabaseError('create', domainError.message));
    }
  }

  /**
   * Busca placa por ID
   */
  async findById(
    id: string, 
    empresaId: string
  ): Promise<Result<PlacaEntity | null, DomainError>> {
    try {
      const placa = await Placa.findOne({ _id: id, empresaId })
        .populate('regiaoId', 'nome')
        .lean();
      
      if (!placa) {
        return Result.ok(null);
      }

      return Result.ok(placa as unknown as PlacaEntity);

    } catch (error) {
      const domainError = toDomainError(error);
      Log.error('[PlacaRepository] Erro ao buscar placa', { 
        error: domainError.message,
        placaId: id,
        empresaId 
      });
      
      return Result.fail(new DatabaseError('findById', domainError.message));
    }
  }

  /**
   * Lista placas com filtros e paginação
   */
  async findAll(
    empresaId: string,
    query: ListPlacasQueryDTO,
  ): Promise<Result<{ data: PlacaEntity[], total: number }, DomainError>> {
    try {
      const { page, limit, sortBy, order, search, regiaoId, tipo, ativa, disponivel, statusOperacional, statusComercial, includeArchived } = query;

      const filter: FilterQuery<any> = { empresaId };

      // Excluir arquivadas por padrão
      if (!includeArchived) {
        filter.statusOperacional = { $ne: 'ARCHIVED' };
        filter.archivedAt = { $exists: false };
      }

      if (statusOperacional) {
        filter.statusOperacional = statusOperacional;
      }

      if (statusComercial) {
        filter.statusComercial = statusComercial;
      }

      if (ativa !== undefined) {
        filter.disponivel = ativa;
      } else if (disponivel !== undefined) {
        filter.disponivel = disponivel;
      }

      if (regiaoId) {
        filter.regiaoId = regiaoId;
      }

      if (tipo) {
        filter.tipo = tipo;
      }

      if (search) {
        filter.$or = [
          { numero_placa: { $regex: search, $options: 'i' } },
          { endereco: { $regex: search, $options: 'i' } },
          { nomeDaRua: { $regex: search, $options: 'i' } },
          { localizacao: { $regex: search, $options: 'i' } },
        ];
      }

      // Executar queries em paralelo
      const skip = (page - 1) * limit;
      const sortOrder = order === 'desc' ? -1 : 1;

      const [data, total] = await Promise.all([
        Placa.find(filter)
          .populate('regiaoId', 'nome')
          .sort({ [sortBy]: sortOrder })
          .skip(skip)
          .limit(limit)
          .lean(),
        Placa.countDocuments(filter)
      ]);

      return Result.ok({
        data: data as unknown as PlacaEntity[],
        total
      });

    } catch (error) {
      const domainError = toDomainError(error);
      Log.error('[PlacaRepository] Erro ao listar placas', { 
        error: domainError.message,
        empresaId 
      });
      
      return Result.fail(new DatabaseError('findAll', domainError.message));
    }
  }

  /**
   * Atualiza placa
   */
  async update(
    id: string,
    data: UpdatePlacaDTO,
    empresaId: string,
    updatedBy?: string,
  ): Promise<Result<PlacaEntity, DomainError>> {
    try {
      const updatePayload: Record<string, unknown> = { ...data };
      if (updatedBy) updatePayload.updatedBy = updatedBy;

      const placa = await Placa.findOneAndUpdate(
        { _id: id, empresaId },
        { $set: updatePayload },
        { new: true, runValidators: true },
      )
      .populate('regiaoId', 'nome')
      .lean();

      if (!placa) {
        return Result.fail(new PlacaNotFoundError(id));
      }

      Log.info('[PlacaRepository] Placa atualizada', { 
        placaId: id,
        empresaId 
      });

      return Result.ok(placa as unknown as PlacaEntity);

    } catch (error) {
      // Duplicate key error
      if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
        const field = 'keyPattern' in error && error.keyPattern && typeof error.keyPattern === 'object'
          ? Object.keys(error.keyPattern)[0] || 'desconhecido'
          : 'desconhecido';
        
        return Result.fail(new DuplicateKeyError(field));
      }

      const domainError = toDomainError(error);
      Log.error('[PlacaRepository] Erro ao atualizar placa', { 
        error: domainError.message,
        placaId: id,
        empresaId 
      });
      
      return Result.fail(new DatabaseError('update', domainError.message));
    }
  }

  /**
   * Deleta placa
   */
  async delete(
    id: string,
    empresaId: string
  ): Promise<Result<void, DomainError>> {
    try {
      const result = await Placa.deleteOne({ _id: id, empresaId });

      if (result.deletedCount === 0) {
        return Result.fail(new PlacaNotFoundError(id));
      }

      Log.info('[PlacaRepository] Placa deletada', { 
        placaId: id,
        empresaId 
      });

      return Result.ok(undefined);

    } catch (error) {
      const domainError = toDomainError(error);
      Log.error('[PlacaRepository] Erro ao deletar placa', { 
        error: domainError.message,
        placaId: id,
        empresaId 
      });
      
      return Result.fail(new DatabaseError('delete', domainError.message));
    }
  }

  /**
   * Arquiva a placa (soft delete)
   */
  async archive(
    id: string,
    empresaId: string,
    archivedBy?: string,
  ): Promise<Result<PlacaEntity, DomainError>> {
    try {
      const placa = await Placa.findOneAndUpdate(
        { _id: id, empresaId },
        {
          $set: {
            archivedAt: new Date(),
            statusOperacional: 'ARCHIVED',
            disponivel: false,
            ...(archivedBy ? { archivedBy, updatedBy: archivedBy } : {}),
          },
        },
        { new: true, runValidators: true },
      )
      .populate('regiaoId', 'nome')
      .lean();

      if (!placa) return Result.fail(new PlacaNotFoundError(id));

      Log.info('[PlacaRepository] Placa arquivada', { placaId: id, empresaId });
      return Result.ok(placa as unknown as PlacaEntity);
    } catch (error) {
      const domainError = toDomainError(error);
      Log.error('[PlacaRepository] Erro ao arquivar placa', { error: domainError.message, placaId: id });
      return Result.fail(new DatabaseError('archive', domainError.message));
    }
  }

  /**
   * Restaura placa arquivada
   */
  async restore(
    id: string,
    empresaId: string,
    updatedBy?: string,
  ): Promise<Result<PlacaEntity, DomainError>> {
    try {
      const placa = await Placa.findOneAndUpdate(
        { _id: id, empresaId },
        {
          $set: {
            statusOperacional: 'ACTIVE',
            disponivel: true,
            ...(updatedBy ? { updatedBy } : {}),
          },
          $unset: { archivedAt: '', archivedBy: '' },
        },
        { new: true, runValidators: true },
      )
      .populate('regiaoId', 'nome')
      .lean();

      if (!placa) return Result.fail(new PlacaNotFoundError(id));

      Log.info('[PlacaRepository] Placa restaurada', { placaId: id, empresaId });
      return Result.ok(placa as unknown as PlacaEntity);
    } catch (error) {
      const domainError = toDomainError(error);
      Log.error('[PlacaRepository] Erro ao restaurar placa', { error: domainError.message, placaId: id });
      return Result.fail(new DatabaseError('restore', domainError.message));
    }
  }

  /**
   * Adiciona imagem à galeria da placa
   */
  async addImage(
    id: string,
    empresaId: string,
    image: Record<string, unknown>,
  ): Promise<Result<PlacaEntity, DomainError>> {
    try {
      const imageId = new Types.ObjectId();
      const isMain = image.category === 'MAIN' || image.setAsMain === true;
      const normalizedImage = {
        ...image,
        _id: imageId,
        id: String(imageId),
        isMain,
        source: image.source ?? 'UPLOAD',
        updatedAt: new Date(),
      };
      if (isMain) {
        await Placa.updateOne(
          { _id: id, empresaId, imagens: { $exists: false } },
          { $set: { imagens: [] } },
        );

        await Placa.updateOne(
          { _id: id, empresaId, imagens: { $type: 'array' } },
          { $set: { 'imagens.$[].isMain': false } },
        );
      }

      const setPayload: Record<string, unknown> = {};
      if (isMain) {
        setPayload.imagemPrincipal = image.url;
        setPayload.imagem = image.url;
      }

      const placa = await Placa.findOneAndUpdate(
        { _id: id, empresaId },
        {
          $push: { imagens: normalizedImage },
          ...(Object.keys(setPayload).length ? { $set: setPayload } : {}),
        },
        { new: true, runValidators: true },
      )
      .populate('regiaoId', 'nome')
      .lean();

      if (!placa) return Result.fail(new PlacaNotFoundError(id));

      Log.info('[PlacaRepository] Imagem adicionada à placa', { placaId: id, empresaId });
      return Result.ok(placa as unknown as PlacaEntity);
    } catch (error) {
      const domainError = toDomainError(error);
      Log.error('[PlacaRepository] Erro ao adicionar imagem', { error: domainError.message, placaId: id });
      return Result.fail(new DatabaseError('addImage', domainError.message));
    }
  }

  /**
   * Define imagem como principal
   */
  async setMainImage(
    id: string,
    empresaId: string,
    imageId: string,
  ): Promise<Result<PlacaEntity, DomainError>> {
    try {
      const placa = await Placa.findOne({ _id: id, empresaId }).lean();
      if (!placa) return Result.fail(new PlacaNotFoundError(id));

      const img = (placa as any).imagens?.find((i: any) => String(i._id) === imageId || String(i.id) === imageId);
      if (!img) return Result.fail(new PlacaNotFoundError(`Imagem ${imageId}`));
      const now = new Date();
      const imagens = ((placa as any).imagens ?? []).map((item: any) => ({
        ...item,
        isMain: String(item._id) === imageId || String(item.id) === imageId,
        updatedAt: now,
      }));

      const updated = await Placa.findOneAndUpdate(
        { _id: id, empresaId },
        { $set: { imagemPrincipal: img.url, imagem: img.url, imagens } },
        { new: true },
      )
      .populate('regiaoId', 'nome')
      .lean();

      return Result.ok(updated as unknown as PlacaEntity);
    } catch (error) {
      const domainError = toDomainError(error);
      return Result.fail(new DatabaseError('setMainImage', domainError.message));
    }
  }

  /**
   * Remove imagem da galeria sem apagar R2 nesta etapa.
   */
  async removeImage(
    id: string,
    empresaId: string,
    imageId: string,
  ): Promise<Result<PlacaEntity, DomainError>> {
    try {
      const placa = await Placa.findOne({ _id: id, empresaId }).lean();
      if (!placa) return Result.fail(new PlacaNotFoundError(id));

      const imagens = ((placa as any).imagens ?? []);
      const target = imagens.find((i: any) => String(i._id) === imageId || String(i.id) === imageId);
      if (!target) return Result.fail(new PlacaNotFoundError(`Imagem ${imageId}`));

      const remaining = imagens.filter((i: any) => String(i._id) !== imageId && String(i.id) !== imageId);
      const targetIsMain = Boolean(target.isMain) || target.url === (placa as any).imagemPrincipal || target.url === (placa as any).imagem;
      const fallbackMain = targetIsMain ? remaining[0] : remaining.find((i: any) => i.isMain);
      const normalizedRemaining = remaining.map((item: any) => ({
        ...item,
        isMain: fallbackMain ? String(item._id) === String(fallbackMain._id) || String(item.id) === String(fallbackMain.id) : false,
        updatedAt: new Date(),
      }));

      const updated = await Placa.findOneAndUpdate(
        { _id: id, empresaId },
        {
          $set: {
            imagens: normalizedRemaining,
            imagemPrincipal: fallbackMain?.url ?? null,
            imagem: fallbackMain?.url ?? null,
          },
        },
        { new: true },
      )
      .populate('regiaoId', 'nome')
      .lean();

      return Result.ok(updated as unknown as PlacaEntity);
    } catch (error) {
      const domainError = toDomainError(error);
      return Result.fail(new DatabaseError('removeImage', domainError.message));
    }
  }

  /**
   * Verifica se placa existe
   */
  async exists(
    id: string,
    empresaId: string
  ): Promise<Result<boolean, DomainError>> {
    try {
      const count = await Placa.countDocuments({ _id: id, empresaId });
      return Result.ok(count > 0);

    } catch (error) {
      const domainError = toDomainError(error);
      Log.error('[PlacaRepository] Erro ao verificar existência', { 
        error: domainError.message,
        placaId: id,
        empresaId 
      });
      
      return Result.fail(new DatabaseError('exists', domainError.message));
    }
  }

  /**
   * Conta placas por região
   */
  async countByRegiao(regiaoId: string, empresaId: string): Promise<Result<number, DomainError>> {
    try {
      const count = await Placa.countDocuments({ regiaoId, empresaId });
      return Result.ok(count);

    } catch (error) {
      const domainError = toDomainError(error);
      Log.error('[PlacaRepository] Erro ao contar placas por região', { 
        error: domainError.message,
        regiaoId,
        empresaId 
      });
      
      return Result.fail(new DatabaseError('countByRegiao', domainError.message));
    }
  }

  /**
   * Busca placa por número
   */
  async findByNumeroPlaca(
    numeroPlaca: string,
    empresaId: string
  ): Promise<Result<PlacaEntity | null, DomainError>> {
    try {
      const placa = await Placa.findOne({ numero_placa: numeroPlaca, empresaId })
        .populate('regiaoId', 'nome')
        .lean();
      
      if (!placa) {
        return Result.ok(null);
      }

      return Result.ok(placa as unknown as PlacaEntity);

    } catch (error) {
      const domainError = toDomainError(error);
      Log.error('[PlacaRepository] Erro ao buscar placa por número', { 
        error: domainError.message,
        numeroPlaca,
        empresaId 
      });
      
      return Result.fail(new DatabaseError('findByNumeroPlaca', domainError.message));
    }
  }

  async getNextOperationalNumber(empresaId: string): Promise<Result<number, DomainError>> {
    try {
      const lastPlaca = await Placa.findOne({ empresaId, numeroOperacional: { $type: 'number' } })
        .sort({ numeroOperacional: -1 })
        .select('numeroOperacional')
        .lean();

      const lastValue = typeof lastPlaca?.numeroOperacional === 'number'
        ? lastPlaca.numeroOperacional
        : 0;

      return Result.ok(lastValue + 1);
    } catch (error) {
      const domainError = toDomainError(error);
      Log.error('[PlacaRepository] Erro ao buscar próximo número operacional', {
        error: domainError.message,
        empresaId,
      });

      return Result.fail(new DatabaseError('getNextOperationalNumber', domainError.message));
    }
  }

  async reorderOperationalNumbers(
    empresaId: string,
    items: Array<{ placaId: string; numeroOperacional: number }>
  ): Promise<Result<PlacaEntity[], DomainError>> {
    const executeReorder = async (session?: mongoose.ClientSession): Promise<Result<PlacaEntity[], DomainError>> => {
      const maybeSession = session ? { session } : {};

      const placaIds = items.map((item) => item.placaId);
      const targetNumbers = items.map((item) => item.numeroOperacional);

      const duplicatedIds = placaIds.filter((id, index) => placaIds.indexOf(id) !== index);
      if (duplicatedIds.length > 0) {
        return Result.fail(new ValidationError([{ field: 'items', message: 'Placas duplicadas na reorganização' }]));
      }

      const duplicatedNumbers = targetNumbers.filter((n, index) => targetNumbers.indexOf(n) !== index);
      if (duplicatedNumbers.length > 0) {
        return Result.fail(new ValidationError([{ field: 'items', message: 'Números operacionais duplicados' }]));
      }

      const objectIds = placaIds.map((id) => new Types.ObjectId(id));

      const placas = await Placa.find({ _id: { $in: objectIds }, empresaId })
        .select('_id numeroOperacional')
        .lean()
        .session(session || null);

      if (placas.length !== items.length) {
        return Result.fail(new ValidationError([{ field: 'items', message: 'Existem placas inválidas ou fora da sua empresa' }]));
      }

      const conflictCount = await Placa.countDocuments({
        empresaId,
        _id: { $nin: objectIds },
        numeroOperacional: { $in: targetNumbers },
      }).session(session || null);

      if (conflictCount > 0) {
        return Result.fail(new ValidationError([{ field: 'items', message: 'A numeração proposta conflita com outras placas da empresa' }]));
      }

      const tempBase = 1000000;
      const phaseOneOps = items.map((item, idx) => ({
        updateOne: {
          filter: { _id: new Types.ObjectId(item.placaId), empresaId },
          update: { $set: { numeroOperacional: tempBase + idx } },
        }
      }));

      if (phaseOneOps.length > 0) {
        await Placa.bulkWrite(phaseOneOps, maybeSession);
      }

      const phaseTwoOps = items.map((item) => ({
        updateOne: {
          filter: { _id: new Types.ObjectId(item.placaId), empresaId },
          update: { $set: { numeroOperacional: item.numeroOperacional } },
        }
      }));

      if (phaseTwoOps.length > 0) {
        await Placa.bulkWrite(phaseTwoOps, maybeSession);
      }

      const updated = await Placa.find({ _id: { $in: objectIds }, empresaId })
        .populate('regiaoId', 'nome')
        .sort({ numeroOperacional: 1 })
        .lean()
        .session(session || null);

      return Result.ok(updated as unknown as PlacaEntity[]);
    };

    const session = await mongoose.startSession();
    try {
      return await session.withTransaction(async () => executeReorder(session));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('Transaction numbers are only allowed on a replica set member or mongos')) {
        Log.warn('[PlacaRepository] Banco sem suporte a transaction. Aplicando fallback seguro sem transação', {
          empresaId,
        });

        try {
          return await executeReorder();
        } catch (fallbackError) {
          const domainError = toDomainError(fallbackError);
          return Result.fail(new DatabaseError('reorderOperationalNumbers', domainError.message));
        }
      }

      const domainError = toDomainError(error);
      Log.error('[PlacaRepository] Erro ao reorganizar numeração operacional', {
        error: domainError.message,
        empresaId,
      });

      return Result.fail(new DatabaseError('reorderOperationalNumbers', domainError.message));
    } finally {
      await session.endSession();
    }
  }
}
