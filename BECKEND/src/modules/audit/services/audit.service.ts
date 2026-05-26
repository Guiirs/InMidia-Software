/**
 * Audit Service
 * Lógica de negócio para auditoria
 */

import { Result, DomainError } from '@shared/core';
import type { IAuditRepository } from '../repositories/audit.repository';
import type {
  CreateAuditLogInput,
  ListAuditLogsQuery,
  AuditLogEntity,
  PaginatedAuditLogsResponse,
} from '../dtos/audit.dto';

export interface IAuditService {
  log(data: CreateAuditLogInput): Promise<Result<AuditLogEntity, DomainError>>;
  getLogById(id: string): Promise<Result<AuditLogEntity | null, DomainError>>;
  listLogs(query: ListAuditLogsQuery): Promise<Result<PaginatedAuditLogsResponse, DomainError>>;
  getLogsByResourceId(resourceId: string): Promise<Result<AuditLogEntity[], DomainError>>;
}

export class AuditService implements IAuditService {
  constructor(private readonly repository: IAuditRepository) {}

  /**
   * Cria um log de auditoria
   */
  async log(data: CreateAuditLogInput): Promise<Result<AuditLogEntity, DomainError>> {
    return await this.repository.create(data);
  }

  /**
   * Busca um log específico por ID
   */
  async getLogById(id: string): Promise<Result<AuditLogEntity | null, DomainError>> {
    return await this.repository.findById(id);
  }

  /**
   * Lista logs com filtros e paginação
   */
  async listLogs(query: ListAuditLogsQuery): Promise<Result<PaginatedAuditLogsResponse, DomainError>> {
    return await this.repository.list(query);
  }

  /**
   * Busca todos os logs relacionados a um resource específico
   */
  async getLogsByResourceId(resourceId: string): Promise<Result<AuditLogEntity[], DomainError>> {
    return await this.repository.findByResourceId(resourceId);
  }
}
