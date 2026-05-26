/**
 * Cliente Repository
 * Camada de acesso a dados com Result pattern
 */

import { FilterQuery } from 'mongoose';
import Cliente from '../Cliente';
import { Result, DomainError } from '@shared/core';
import { 
  DatabaseError, 
  ClienteNotFoundError,
  DuplicateKeyError,
  toDomainError
} from '@shared/core';
import { Log } from '@shared/core';
import type { 
  ClienteEntity, 
  CreateClienteDTO, 
  UpdateClienteDTO,
  ListClientesQueryDTO 
} from '../dtos/cliente.dto';

export interface IClienteRepository {
  create(data: CreateClienteDTO, empresaId: string): Promise<Result<ClienteEntity, DomainError>>;
  findById(id: string, empresaId: string): Promise<Result<ClienteEntity | null, DomainError>>;
  findAll(empresaId: string, query: ListClientesQueryDTO): Promise<Result<{ data: ClienteEntity[], total: number }, DomainError>>;
  update(id: string, data: UpdateClienteDTO, empresaId: string): Promise<Result<ClienteEntity, DomainError>>;
  delete(id: string, empresaId: string): Promise<Result<void, DomainError>>;
  exists(id: string, empresaId: string): Promise<Result<boolean, DomainError>>;
  countByEmpresa(empresaId: string): Promise<Result<number, DomainError>>;
}

export class ClienteRepository implements IClienteRepository {
  
  /**
   * Cria um novo cliente
   */
  async create(
    data: CreateClienteDTO, 
    empresaId: string
  ): Promise<Result<ClienteEntity, DomainError>> {
    try {
      const cliente = new Cliente({
        ...data,
        empresaId,
        ativo: data.ativo ?? true
      });

      await cliente.save();
      
      Log.info('[ClienteRepository] Cliente criado', { 
        clienteId: cliente._id,
        empresaId 
      });

      return Result.ok(cliente.toObject() as ClienteEntity);

    } catch (error) {
      // Mongoose duplicate key error
      if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
        const field = 'keyPattern' in error && error.keyPattern && typeof error.keyPattern === 'object'
          ? Object.keys(error.keyPattern)[0] || 'desconhecido'
          : 'desconhecido';
        
        Log.warn('[ClienteRepository] Tentativa de criar cliente duplicado', { field, empresaId });
        return Result.fail(new DuplicateKeyError(field));
      }

      const domainError = toDomainError(error);
      Log.error('[ClienteRepository] Erro ao criar cliente', { 
        error: domainError.message,
        empresaId 
      });
      
      return Result.fail(new DatabaseError('create', domainError.message));
    }
  }

  /**
   * Busca cliente por ID
   */
  async findById(
    id: string, 
    empresaId: string
  ): Promise<Result<ClienteEntity | null, DomainError>> {
    try {
      const cliente = await Cliente.findOne({ _id: id, empresaId }).lean();
      
      if (!cliente) {
        return Result.ok(null);
      }

      return Result.ok(cliente as unknown as ClienteEntity);

    } catch (error) {
      const domainError = toDomainError(error);
      Log.error('[ClienteRepository] Erro ao buscar cliente', { 
        error: domainError.message,
        clienteId: id,
        empresaId 
      });
      
      return Result.fail(new DatabaseError('findById', domainError.message));
    }
  }

  /**
   * Lista clientes com filtros e paginação
   */
  async findAll(
    empresaId: string,
    query: ListClientesQueryDTO
  ): Promise<Result<{ data: ClienteEntity[], total: number }, DomainError>> {
    try {
      const { page, limit, sortBy, order, search, ativo, cidade, estado } = query;

      // Construir filtro
      const filter: FilterQuery<any> = { empresaId };
      
      if (ativo !== undefined) {
        filter.ativo = ativo;
      }
      
      if (cidade) {
        filter.cidade = { $regex: cidade, $options: 'i' };
      }
      
      if (estado) {
        filter.estado = estado.toUpperCase();
      }
      
      if (search) {
        filter.$or = [
          { nome: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { cnpj: { $regex: search.replace(/\D/g, ''), $options: 'i' } },
          { cpf: { $regex: search.replace(/\D/g, ''), $options: 'i' } }
        ];
      }

      // Executar queries em paralelo
      const skip = (page - 1) * limit;
      const sortOrder = order === 'desc' ? -1 : 1;

      const [data, total] = await Promise.all([
        Cliente.find(filter)
          .sort({ [sortBy]: sortOrder })
          .skip(skip)
          .limit(limit)
          .lean(),
        Cliente.countDocuments(filter)
      ]);

      return Result.ok({
        data: data as unknown as ClienteEntity[],
        total
      });

    } catch (error) {
      const domainError = toDomainError(error);
      Log.error('[ClienteRepository] Erro ao listar clientes', { 
        error: domainError.message,
        empresaId 
      });
      
      return Result.fail(new DatabaseError('findAll', domainError.message));
    }
  }

  /**
   * Atualiza cliente
   */
  async update(
    id: string,
    data: UpdateClienteDTO,
    empresaId: string
  ): Promise<Result<ClienteEntity, DomainError>> {
    try {
      const cliente = await Cliente.findOneAndUpdate(
        { _id: id, empresaId },
        { $set: data },
        { new: true, runValidators: true }
      ).lean();

      if (!cliente) {
        return Result.fail(new ClienteNotFoundError(id));
      }

      Log.info('[ClienteRepository] Cliente atualizado', { 
        clienteId: id,
        empresaId 
      });

      return Result.ok(cliente as unknown as ClienteEntity);

    } catch (error) {
      // Duplicate key error
      if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
        const field = 'keyPattern' in error && error.keyPattern && typeof error.keyPattern === 'object'
          ? Object.keys(error.keyPattern)[0] || 'desconhecido'
          : 'desconhecido';
        
        return Result.fail(new DuplicateKeyError(field));
      }

      const domainError = toDomainError(error);
      Log.error('[ClienteRepository] Erro ao atualizar cliente', { 
        error: domainError.message,
        clienteId: id,
        empresaId 
      });
      
      return Result.fail(new DatabaseError('update', domainError.message));
    }
  }

  /**
   * Deleta cliente
   */
  async delete(
    id: string,
    empresaId: string
  ): Promise<Result<void, DomainError>> {
    try {
      const result = await Cliente.deleteOne({ _id: id, empresaId });

      if (result.deletedCount === 0) {
        return Result.fail(new ClienteNotFoundError(id));
      }

      Log.info('[ClienteRepository] Cliente deletado', { 
        clienteId: id,
        empresaId 
      });

      return Result.ok(undefined);

    } catch (error) {
      const domainError = toDomainError(error);
      Log.error('[ClienteRepository] Erro ao deletar cliente', { 
        error: domainError.message,
        clienteId: id,
        empresaId 
      });
      
      return Result.fail(new DatabaseError('delete', domainError.message));
    }
  }

  /**
   * Verifica se cliente existe
   */
  async exists(
    id: string,
    empresaId: string
  ): Promise<Result<boolean, DomainError>> {
    try {
      const count = await Cliente.countDocuments({ _id: id, empresaId });
      return Result.ok(count > 0);

    } catch (error) {
      const domainError = toDomainError(error);
      Log.error('[ClienteRepository] Erro ao verificar existência', { 
        error: domainError.message,
        clienteId: id,
        empresaId 
      });
      
      return Result.fail(new DatabaseError('exists', domainError.message));
    }
  }

  /**
   * Conta clientes por empresa
   */
  async countByEmpresa(empresaId: string): Promise<Result<number, DomainError>> {
    try {
      const count = await Cliente.countDocuments({ empresaId });
      return Result.ok(count);

    } catch (error) {
      const domainError = toDomainError(error);
      Log.error('[ClienteRepository] Erro ao contar clientes', { 
        error: domainError.message,
        empresaId 
      });
      
      return Result.fail(new DatabaseError('countByEmpresa', domainError.message));
    }
  }
}
