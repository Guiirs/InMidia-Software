/**
 * Regiao Repository
 * Camada de acesso a dados com Result pattern
 */

import { FilterQuery } from 'mongoose';
import Regiao from '../Regiao';
import Placa from '@modules/placas/Placa';
import { Result, DomainError, NotFoundError } from '@shared/core';

export class RegiaoNotFoundError extends NotFoundError {
  constructor(regiaoId: string) {
    super(`Região com ID ${regiaoId} não encontrada`);
  }
}
import { 
  DatabaseError, 
  DuplicateKeyError,
  toDomainError
} from '@shared/core';
import { Log } from '@shared/core';
import type { 
  RegiaoEntity, 
  CreateRegiaoDTO, 
  UpdateRegiaoDTO,
  ListRegioesQueryDTO 
} from '../dtos/regiao.dto';

export interface IRegiaoRepository {
  create(data: CreateRegiaoDTO & { empresaId: string }): Promise<Result<RegiaoEntity, DomainError>>;
  findById(id: string, empresaId: string): Promise<Result<RegiaoEntity | null, DomainError>>;
  findAll(empresaId: string, query: ListRegioesQueryDTO): Promise<Result<{ data: Array<RegiaoEntity & { placasCount?: number }>, total: number }, DomainError>>;
  update(id: string, data: UpdateRegiaoDTO, empresaId: string): Promise<Result<RegiaoEntity, DomainError>>;
  delete(id: string, empresaId: string): Promise<Result<void, DomainError>>;
  exists(id: string, empresaId: string): Promise<Result<boolean, DomainError>>;
  countPlacas(regiaoId: string, empresaId: string): Promise<Result<number, DomainError>>;
}

export class RegiaoRepository implements IRegiaoRepository {
  
  /**
   * Cria uma nova região
   */
  async create(
    data: CreateRegiaoDTO & { empresaId: string }
  ): Promise<Result<RegiaoEntity, DomainError>> {
    try {
      const regiao = new Regiao(data);
      await regiao.save();
      
      Log.info('[RegiaoRepository] Região criada', { 
        regiaoId: regiao._id,
        nome: regiao.nome,
        empresaId: data.empresaId 
      });

      return Result.ok(regiao.toObject() as RegiaoEntity);

    } catch (error) {
      // Mongoose duplicate key error
      if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
        const field = 'keyPattern' in error && error.keyPattern && typeof error.keyPattern === 'object'
          ? Object.keys(error.keyPattern)[0] || 'desconhecido'
          : 'nome';
        
        Log.warn('[RegiaoRepository] Tentativa de criar região duplicada', { field });
        return Result.fail(new DuplicateKeyError(field));
      }

      const domainError = toDomainError(error);
      Log.error('[RegiaoRepository] Erro ao criar região', { 
        error: domainError.message
      });
      
      return Result.fail(new DatabaseError('create', domainError.message));
    }
  }

  /**
   * Busca região por ID
   */
  async findById(
    id: string, 
    empresaId: string
  ): Promise<Result<RegiaoEntity | null, DomainError>> {
    try {
      const regiao = await Regiao.findOne({ _id: id, empresaId }).lean();
      
      if (!regiao) {
        return Result.ok(null);
      }

      return Result.ok(regiao as unknown as RegiaoEntity);

    } catch (error) {
      const domainError = toDomainError(error);
      Log.error('[RegiaoRepository] Erro ao buscar região', { 
        error: domainError.message,
        regiaoId: id,
        empresaId 
      });
      
      return Result.fail(new DatabaseError('findById', domainError.message));
    }
  }

  /**
   * Lista regiões com filtros e paginação
   */
  async findAll(
    empresaId: string,
    query: ListRegioesQueryDTO
  ): Promise<Result<{ data: Array<RegiaoEntity & { placasCount?: number }>, total: number }, DomainError>> {
    try {
      const { page, limit, sortBy, order, ativo, search } = query;

      // Construir filtro
      const filter: FilterQuery<any> = { empresaId };
      
      if (ativo !== undefined) {
        filter.ativo = ativo;
      }
      
      if (search) {
        filter.$or = [
          { nome: { $regex: search, $options: 'i' } },
          { codigo: { $regex: search, $options: 'i' } }
        ];
      }

      // Executar queries em paralelo
      const skip = (page - 1) * limit;
      const sortOrder = order === 'desc' ? -1 : 1;

      const [regioes, total] = await Promise.all([
        Regiao.find(filter)
          .sort({ [sortBy]: sortOrder })
          .skip(skip)
          .limit(limit)
          .lean(),
        Regiao.countDocuments(filter)
      ]);

      // Enriquecer com contagem de placas
      const regioesComPlacas = await Promise.all(
        regioes.map(async (regiao) => {
          const placasCount = await Placa.countDocuments({ 
            regiaoId: regiao._id,
            empresaId 
          });
          return {
            ...regiao,
            placasCount
          } as RegiaoEntity & { placasCount: number };
        })
      );

      return Result.ok({
        data: regioesComPlacas,
        total
      });

    } catch (error) {
      const domainError = toDomainError(error);
      Log.error('[RegiaoRepository] Erro ao listar regiões', { 
        error: domainError.message,
        empresaId 
      });
      
      return Result.fail(new DatabaseError('findAll', domainError.message));
    }
  }

  /**
   * Atualiza região
   */
  async update(
    id: string,
    data: UpdateRegiaoDTO,
    empresaId: string
  ): Promise<Result<RegiaoEntity, DomainError>> {
    try {
      const regiao = await Regiao.findOneAndUpdate(
        { _id: id, empresaId },
        { $set: data },
        { new: true, runValidators: true }
      ).lean();

      if (!regiao) {
        return Result.fail(new RegiaoNotFoundError(id));
      }

      Log.info('[RegiaoRepository] Região atualizada', { 
        regiaoId: id,
        empresaId 
      });

      return Result.ok(regiao as unknown as RegiaoEntity);

    } catch (error) {
      // Duplicate key error
      if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
        const field = 'keyPattern' in error && error.keyPattern && typeof error.keyPattern === 'object'
          ? Object.keys(error.keyPattern)[0] || 'desconhecido'
          : 'nome';
        
        Log.warn('[RegiaoRepository] Tentativa de atualizar para nome duplicado', { field });
        return Result.fail(new DuplicateKeyError(field));
      }

      const domainError = toDomainError(error);
      Log.error('[RegiaoRepository] Erro ao atualizar região', { 
        error: domainError.message,
        regiaoId: id,
        empresaId 
      });
      
      return Result.fail(new DatabaseError('update', domainError.message));
    }
  }

  /**
   * Deleta região
   */
  async delete(
    id: string,
    empresaId: string
  ): Promise<Result<void, DomainError>> {
    try {
      const result = await Regiao.deleteOne({ _id: id, empresaId });

      if (result.deletedCount === 0) {
        return Result.fail(new RegiaoNotFoundError(id));
      }

      Log.info('[RegiaoRepository] Região deletada', { 
        regiaoId: id,
        empresaId 
      });

      return Result.ok(undefined);

    } catch (error) {
      const domainError = toDomainError(error);
      Log.error('[RegiaoRepository] Erro ao deletar região', { 
        error: domainError.message,
        regiaoId: id,
        empresaId 
      });
      
      return Result.fail(new DatabaseError('delete', domainError.message));
    }
  }

  /**
   * Verifica se região existe
   */
  async exists(
    id: string,
    empresaId: string
  ): Promise<Result<boolean, DomainError>> {
    try {
      const count = await Regiao.countDocuments({ _id: id, empresaId });
      return Result.ok(count > 0);

    } catch (error) {
      const domainError = toDomainError(error);
      Log.error('[RegiaoRepository] Erro ao verificar existência', { 
        error: domainError.message,
        regiaoId: id,
        empresaId 
      });
      
      return Result.fail(new DatabaseError('exists', domainError.message));
    }
  }

  /**
   * Conta placas de uma região
   */
  async countPlacas(
    regiaoId: string,
    empresaId: string
  ): Promise<Result<number, DomainError>> {
    try {
      const count = await Placa.countDocuments({ 
        regiaoId,
        empresaId 
      });
      return Result.ok(count);

    } catch (error) {
      const domainError = toDomainError(error);
      Log.error('[RegiaoRepository] Erro ao contar placas', { 
        error: domainError.message,
        regiaoId,
        empresaId 
      });
      
      return Result.fail(new DatabaseError('countPlacas', domainError.message));
    }
  }
}
