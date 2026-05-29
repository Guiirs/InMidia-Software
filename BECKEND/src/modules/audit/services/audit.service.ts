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
  log(data: CreateAuditLogInput, empresaId: string): Promise<Result<AuditLogEntity, DomainError>>;
  getLogById(id: string, empresaId?: string, isSuperadmin?: boolean): Promise<Result<AuditLogEntity | null, DomainError>>;
  listLogs(query: ListAuditLogsQuery, empresaId?: string, isSuperadmin?: boolean): Promise<Result<PaginatedAuditLogsResponse, DomainError>>;
  getLogsByResourceId(resourceId: string, empresaId?: string, isSuperadmin?: boolean): Promise<Result<AuditLogEntity[], DomainError>>;
}

export class AuditService implements IAuditService {
  constructor(private readonly repository: IAuditRepository) {}

  /**
   * Cria um log de auditoria
   */
  async log(data: CreateAuditLogInput, empresaId: string): Promise<Result<AuditLogEntity, DomainError>> {
    return await this.repository.create(data, empresaId);
  }

  /**
   * Busca um log específico por ID
   */
  async getLogById(id: string, empresaId?: string, isSuperadmin = false): Promise<Result<AuditLogEntity | null, DomainError>> {
    return await this.repository.findById(id, empresaId, isSuperadmin);
  }

  /**
   * Lista logs com filtros e paginação
   */
  async listLogs(query: ListAuditLogsQuery, empresaId?: string, isSuperadmin = false): Promise<Result<PaginatedAuditLogsResponse, DomainError>> {
    return await this.repository.list(query, empresaId, isSuperadmin);
  }

  /**
   * Busca todos os logs relacionados a um resource específico
   */
  async getLogsByResourceId(resourceId: string, empresaId?: string, isSuperadmin = false): Promise<Result<AuditLogEntity[], DomainError>> {
    return await this.repository.findByResourceId(resourceId, empresaId, isSuperadmin);
  }
}
