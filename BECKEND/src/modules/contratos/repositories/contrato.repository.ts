/**
 * Contrato Repository
 * Camada de acesso a dados com Result pattern
 */

import { FilterQuery } from 'mongoose';
import Contrato from '../Contrato';
import { Result, DomainError } from '@shared/core';
import { 
  DatabaseError, 
  ContratoNotFoundError,
  DuplicateKeyError,
  toDomainError
} from '@shared/core';
import { Log } from '@shared/core';
import type { 
  ContratoEntity, 
  CreateContratoDTO, 
  UpdateContratoDTO,
  ListContratosQueryDTO 
} from '../dtos/contrato.dto';

export interface IContratoRepository {
  create(data: CreateContratoDTO & { clienteId: string; empresaId: string; numero: string }): Promise<Result<ContratoEntity, DomainError>>;
  findById(id: string, empresaId: string): Promise<Result<ContratoEntity | null, DomainError>>;
  findAll(empresaId: string, query: ListContratosQueryDTO): Promise<Result<{ data: ContratoEntity[], total: number }, DomainError>>;
  update(id: string, data: UpdateContratoDTO, empresaId: string): Promise<Result<ContratoEntity, DomainError>>;
  delete(id: string, empresaId: string): Promise<Result<void, DomainError>>;
  exists(id: string, empresaId: string): Promise<Result<boolean, DomainError>>;
  findByPiId(piId: string, empresaId: string): Promise<Result<ContratoEntity | null, DomainError>>;
}

export class ContratoRepository implements IContratoRepository {
  
  /**
   * Cria um novo contrato
   */
  async create(
    data: CreateContratoDTO & { clienteId: string; empresaId: string; numero: string }
  ): Promise<Result<ContratoEntity, DomainError>> {
    try {
      const contrato = new Contrato({
        ...data,
        status: 'rascunho'
      });

      await contrato.save();
      await contrato.populate([
        { path: 'clienteId', select: 'nome' },
        { path: 'piId', select: 'valorTotal dataInicio dataFim' }
      ]);
      
      Log.info('[ContratoRepository] Contrato criado', { 
        contratoId: contrato._id,
        numero: contrato.numero,
        empresaId: data.empresaId 
      });

      return Result.ok(contrato.toObject() as ContratoEntity);

    } catch (error) {
      // Mongoose duplicate key error
      if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
        const field = 'keyPattern' in error && error.keyPattern && typeof error.keyPattern === 'object'
          ? Object.keys(error.keyPattern)[0] || 'desconhecido'
          : 'desconhecido';
        
        Log.warn('[ContratoRepository] Tentativa de criar contrato duplicado', { field });
        return Result.fail(new DuplicateKeyError(field));
      }

      const domainError = toDomainError(error);
      Log.error('[ContratoRepository] Erro ao criar contrato', { 
        error: domainError.message
      });
      
      return Result.fail(new DatabaseError('create', domainError.message));
    }
  }

  /**
   * Busca contrato por ID
   */
  async findById(
    id: string, 
    empresaId: string
  ): Promise<Result<ContratoEntity | null, DomainError>> {
    try {
      const contrato = await Contrato.findOne({ _id: id, empresaId })
        .populate('clienteId', 'nome')
        .populate('piId')
        .lean();
      
      if (!contrato) {
        return Result.ok(null);
      }

      return Result.ok(contrato as unknown as ContratoEntity);

    } catch (error) {
      const domainError = toDomainError(error);
      Log.error('[ContratoRepository] Erro ao buscar contrato', { 
        error: domainError.message,
        contratoId: id,
        empresaId 
      });
      
      return Result.fail(new DatabaseError('findById', domainError.message));
    }
  }

  /**
   * Lista contratos com filtros e paginação
   */
  async findAll(
    empresaId: string,
    query: ListContratosQueryDTO
  ): Promise<Result<{ data: ContratoEntity[], total: number }, DomainError>> {
    try {
      const { page, limit, sortBy, order, status, clienteId } = query;

      // Construir filtro
      const filter: FilterQuery<any> = { empresaId };
      
      if (status) {
        filter.status = status;
      }
      
      if (clienteId) {
        filter.clienteId = clienteId;
      }

      // Executar queries em paralelo
      const skip = (page - 1) * limit;
      const sortOrder = order === 'desc' ? -1 : 1;

      const [data, total] = await Promise.all([
        Contrato.find(filter)
          .populate('clienteId', 'nome')
          .populate('piId', 'valorTotal')
          .sort({ [sortBy]: sortOrder })
          .skip(skip)
          .limit(limit)
          .lean(),
        Contrato.countDocuments(filter)
      ]);

      return Result.ok({
        data: data as unknown as ContratoEntity[],
        total
      });

    } catch (error) {
      const domainError = toDomainError(error);
      Log.error('[ContratoRepository] Erro ao listar contratos', { 
        error: domainError.message,
        empresaId 
      });
      
      return Result.fail(new DatabaseError('findAll', domainError.message));
    }
  }

  /**
   * Atualiza contrato
   */
  async update(
    id: string,
    data: UpdateContratoDTO,
    empresaId: string
  ): Promise<Result<ContratoEntity, DomainError>> {
    try {
      const contrato = await Contrato.findOneAndUpdate(
        { _id: id, empresaId },
        { $set: data },
        { new: true, runValidators: true }
      )
      .populate('clienteId', 'nome')
      .populate('piId')
      .lean();

      if (!contrato) {
        return Result.fail(new ContratoNotFoundError(id));
      }

      Log.info('[ContratoRepository] Contrato atualizado', { 
        contratoId: id,
        empresaId 
      });

      return Result.ok(contrato as unknown as ContratoEntity);

    } catch (error) {
      const domainError = toDomainError(error);
      Log.error('[ContratoRepository] Erro ao atualizar contrato', { 
        error: domainError.message,
        contratoId: id,
        empresaId 
      });
      
      return Result.fail(new DatabaseError('update', domainError.message));
    }
  }

  /**
   * Deleta contrato
   */
  async delete(
    id: string,
    empresaId: string
  ): Promise<Result<void, DomainError>> {
    try {
      const result = await Contrato.deleteOne({ _id: id, empresaId });

      if (result.deletedCount === 0) {
        return Result.fail(new ContratoNotFoundError(id));
      }

      Log.info('[ContratoRepository] Contrato deletado', { 
        contratoId: id,
        empresaId 
      });

      return Result.ok(undefined);

    } catch (error) {
      const domainError = toDomainError(error);
      Log.error('[ContratoRepository] Erro ao deletar contrato', { 
        error: domainError.message,
        contratoId: id,
        empresaId 
      });
      
      return Result.fail(new DatabaseError('delete', domainError.message));
    }
  }

  /**
   * Verifica se contrato existe
   */
  async exists(
    id: string,
    empresaId: string
  ): Promise<Result<boolean, DomainError>> {
    try {
      const count = await Contrato.countDocuments({ _id: id, empresaId });
      return Result.ok(count > 0);

    } catch (error) {
      const domainError = toDomainError(error);
      Log.error('[ContratoRepository] Erro ao verificar existência', { 
        error: domainError.message,
        contratoId: id,
        empresaId 
      });
      
      return Result.fail(new DatabaseError('exists', domainError.message));
    }
  }

  /**
   * Busca contrato por PI ID
   */
  async findByPiId(
    piId: string,
    empresaId: string
  ): Promise<Result<ContratoEntity | null, DomainError>> {
    try {
      const contrato = await Contrato.findOne({ piId, empresaId })
        .populate('clienteId', 'nome')
        .populate('piId')
        .lean();
      
      if (!contrato) {
        return Result.ok(null);
      }

      return Result.ok(contrato as unknown as ContratoEntity);

    } catch (error) {
      const domainError = toDomainError(error);
      Log.error('[ContratoRepository] Erro ao buscar contrato por PI', { 
        error: domainError.message,
        piId,
        empresaId 
      });
      
      return Result.fail(new DatabaseError('findByPiId', domainError.message));
    }
  }
}
