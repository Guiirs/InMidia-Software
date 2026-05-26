/**
 * Checking Service (Refatorado)
 * Logica de negocio para checkings/vistorias
 */

import { Result, DomainError } from '@shared/core';
import { auditService } from '@modules/audit';
import logger from '@shared/container/logger';
import type { ICheckingRepository } from '../repositories/checking.repository';
import type {
  CreateCheckingInput,
  UpdateCheckingInput,
  ListCheckingsQuery,
  CheckingEntity,
} from '../dtos/checking.dto';

export interface ICheckingService {
  createChecking(data: CreateCheckingInput): Promise<Result<CheckingEntity, DomainError>>;
  getCheckingById(id: string): Promise<Result<CheckingEntity | null, DomainError>>;
  updateChecking(id: string, data: UpdateCheckingInput): Promise<Result<CheckingEntity, DomainError>>;
  getCheckingsByAluguel(aluguelId: string): Promise<Result<CheckingEntity[], DomainError>>;
  listCheckings(query: ListCheckingsQuery): Promise<Result<CheckingEntity[], DomainError>>;
}

export class CheckingService implements ICheckingService {
  constructor(private readonly repository: ICheckingRepository) {}

  /**
   * Cria um novo checking e registra no audit log
   */
  async createChecking(data: CreateCheckingInput): Promise<Result<CheckingEntity, DomainError>> {
    const result = await this.repository.create(data);

    if (result.isSuccess && result.value) {
      // Log audit de forma assincrona
      auditService.log({
        userId: data.installerId,
        action: 'CREATE',
        resource: 'Checking',
        resourceId: result.value._id.toString(),
        newData: data,
      }).catch((err: any) => {
        logger.error('[CheckingService] Erro ao criar audit log:', err);
      });
    }

    return result;
  }

  /**
   * Busca checking por ID
   */
  async getCheckingById(id: string): Promise<Result<CheckingEntity | null, DomainError>> {
    return await this.repository.findById(id);
  }

  /**
   * Atualiza checking
   */
  async updateChecking(id: string, data: UpdateCheckingInput): Promise<Result<CheckingEntity, DomainError>> {
    // Buscar dados antigos para audit
    const oldDataResult = await this.repository.findById(id);

    const result = await this.repository.update(id, data);

    if (result.isSuccess && result.value && oldDataResult.isSuccess) {
      // Log audit de forma assincrona
      auditService.log({
        userId: result.value.installerId.toString(),
        action: 'UPDATE',
        resource: 'Checking',
        resourceId: id,
        oldData: oldDataResult.value,
        newData: data,
      }).catch((err: any) => {
        logger.error('[CheckingService] Erro ao criar audit log:', err);
      });
    }

    return result;
  }

  /**
   * Busca checkings de um aluguel especifico
   */
  async getCheckingsByAluguel(aluguelId: string): Promise<Result<CheckingEntity[], DomainError>> {
    return await this.repository.findByAluguelId(aluguelId);
  }

  /**
   * Lista checkings com filtros
   */
  async listCheckings(query: ListCheckingsQuery): Promise<Result<CheckingEntity[], DomainError>> {
    return await this.repository.list(query);
  }
}
