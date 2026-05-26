/**
 * Audit Repository
 * Camada de acesso a dados para logs de auditoria
 */

import { Model, FilterQuery } from 'mongoose';
import { Result, DomainError, ValidationError } from '@shared/core';
import type { IAuditLog } from '../AuditLog';
import type { CreateAuditLogInput, ListAuditLogsQuery, AuditLogEntity, PaginatedAuditLogsResponse } from '../dtos/audit.dto';

export interface IAuditRepository {
  create(data: CreateAuditLogInput): Promise<Result<AuditLogEntity, DomainError>>;
  findById(id: string): Promise<Result<AuditLogEntity | null, DomainError>>;
  list(query: ListAuditLogsQuery): Promise<Result<PaginatedAuditLogsResponse, DomainError>>;
  findByResourceId(resourceId: string): Promise<Result<AuditLogEntity[], DomainError>>;
}

export class AuditRepository implements IAuditRepository {
  constructor(private readonly model: Model<IAuditLog>) {}

  async create(data: CreateAuditLogInput): Promise<Result<AuditLogEntity, DomainError>> {
    try {
      const changes = {
        old: data.oldData,
        new: data.newData,
      };

      const auditLog = new this.model({
        user: data.userId,
        action: data.action,
        resource: data.resource,
        resourceId: data.resourceId,
        changes,
        ip: data.ip || 'unknown',
      });

      await auditLog.save();
      
      return Result.ok(auditLog.toObject<AuditLogEntity>());
    } catch (error: any) {
      return Result.fail(
        new ValidationError([{ field: 'geral', message: 'Erro ao criar log de auditoria' }])
      );
    }
  }

  async findById(id: string): Promise<Result<AuditLogEntity | null, DomainError>> {
    try {
      const log = await this.model
        .findById(id)
        .populate('user', 'nome email')
        .lean<AuditLogEntity | null>()
        .exec();

      return Result.ok(log);
    } catch (error: any) {
      return Result.fail(
        new ValidationError([{ field: 'geral', message: 'Erro ao buscar log de auditoria' }])
      );
    }
  }

  async list(query: ListAuditLogsQuery): Promise<Result<PaginatedAuditLogsResponse, DomainError>> {
    try {
      const page = query.page || 1;
      const limit = query.limit || 50;
      const skip = (page - 1) * limit;

      // Construir filtros
      const filter: FilterQuery<IAuditLog> = {};

      if (query.userId) {
        filter.user = query.userId;
      }

      if (query.action) {
        filter.action = query.action;
      }

      if (query.resource) {
        filter.resource = query.resource;
      }

      if (query.resourceId) {
        filter.resourceId = query.resourceId;
      }

      if (query.startDate || query.endDate) {
        filter.timestamp = {};
        if (query.startDate) {
          filter.timestamp.$gte = new Date(query.startDate);
        }
        if (query.endDate) {
          filter.timestamp.$lte = new Date(query.endDate);
        }
      }

      // Buscar logs e total
      const [logs, total] = await Promise.all([
        this.model
          .find(filter)
          .populate('user', 'nome email')
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(limit)
          .lean<AuditLogEntity[]>()
          .exec(),
        this.model.countDocuments(filter).exec(),
      ]);

      const response: PaginatedAuditLogsResponse = {
        logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };

      return Result.ok(response);
    } catch (error: any) {
      return Result.fail(
        new ValidationError([{ field: 'geral', message: 'Erro ao listar logs de auditoria' }])
      );
    }
  }

  async findByResourceId(resourceId: string): Promise<Result<AuditLogEntity[], DomainError>> {
    try {
      const logs = await this.model
        .find({ resourceId })
        .populate('user', 'nome email')
        .sort({ timestamp: -1 })
        .lean<AuditLogEntity[]>()
        .exec();

      return Result.ok(logs);
    } catch (error: any) {
      return Result.fail(
        new ValidationError([{ field: 'geral', message: 'Erro ao buscar logs por resource ID' }])
      );
    }
  }
}
