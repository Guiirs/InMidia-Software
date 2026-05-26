/**
 * Empresa Service
 * Lógica de negócio com cache e transações
 */

import { Result, DomainError, ValidationError, NotFoundError } from '@shared/core';
import { ZodError } from 'zod';
import CacheManager from '@shared/container/cache.service';
import type { IEmpresaRepository } from '../repositories/empresa.repository';
import type {
  UpdateEmpresaInput,
  EmpresaEntity,
} from '../dtos/empresa.dto';

export class EmpresaService {
  private readonly cacheManager: typeof CacheManager;
  private readonly CACHE_TTL = 600; // 10 minutos

  constructor(private readonly repository: IEmpresaRepository) {
    this.cacheManager = CacheManager;
  }

  /**
   * Busca detalhes da empresa com cache
   */
  async getEmpresaDetails(empresaId: string): Promise<Result<EmpresaEntity, DomainError>> {
    try {
      // Tenta buscar do cache
      const cacheKey = `empresa:details:${empresaId}`;
      const cached = await this.cacheManager.get(cacheKey) as EmpresaEntity | null;

      if (cached) {
        return Result.ok(cached);
      }

      // Busca do banco
      const result = await this.repository.findById(empresaId);

      if (result.isFailure) {
        return Result.fail(result.error);
      }

      if (!result.value) {
        return Result.fail(
          new NotFoundError('Empresa não encontrada')
        );
      }

      const empresa = this.toEntity(result.value);

      // Salva no cache
      await this.cacheManager.set(cacheKey, empresa, this.CACHE_TTL);

      return Result.ok(empresa);
    } catch (error: any) {
      return Result.fail(
        new ValidationError([{ field: 'geral', message: 'Erro ao buscar detalhes da empresa' }])
      );
    }
  }

  /**
   * Atualiza detalhes da empresa
   */
  async updateEmpresaDetails(
    empresaId: string,
    updateData: UpdateEmpresaInput
  ): Promise<Result<EmpresaEntity, DomainError>> {
    try {
      const result = await this.repository.update(empresaId, updateData);

      if (result.isFailure) {
        return Result.fail(result.error);
      }

      const empresa = this.toEntity(result.value);

      // Invalida cache
      const cacheKey = `empresa:details:${empresaId}`;
      await this.cacheManager.del(cacheKey);

      return Result.ok(empresa);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return Result.fail(new ValidationError(
          error.issues.map((err: any) => ({
            field: err.path.join('.'),
            message: err.message
          }))
        ));
      }
      return Result.fail(
        new ValidationError([{ field: 'geral', message: 'Erro ao atualizar empresa' }])
      );
    }
  }

  /**
   * Busca API Key da empresa
   */
  async getApiKey(empresaId: string): Promise<Result<string, DomainError>> {
    try {
      const result = await this.repository.getApiKey(empresaId);
      return result;
    } catch (error: any) {
      return Result.fail(
        new ValidationError([{ field: 'geral', message: 'Erro ao buscar API Key' }])
      );
    }
  }

  /**
   * Regenera API Key da empresa
   */
  async regenerateApiKey(empresaId: string): Promise<Result<string, DomainError>> {
    try {
      const result = await this.repository.regenerateApiKey(empresaId);

      if (result.isFailure) {
        return Result.fail(result.error);
      }

      // Invalida cache de detalhes da empresa
      const cacheKey = `empresa:details:${empresaId}`;
      await this.cacheManager.del(cacheKey);

      return result;
    } catch (error: any) {
      return Result.fail(
        new ValidationError([{ field: 'geral', message: 'Erro ao regenerar API Key' }])
      );
    }
  }

  /**
   * Registra uma nova empresa com usuário admin
   */
  async registerEmpresa(
    empresaData: any,
    userData: any
  ): Promise<Result<{ empresaId: string; userId: string }, DomainError>> {
    try {
      // Este método será implementado no repositório com transações
      const result = await this.repository.registerEmpresa?.(empresaData, userData);
      
      if (result) {
        if (result.isFailure) {
          return Result.fail(result.error);
        }
        return Result.ok({
          empresaId: result.value.empresaId,
          userId: result.value.userId
        });
      }

      return Result.fail(
        new ValidationError([{ field: 'geral', message: 'Registro de empresa não implementado' }])
      );
    } catch (error: any) {
      if (error instanceof ZodError) {
        return Result.fail(new ValidationError(
          error.issues.map((err: any) => ({
            field: err.path.join('.'),
            message: err.message
          }))
        ));
      }
      return Result.fail(
        new ValidationError([{ field: 'geral', message: 'Erro ao registar empresa' }])
      );
    }
  }

  /**
   * Helper: Converte documento para entidade
   */
  private toEntity(doc: any): EmpresaEntity {
    return {
      id: doc._id.toString(),
      nome: doc.nome,
      cnpj: doc.cnpj,
      telefone: doc.telefone,
      email: doc.email,
      endereco: doc.endereco,
      ativo: doc.ativo,
      enforce_bi_week_validation: doc.enforce_bi_week_validation || false,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}
