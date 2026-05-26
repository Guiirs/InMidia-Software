/**
 * Aluguel Repository
 * Camada de acesso a dados com Result pattern
 */

import { FilterQuery } from 'mongoose';
import Aluguel from '../Aluguel';
import { Result, DomainError } from '@shared/core';
import { 
  DatabaseError, 
  AluguelNotFoundError,
  toDomainError
} from '@shared/core';
import { Log } from '@shared/core';
import type { 
  AluguelEntity, 
  CreateAluguelDTO, 
  UpdateAluguelDTO,
  ListAlugueisQueryDTO,
  CheckDisponibilidadeAluguelDTO
} from '../dtos/aluguel.dto';

export interface IAluguelRepository {
  create(data: CreateAluguelDTO & { empresaId: string }): Promise<Result<AluguelEntity, DomainError>>;
  findById(id: string, empresaId: string): Promise<Result<AluguelEntity | null, DomainError>>;
  findAll(empresaId: string, query: ListAlugueisQueryDTO): Promise<Result<{ data: AluguelEntity[], total: number }, DomainError>>;
  update(id: string, data: UpdateAluguelDTO, empresaId: string): Promise<Result<AluguelEntity, DomainError>>;
  delete(id: string, empresaId: string): Promise<Result<void, DomainError>>;
  exists(id: string, empresaId: string): Promise<Result<boolean, DomainError>>;
  findOverlapping(check: CheckDisponibilidadeAluguelDTO, empresaId: string): Promise<Result<AluguelEntity[], DomainError>>;
  countByPlaca(placaId: string, empresaId: string): Promise<Result<number, DomainError>>;
  countByCliente(clienteId: string, empresaId: string): Promise<Result<number, DomainError>>;
}

export class AluguelRepository implements IAluguelRepository {
  
  /**
   * Cria um novo aluguel
   */
  async create(
    data: CreateAluguelDTO & { empresaId: string }
  ): Promise<Result<AluguelEntity, DomainError>> {
    try {
      const aluguel = new Aluguel(data);
      await aluguel.save();
      await aluguel.populate([
        { path: 'placaId', select: 'numero_placa' },
        { path: 'clienteId', select: 'nome' }
      ]);
      
      Log.info('[AluguelRepository] Aluguel criado', { 
        aluguelId: aluguel._id,
        placaId: data.placaId,
        empresaId: data.empresaId 
      });

      return Result.ok(aluguel.toObject() as AluguelEntity);

    } catch (error) {
      const domainError = toDomainError(error);
      Log.error('[AluguelRepository] Erro ao criar aluguel', { 
        error: domainError.message
      });
      
      return Result.fail(new DatabaseError('create', domainError.message));
    }
  }

  /**
   * Busca aluguel por ID
   */
  async findById(
    id: string, 
    empresaId: string
  ): Promise<Result<AluguelEntity | null, DomainError>> {
    try {
      const aluguel = await Aluguel.findOne({ _id: id, empresaId })
        .populate('placaId', 'numero_placa')
        .populate('clienteId', 'nome')
        .lean();
      
      if (!aluguel) {
        return Result.ok(null);
      }

      return Result.ok(aluguel as unknown as AluguelEntity);

    } catch (error) {
      const domainError = toDomainError(error);
      Log.error('[AluguelRepository] Erro ao buscar aluguel', { 
        error: domainError.message,
        aluguelId: id,
        empresaId 
      });
      
      return Result.fail(new DatabaseError('findById', domainError.message));
    }
  }

  /**
   * Lista aluguéis com filtros e paginação
   */
  async findAll(
    empresaId: string,
    query: ListAlugueisQueryDTO
  ): Promise<Result<{ data: AluguelEntity[], total: number }, DomainError>> {
    try {
      const { page, limit, sortBy, order, status, placaId, clienteId, tipo } = query;

      // Construir filtro
      const filter: FilterQuery<any> = { empresaId };
      
      if (status) {
        filter.status = status;
      }
      
      if (placaId) {
        filter.placaId = placaId;
      }
      
      if (clienteId) {
        filter.clienteId = clienteId;
      }
      
      if (tipo) {
        filter.tipo = tipo;
      }

      // Executar queries em paralelo
      const skip = (page - 1) * limit;
      const sortOrder = order === 'desc' ? -1 : 1;

      const [data, total] = await Promise.all([
        Aluguel.find(filter)
          .populate('placaId', 'numero_placa')
          .populate('clienteId', 'nome')
          .sort({ [sortBy]: sortOrder })
          .skip(skip)
          .limit(limit)
          .lean(),
        Aluguel.countDocuments(filter)
      ]);

      return Result.ok({
        data: data as unknown as AluguelEntity[],
        total
      });

    } catch (error) {
      const domainError = toDomainError(error);
      Log.error('[AluguelRepository] Erro ao listar aluguéis', { 
        error: domainError.message,
        empresaId 
      });
      
      return Result.fail(new DatabaseError('findAll', domainError.message));
    }
  }

  /**
   * Atualiza aluguel
   */
  async update(
    id: string,
    data: UpdateAluguelDTO,
    empresaId: string
  ): Promise<Result<AluguelEntity, DomainError>> {
    try {
      const aluguel = await Aluguel.findOneAndUpdate(
        { _id: id, empresaId },
        { $set: data },
        { new: true, runValidators: true }
      )
      .populate('placaId', 'numero_placa')
      .populate('clienteId', 'nome')
      .lean();

      if (!aluguel) {
        return Result.fail(new AluguelNotFoundError(id));
      }

      Log.info('[AluguelRepository] Aluguel atualizado', { 
        aluguelId: id,
        empresaId 
      });

      return Result.ok(aluguel as unknown as AluguelEntity);

    } catch (error) {
      const domainError = toDomainError(error);
      Log.error('[AluguelRepository] Erro ao atualizar aluguel', { 
        error: domainError.message,
        aluguelId: id,
        empresaId 
      });
      
      return Result.fail(new DatabaseError('update', domainError.message));
    }
  }

  /**
   * Deleta aluguel
   */
  async delete(
    id: string,
    empresaId: string
  ): Promise<Result<void, DomainError>> {
    try {
      const result = await Aluguel.deleteOne({ _id: id, empresaId });

      if (result.deletedCount === 0) {
        return Result.fail(new AluguelNotFoundError(id));
      }

      Log.info('[AluguelRepository] Aluguel deletado', { 
        aluguelId: id,
        empresaId 
      });

      return Result.ok(undefined);

    } catch (error) {
      const domainError = toDomainError(error);
      Log.error('[AluguelRepository] Erro ao deletar aluguel', { 
        error: domainError.message,
        aluguelId: id,
        empresaId 
      });
      
      return Result.fail(new DatabaseError('delete', domainError.message));
    }
  }

  /**
   * Verifica se aluguel existe
   */
  async exists(
    id: string,
    empresaId: string
  ): Promise<Result<boolean, DomainError>> {
    try {
      const count = await Aluguel.countDocuments({ _id: id, empresaId });
      return Result.ok(count > 0);

    } catch (error) {
      const domainError = toDomainError(error);
      Log.error('[AluguelRepository] Erro ao verificar existência', { 
        error: domainError.message,
        aluguelId: id,
        empresaId 
      });
      
      return Result.fail(new DatabaseError('exists', domainError.message));
    }
  }

  /**
   * Busca aluguéis que se sobrepõem ao período informado
   */
  async findOverlapping(
    check: CheckDisponibilidadeAluguelDTO,
    empresaId: string
  ): Promise<Result<AluguelEntity[], DomainError>> {
    try {
      const { placaId, startDate, endDate, excludeAluguelId } = check;

      // Query de sobreposição:
      // Um aluguel se sobrepõe se:
      // - startDate < existente.endDate E endDate > existente.startDate
      const filter: FilterQuery<any> = {
        empresaId,
        placaId,
        status: { $in: ['ativo'] }, // Apenas aluguéis ativos podem conflitar
        $or: [
          {
            // Sobrepõe com startDate
            startDate: { $lt: endDate },
            endDate: { $gt: startDate }
          },
          {
            // Sobrepõe com data_inicio (legado)
            data_inicio: { $lt: endDate },
            data_fim: { $gt: startDate }
          }
        ]
      };

      // Excluir aluguel específico (usado em updates)
      if (excludeAluguelId) {
        filter._id = { $ne: excludeAluguelId };
      }

      const alugueis = await Aluguel.find(filter)
        .populate('clienteId', 'nome')
        .lean();

      return Result.ok(alugueis as unknown as AluguelEntity[]);

    } catch (error) {
      const domainError = toDomainError(error);
      Log.error('[AluguelRepository] Erro ao verificar sobreposição', { 
        error: domainError.message,
        empresaId 
      });
      
      return Result.fail(new DatabaseError('findOverlapping', domainError.message));
    }
  }

  /**
   * Conta aluguéis de uma placa
   */
  async countByPlaca(
    placaId: string,
    empresaId: string
  ): Promise<Result<number, DomainError>> {
    try {
      const count = await Aluguel.countDocuments({ 
        placaId, 
        empresaId,
        status: { $in: ['ativo', 'finalizado'] }
      });
      return Result.ok(count);

    } catch (error) {
      const domainError = toDomainError(error);
      Log.error('[AluguelRepository] Erro ao contar aluguéis por placa', { 
        error: domainError.message,
        placaId,
        empresaId 
      });
      
      return Result.fail(new DatabaseError('countByPlaca', domainError.message));
    }
  }

  /**
   * Conta aluguéis de um cliente
   */
  async countByCliente(
    clienteId: string,
    empresaId: string
  ): Promise<Result<number, DomainError>> {
    try {
      const count = await Aluguel.countDocuments({ 
        clienteId, 
        empresaId,
        status: { $in: ['ativo', 'finalizado'] }
      });
      return Result.ok(count);

    } catch (error) {
      const domainError = toDomainError(error);
      Log.error('[AluguelRepository] Erro ao contar aluguéis por cliente', { 
        error: domainError.message,
        clienteId,
        empresaId 
      });
      
      return Result.fail(new DatabaseError('countByCliente', domainError.message));
    }
  }
}
