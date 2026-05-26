/**
 * Checking Repository
 * Camada de acesso a dados para checkings/vistorias
 */

import { Model, FilterQuery } from 'mongoose';
import { Result, DomainError, NotFoundError, ValidationError } from '@shared/core';
import type { IChecking } from '../Checking';
import type { CreateCheckingInput, UpdateCheckingInput, ListCheckingsQuery, CheckingEntity } from '../dtos/checking.dto';

export class CheckingNotFoundError extends NotFoundError {
  constructor(checkingId: string) {
    super(`Checking com ID ${checkingId} não encontrado`);
  }
}

export interface ICheckingRepository {
  create(data: CreateCheckingInput): Promise<Result<CheckingEntity, DomainError>>;
  findById(id: string): Promise<Result<CheckingEntity | null, DomainError>>;
  update(id: string, data: UpdateCheckingInput): Promise<Result<CheckingEntity, DomainError>>;
  findByAluguelId(aluguelId: string): Promise<Result<CheckingEntity[], DomainError>>;
  list(query: ListCheckingsQuery): Promise<Result<CheckingEntity[], DomainError>>;
}

export class CheckingRepository implements ICheckingRepository {
  constructor(private readonly model: Model<IChecking>) {}

  async create(data: CreateCheckingInput): Promise<Result<CheckingEntity, DomainError>> {
    try {
      const checking = new this.model({
        aluguelId: data.aluguelId,
        placaId: data.placaId,
        installerId: data.installerId,
        photoUrl: data.photoUrl,
        gpsCoordinates: data.gpsCoordinates,
      });

      await checking.save();
      await checking.populate('aluguelId placaId installerId');

      return Result.ok(checking.toObject<CheckingEntity>());
    } catch (error: any) {
      if (error.name === 'ValidationError') {
        const firstError = Object.values(error.errors)[0] as any;
        return Result.fail(
          new ValidationError([{
            field: firstError.path || 'geral',
            message: firstError.message,
          }])
        );
      }

      return Result.fail(
        new ValidationError([{ field: 'geral', message: 'Erro ao criar checking' }])
      );
    }
  }

  async findById(id: string): Promise<Result<CheckingEntity | null, DomainError>> {
    try {
      const checking = await this.model
        .findById(id)
        .populate('aluguelId', 'numero_contrato')
        .populate('placaId', 'numero_placa')
        .populate('installerId', 'nome email')
        .lean<CheckingEntity | null>()
        .exec();

      return Result.ok(checking);
    } catch (error: any) {
      return Result.fail(
        new ValidationError([{ field: 'geral', message: 'Erro ao buscar checking' }])
      );
    }
  }

  async update(id: string, data: UpdateCheckingInput): Promise<Result<CheckingEntity, DomainError>> {
    try {
      const checking = await this.model
        .findByIdAndUpdate(id, data, { new: true, runValidators: true })
        .populate('aluguelId', 'numero_contrato')
        .populate('placaId', 'numero_placa')
        .populate('installerId', 'nome email')
        .lean<CheckingEntity | null>()
        .exec();

      if (!checking) {
        return Result.fail(new CheckingNotFoundError(id));
      }

      return Result.ok(checking);
    } catch (error: any) {
      if (error.name === 'ValidationError') {
        const firstError = Object.values(error.errors)[0] as any;
        return Result.fail(
          new ValidationError([{
            field: firstError.path || 'geral',
            message: firstError.message,
          }])
        );
      }

      return Result.fail(
        new ValidationError([{ field: 'geral', message: 'Erro ao atualizar checking' }])
      );
    }
  }

  async findByAluguelId(aluguelId: string): Promise<Result<CheckingEntity[], DomainError>> {
    try {
      const checkings = await this.model
        .find({ aluguelId })
        .populate('aluguelId', 'numero_contrato')
        .populate('placaId', 'numero_placa')
        .populate('installerId', 'nome email')
        .sort({ installedAt: -1 })
        .lean<CheckingEntity[]>()
        .exec();

      return Result.ok(checkings);
    } catch (error: any) {
      return Result.fail(
        new ValidationError([{ field: 'geral', message: 'Erro ao buscar checkings por aluguel' }])
      );
    }
  }

  async list(query: ListCheckingsQuery): Promise<Result<CheckingEntity[], DomainError>> {
    try {
      const filter: FilterQuery<IChecking> = {};

      if (query.aluguelId) {
        filter.aluguelId = query.aluguelId;
      }

      if (query.placaId) {
        filter.placaId = query.placaId;
      }

      if (query.installerId) {
        filter.installerId = query.installerId;
      }

      if (query.startDate || query.endDate) {
        filter.installedAt = {};
        if (query.startDate) {
          filter.installedAt.$gte = new Date(query.startDate);
        }
        if (query.endDate) {
          filter.installedAt.$lte = new Date(query.endDate);
        }
      }

      const checkings = await this.model
        .find(filter)
        .populate('aluguelId', 'numero_contrato')
        .populate('placaId', 'numero_placa')
        .populate('installerId', 'nome email')
        .sort({ installedAt: -1 })
        .lean<CheckingEntity[]>()
        .exec();

      return Result.ok(checkings);
    } catch (error: any) {
      return Result.fail(
        new ValidationError([{ field: 'geral', message: 'Erro ao listar checkings' }])
      );
    }
  }
}
