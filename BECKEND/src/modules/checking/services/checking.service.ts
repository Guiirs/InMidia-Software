/**
 * Checking Service (Refatorado)
 * Logica de negocio para checkings/vistorias
 */

import { Result, DomainError, NotFoundError, ValidationError } from '@shared/core';
import { auditService } from '@modules/audit';
import logger from '@shared/container/logger';
import Aluguel from '@modules/alugueis/Aluguel';
import type { ICheckingRepository } from '../repositories/checking.repository';
import type {
  CreateCheckingInput,
  UpdateCheckingInput,
  ListCheckingsQuery,
  CheckingEntity,
  TenantCheckingInput,
} from '../dtos/checking.dto';

export interface ICheckingService {
  createChecking(data: TenantCheckingInput<CreateCheckingInput>): Promise<Result<CheckingEntity, DomainError>>;
  getCheckingById(id: string, empresaId: string): Promise<Result<CheckingEntity | null, DomainError>>;
  updateChecking(id: string, empresaId: string, data: UpdateCheckingInput): Promise<Result<CheckingEntity, DomainError>>;
  deleteChecking(id: string, empresaId: string): Promise<Result<boolean, DomainError>>;
  getCheckingsByAluguel(aluguelId: string, empresaId: string): Promise<Result<CheckingEntity[], DomainError>>;
  listCheckings(query: TenantCheckingInput<ListCheckingsQuery>): Promise<Result<CheckingEntity[], DomainError>>;
}

export class CheckingService implements ICheckingService {
  constructor(private readonly repository: ICheckingRepository) {}

  /**
   * Cria um novo checking e registra no audit log
   */
  async createChecking(data: TenantCheckingInput<CreateCheckingInput>): Promise<Result<CheckingEntity, DomainError>> {
    const aluguel = await Aluguel.findOne({ _id: data.aluguelId, empresaId: data.empresaId })
      .select('_id placaId')
      .lean<any>()
      .exec();

    if (!aluguel) {
      return Result.fail(new NotFoundError('Aluguel nao encontrado para este tenant'));
    }

    if (aluguel.placaId && String(aluguel.placaId) !== String(data.placaId)) {
      return Result.fail(new ValidationError([{
        field: 'placaId',
        message: 'Placa informada nao pertence ao aluguel informado',
      }]));
    }

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
  async getCheckingById(id: string, empresaId: string): Promise<Result<CheckingEntity | null, DomainError>> {
    return await this.repository.findById(id, empresaId);
  }

  /**
   * Atualiza checking
   */
  async updateChecking(id: string, empresaId: string, data: UpdateCheckingInput): Promise<Result<CheckingEntity, DomainError>> {
    // Buscar dados antigos para audit
    const oldDataResult = await this.repository.findById(id, empresaId);

    const result = await this.repository.update(id, empresaId, data);

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

  async deleteChecking(id: string, empresaId: string): Promise<Result<boolean, DomainError>> {
    return await this.repository.delete(id, empresaId);
  }

  /**
   * Busca checkings de um aluguel especifico
   */
  async getCheckingsByAluguel(aluguelId: string, empresaId: string): Promise<Result<CheckingEntity[], DomainError>> {
    return await this.repository.findByAluguelId(aluguelId, empresaId);
  }

  /**
   * Lista checkings com filtros
   */
  async listCheckings(query: TenantCheckingInput<ListCheckingsQuery>): Promise<Result<CheckingEntity[], DomainError>> {
    return await this.repository.list(query);
  }
}
