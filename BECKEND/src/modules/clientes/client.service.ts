/**
 * Client V4.1 Service
 */

import { Result, DomainError, Log, toDomainError, ValidationError } from '@shared/core';
import type { IClientRepository } from './client.repository';
import {
  validateCreateClient,
  validateUpdateClient,
  validateListClientsQuery,
  validateSearchClientsQuery,
  type ClientEntity,
  type ClientSummary,
  type PaginatedClientsResponse,
  type ClientTimelineEvent,
} from './client.dto';

export class ClientService {
  constructor(private readonly repository: IClientRepository) {}

  async createClient(
    data: unknown,
    empresaId: string,
    userId?: string
  ): Promise<Result<ClientEntity, DomainError>> {
    try {
      const dto = validateCreateClient(data);
      return await this.repository.create(dto, empresaId, userId);
    } catch (error) {
      return this.handleZodOrDomain(error, '[ClientService] Erro ao criar cliente');
    }
  }

  async getClientById(
    id: string,
    empresaId: string
  ): Promise<Result<ClientEntity, DomainError>> {
    try {
      const result = await this.repository.findById(id, empresaId);
      if (result.isFailure) return Result.fail(result.error);
      if (!result.value) {
        const { ClienteNotFoundError } = await import('@shared/core');
        return Result.fail(new ClienteNotFoundError(id));
      }
      return Result.ok(result.value);
    } catch (error) {
      return this.handleZodOrDomain(error, '[ClientService] Erro ao buscar cliente');
    }
  }

  async listClients(
    empresaId: string,
    query: unknown
  ): Promise<Result<PaginatedClientsResponse, DomainError>> {
    try {
      const dto = validateListClientsQuery(query);
      return await this.repository.findAll(empresaId, dto);
    } catch (error) {
      return this.handleZodOrDomain(error, '[ClientService] Erro ao listar clientes');
    }
  }

  async updateClient(
    id: string,
    data: unknown,
    empresaId: string,
    userId?: string
  ): Promise<Result<ClientEntity, DomainError>> {
    try {
      const dto = validateUpdateClient(data);
      return await this.repository.update(id, dto, empresaId, userId);
    } catch (error) {
      return this.handleZodOrDomain(error, '[ClientService] Erro ao atualizar cliente');
    }
  }

  async archiveClient(
    id: string,
    empresaId: string,
    userId?: string
  ): Promise<Result<ClientEntity, DomainError>> {
    try {
      return await this.repository.archive(id, empresaId, userId);
    } catch (error) {
      return this.handleZodOrDomain(error, '[ClientService] Erro ao arquivar cliente');
    }
  }

  async restoreClient(
    id: string,
    empresaId: string,
    userId?: string
  ): Promise<Result<ClientEntity, DomainError>> {
    try {
      return await this.repository.restore(id, empresaId, userId);
    } catch (error) {
      return this.handleZodOrDomain(error, '[ClientService] Erro ao restaurar cliente');
    }
  }

  async searchClients(
    empresaId: string,
    query: unknown
  ): Promise<Result<ClientSummary[], DomainError>> {
    try {
      const dto = validateSearchClientsQuery(query);
      return await this.repository.search(empresaId, dto);
    } catch (error) {
      return this.handleZodOrDomain(error, '[ClientService] Erro ao buscar clientes');
    }
  }

  async getClientTimeline(
    id: string,
    empresaId: string
  ): Promise<Result<ClientTimelineEvent[], DomainError>> {
    try {
      return await this.repository.getTimeline(id, empresaId);
    } catch (error) {
      return this.handleZodOrDomain(error, '[ClientService] Erro ao buscar timeline');
    }
  }

  /** Helper for PI/Contrato integration — resolves a client reference by id */
  async resolveClient(
    id: string,
    empresaId: string
  ): Promise<Result<{ id: string; nome: string; documento?: string } | null, DomainError>> {
    return this.repository.resolveClient(id, empresaId);
  }

  private handleZodOrDomain<T>(error: unknown, ctx: string): Result<T, DomainError> {
    if (error instanceof Error && error.name === 'ZodError') {
      return Result.fail(new ValidationError([{ field: 'data', message: error.message }])) as Result<T, DomainError>;
    }
    Log.error(ctx, { error: toDomainError(error).message });
    return Result.fail(toDomainError(error)) as Result<T, DomainError>;
  }
}
