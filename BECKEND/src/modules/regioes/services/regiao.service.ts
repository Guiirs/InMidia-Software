/**
 * Regiao Service
 * Lógica de negócio para regiões com Result pattern
 */

import { Result, DomainError } from '@shared/core';
import { 
  ValidationError,
  BusinessRuleViolationError
} from '@shared/core';
import { Log, Cache } from '@shared/core';
import type { IRegiaoRepository } from '../repositories/regiao.repository';
import { RegiaoNotFoundError } from '../repositories/regiao.repository';
import type {
  CreateRegiaoDTO,
  UpdateRegiaoDTO,
  ListRegioesQueryDTO,
  RegiaoEntity,
  PaginatedRegioesResponse
} from '../dtos/regiao.dto';
import { 
  validateCreateRegiao,
  validateUpdateRegiao,
  validateListQuery,
  toListItems
} from '../dtos/regiao.dto';

export class RegiaoService {
  
  constructor(private readonly repository: IRegiaoRepository) {}

  /**
   * Cria uma nova região
   */
  async createRegiao(
    data: CreateRegiaoDTO,
    empresaId: string
  ): Promise<Result<RegiaoEntity, DomainError>> {
    try {
      // 1. Validar input
      const validatedData = validateCreateRegiao(data);

      // 2. Criar região
      const createResult = await this.repository.create({
        ...validatedData,
        empresaId
      });

      if (createResult.isFailure) {
        return Result.fail(createResult.error);
      }

      // 3. Invalidar cache
      await Cache.clear(`regiao:${empresaId}:*`);

      Log.info('[RegiaoService] Região criada com sucesso', {
        regiaoId: createResult.value._id,
        nome: validatedData.nome,
        empresaId
      });

      return Result.ok(createResult.value);

    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        return Result.fail(new ValidationError([{ field: 'data', message: error.message }]));
      }
      
      Log.error('[RegiaoService] Erro ao criar região', { error });
      return Result.fail(new BusinessRuleViolationError('Erro ao criar região'));
    }
  }

  /**
   * Lista regiões com filtros e paginação
   */
  async listRegioes(
    empresaId: string,
    query: ListRegioesQueryDTO
  ): Promise<Result<PaginatedRegioesResponse, DomainError>> {
    try {
      // 1. Validar query
      const validatedQuery = validateListQuery(query);

      // 2. Gerar chave de cache
      const cacheKey = this.generateCacheKey(empresaId, validatedQuery);

      // 3. Verificar cache
      const cached = await Cache.get<PaginatedRegioesResponse>(cacheKey);
      if (cached.isSuccess && cached.value) {
        Log.info('[RegiaoService] Cache HIT', { cacheKey });
        return Result.ok(cached.value);
      }

      Log.info('[RegiaoService] Cache MISS', { cacheKey });

      // 4. Buscar do repositório
      const result = await this.repository.findAll(empresaId, validatedQuery);
      if (result.isFailure) {
        return Result.fail(result.error);
      }

      const { data, total } = result.value;

      // 5. Construir resposta
      const response: PaginatedRegioesResponse = {
        data: toListItems(data),
        pagination: {
          totalDocs: total,
          totalPages: Math.ceil(total / validatedQuery.limit),
          currentPage: validatedQuery.page,
          limit: validatedQuery.limit,
          hasNextPage: validatedQuery.page < Math.ceil(total / validatedQuery.limit),
          hasPrevPage: validatedQuery.page > 1
        }
      };

      // 6. Salvar no cache (5 minutos)
      await Cache.set(cacheKey, response, 300);

      return Result.ok(response);

    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        return Result.fail(new ValidationError([{ field: 'query', message: error.message }]));
      }
      
      Log.error('[RegiaoService] Erro ao listar regiões', { error });
      return Result.fail(new BusinessRuleViolationError('Erro ao listar regiões'));
    }
  }

  /**
   * Busca região por ID
   */
  async getRegiaoById(
    id: string,
    empresaId: string
  ): Promise<Result<RegiaoEntity, DomainError>> {
    const result = await this.repository.findById(id, empresaId);
    
    if (result.isFailure) {
      return Result.fail(result.error);
    }

    if (!result.value) {
      return Result.fail(new RegiaoNotFoundError(id));
    }

    return Result.ok(result.value);
  }

  /**
   * Atualiza região
   */
  async updateRegiao(
    id: string,
    data: UpdateRegiaoDTO,
    empresaId: string
  ): Promise<Result<RegiaoEntity, DomainError>> {
    try {
      // 1. Validar input
      const validatedData = validateUpdateRegiao(data);

      // 2. Verificar se região existe
      const existingResult = await this.repository.findById(id, empresaId);
      if (existingResult.isFailure) {
        return Result.fail(existingResult.error);
      }
      if (!existingResult.value) {
        return Result.fail(new RegiaoNotFoundError(id));
      }

      // 3. Atualizar região
      const updateResult = await this.repository.update(id, validatedData, empresaId);
      if (updateResult.isFailure) {
        return Result.fail(updateResult.error);
      }

      // 4. Invalidar cache
      await Cache.clear(`regiao:${empresaId}:*`);

      Log.info('[RegiaoService] Região atualizada', {
        regiaoId: id,
        empresaId
      });

      return Result.ok(updateResult.value);

    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        return Result.fail(new ValidationError([{ field: 'data', message: error.message }]));
      }
      
      Log.error('[RegiaoService] Erro ao atualizar região', { error });
      return Result.fail(new BusinessRuleViolationError('Erro ao atualizar região'));
    }
  }

  /**
   * Deleta região
   */
  async deleteRegiao(
    id: string,
    empresaId: string
  ): Promise<Result<void, DomainError>> {
    // 1. Buscar região
    const existingResult = await this.repository.findById(id, empresaId);
    if (existingResult.isFailure) {
      return Result.fail(existingResult.error);
    }
    if (!existingResult.value) {
      return Result.fail(new RegiaoNotFoundError(id));
    }

    // 2. Verificar se há placas associadas
    const placasCountResult = await this.repository.countPlacas(id, empresaId);
    if (placasCountResult.isFailure) {
      return Result.fail(placasCountResult.error);
    }

    if (placasCountResult.value > 0) {
      return Result.fail(
        new BusinessRuleViolationError(
          `Não é possível deletar região com ${placasCountResult.value} placa(s) associada(s)`
        )
      );
    }

    // 3. Deletar
    const deleteResult = await this.repository.delete(id, empresaId);
    if (deleteResult.isFailure) {
      return Result.fail(deleteResult.error);
    }

    // 4. Invalidar cache
    await Cache.clear(`regiao:${empresaId}:*`);

    Log.info('[RegiaoService] Região deletada', {
      regiaoId: id,
      empresaId
    });

    return Result.ok(undefined);
  }

  // ============================================
  // MÉTODOS PRIVADOS
  // ============================================

  /**
   * Gera chave de cache baseada nos parâmetros
   */
  private generateCacheKey(empresaId: string, query: ListRegioesQueryDTO): string {
    const { page, limit, sortBy, order, ativo, search } = query;
    return `regiao:${empresaId}:page:${page}:limit:${limit}:sort:${sortBy}:${order}:ativo:${ativo ?? 'all'}:search:${search || 'none'}`;
  }
}
