/**
 * Aluguel Service
 * Lógica de negócio complexa para aluguéis com Result pattern
 */

import { Result, DomainError } from '@shared/core';
import { 
  ValidationError,
  AluguelNotFoundError,
  BusinessRuleViolationError,
  PlacaNotFoundError,
  ClienteNotFoundError
} from '@shared/core';
import { Log, Cache } from '@shared/core';
import Placa from '@modules/placas/Placa';
import Cliente from '@modules/clientes/Cliente';
import type { IAluguelRepository } from '../repositories/aluguel.repository';
import type {
  CreateAluguelDTO,
  UpdateAluguelDTO,
  ListAlugueisQueryDTO,
  CheckDisponibilidadeAluguelDTO,
  AluguelEntity,
  PaginatedAlugueisResponse,
  DisponibilidadeAluguelResponse
} from '../dtos/aluguel.dto';
import { 
  validateCreateAluguel,
  validateUpdateAluguel,
  validateListQuery,
  validateCheckDisponibilidade,
  toListItems
} from '../dtos/aluguel.dto';

export class AluguelService {
  
  constructor(private readonly repository: IAluguelRepository) {}

  /**
   * Cria um novo aluguel
   */
  async createAluguel(
    data: CreateAluguelDTO,
    empresaId: string
  ): Promise<Result<AluguelEntity, DomainError>> {
    try {
      // 1. Validar input
      const validatedData = validateCreateAluguel(data);

      // 2. Verificar se placa existe
      const placa = await Placa.findOne({ _id: validatedData.placaId, empresaId }).lean();
      if (!placa) {
        return Result.fail(new PlacaNotFoundError(validatedData.placaId));
      }

      // 3. Verificar se cliente existe
      const cliente = await Cliente.findOne({ _id: validatedData.clienteId, empresaId }).lean();
      if (!cliente) {
        return Result.fail(new ClienteNotFoundError(validatedData.clienteId));
      }

      // 4. Verificar disponibilidade (sem sobreposição)
      const disponibilidadeResult = await this.checkDisponibilidade({
        placaId: validatedData.placaId,
        startDate: validatedData.startDate,
        endDate: validatedData.endDate
      }, empresaId);

      if (disponibilidadeResult.isFailure) {
        return Result.fail(disponibilidadeResult.error);
      }

      if (!disponibilidadeResult.value.disponivel) {
        return Result.fail(
          new BusinessRuleViolationError(
            `Placa já está alugada no período selecionado. ${disponibilidadeResult.value.conflitos?.length || 0} conflito(s) encontrado(s).`
          )
        );
      }

      // 5. Criar aluguel
      const createResult = await this.repository.create({
        ...validatedData,
        empresaId
      });

      if (createResult.isFailure) {
        return Result.fail(createResult.error);
      }

      // 6. Invalidar cache
      await Cache.clear(`aluguel:${empresaId}:*`);

      Log.info('[AluguelService] Aluguel criado com sucesso', {
        aluguelId: createResult.value._id,
        placaId: validatedData.placaId,
        empresaId
      });

      return Result.ok(createResult.value);

    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        return Result.fail(new ValidationError([{ field: 'data', message: error.message }]));
      }
      
      Log.error('[AluguelService] Erro ao criar aluguel', { error });
      return Result.fail(new BusinessRuleViolationError('Erro ao criar aluguel'));
    }
  }

  /**
   * Lista aluguéis com filtros e paginação
   */
  async listAlugueis(
    empresaId: string,
    query: ListAlugueisQueryDTO
  ): Promise<Result<PaginatedAlugueisResponse, DomainError>> {
    try {
      // 1. Validar query
      const validatedQuery = validateListQuery(query);

      // 2. Gerar chave de cache
      const cacheKey = this.generateCacheKey(empresaId, validatedQuery);

      // 3. Verificar cache
      const cached = await Cache.get<PaginatedAlugueisResponse>(cacheKey);
      if (cached.isSuccess && cached.value) {
        Log.info('[AluguelService] Cache HIT', { cacheKey });
        return Result.ok(cached.value);
      }

      Log.info('[AluguelService] Cache MISS', { cacheKey });

      // 4. Buscar do repositório
      const result = await this.repository.findAll(empresaId, validatedQuery);
      if (result.isFailure) {
        return Result.fail(result.error);
      }

      const { data, total } = result.value;

      // 5. Construir resposta
      const response: PaginatedAlugueisResponse = {
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

      // 6. Salvar no cache (3 minutos)
      await Cache.set(cacheKey, response, 180);

      return Result.ok(response);

    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        return Result.fail(new ValidationError([{ field: 'query', message: error.message }]));
      }
      
      Log.error('[AluguelService] Erro ao listar aluguéis', { error });
      return Result.fail(new BusinessRuleViolationError('Erro ao listar aluguéis'));
    }
  }

  /**
   * Busca aluguel por ID
   */
  async getAluguelById(
    id: string,
    empresaId: string
  ): Promise<Result<AluguelEntity, DomainError>> {
    const result = await this.repository.findById(id, empresaId);
    
    if (result.isFailure) {
      return Result.fail(result.error);
    }

    if (!result.value) {
      return Result.fail(new AluguelNotFoundError(id));
    }

    return Result.ok(result.value);
  }

  /**
   * Atualiza aluguel
   */
  async updateAluguel(
    id: string,
    data: UpdateAluguelDTO,
    empresaId: string
  ): Promise<Result<AluguelEntity, DomainError>> {
    try {
      // 1. Validar input
      const validatedData = validateUpdateAluguel(data);

      // 2. Buscar aluguel atual
      const existingResult = await this.repository.findById(id, empresaId);
      if (existingResult.isFailure) {
        return Result.fail(existingResult.error);
      }
      if (!existingResult.value) {
        return Result.fail(new AluguelNotFoundError(id));
      }

      const current = existingResult.value;

      // 3. Validar regras de negócio
      if (validatedData.status) {
        const statusValidation = this.validateStatusTransition(
          current.status,
          validatedData.status
        );
        if (statusValidation.isFailure) {
          return Result.fail(statusValidation.error);
        }
      }

      // 4. Se está mudando datas, verificar sobreposição
      if (validatedData.startDate || validatedData.endDate) {
        const newStartDate = validatedData.startDate || current.startDate;
        const newEndDate = validatedData.endDate || current.endDate;

        const disponibilidadeResult = await this.checkDisponibilidade({
          placaId: current.placaId.toString(),
          startDate: newStartDate,
          endDate: newEndDate,
          excludeAluguelId: id
        }, empresaId);

        if (disponibilidadeResult.isFailure) {
          return Result.fail(disponibilidadeResult.error);
        }

        if (!disponibilidadeResult.value.disponivel) {
          return Result.fail(
            new BusinessRuleViolationError(
              `Nova data conflita com outro aluguel. ${disponibilidadeResult.value.conflitos?.length || 0} conflito(s) encontrado(s).`
            )
          );
        }
      }

      // 5. Atualizar aluguel
      const updateResult = await this.repository.update(id, validatedData, empresaId);
      if (updateResult.isFailure) {
        return Result.fail(updateResult.error);
      }

      // 6. Invalidar cache
      await Cache.clear(`aluguel:${empresaId}:*`);

      Log.info('[AluguelService] Aluguel atualizado', {
        aluguelId: id,
        empresaId
      });

      return Result.ok(updateResult.value);

    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        return Result.fail(new ValidationError([{ field: 'data', message: error.message }]));
      }
      
      Log.error('[AluguelService] Erro ao atualizar aluguel', { error });
      return Result.fail(new BusinessRuleViolationError('Erro ao atualizar aluguel'));
    }
  }

  /**
   * Deleta aluguel
   */
  async deleteAluguel(
    id: string,
    empresaId: string
  ): Promise<Result<void, DomainError>> {
    // 1. Buscar aluguel
    const existingResult = await this.repository.findById(id, empresaId);
    if (existingResult.isFailure) {
      return Result.fail(existingResult.error);
    }
    if (!existingResult.value) {
      return Result.fail(new AluguelNotFoundError(id));
    }

    // 2. Validar se pode deletar (não permitir deletar aluguéis finalizados)
    if (existingResult.value.status === 'finalizado') {
      return Result.fail(
        new BusinessRuleViolationError('Não é possível deletar aluguéis finalizados')
      );
    }

    // 3. Deletar
    const deleteResult = await this.repository.delete(id, empresaId);
    if (deleteResult.isFailure) {
      return Result.fail(deleteResult.error);
    }

    // 4. Invalidar cache
    await Cache.clear(`aluguel:${empresaId}:*`);

    Log.info('[AluguelService] Aluguel deletado', {
      aluguelId: id,
      empresaId
    });

    return Result.ok(undefined);
  }

  /**
   * Verifica disponibilidade de placa no período
   */
  async checkDisponibilidade(
    data: CheckDisponibilidadeAluguelDTO,
    empresaId: string
  ): Promise<Result<DisponibilidadeAluguelResponse, DomainError>> {
    try {
      // 1. Validar input
      const validatedData = validateCheckDisponibilidade(data);

      // 2. Buscar aluguéis sobrepostos
      const overlapResult = await this.repository.findOverlapping(validatedData, empresaId);
      if (overlapResult.isFailure) {
        return Result.fail(overlapResult.error);
      }

      const conflitos = overlapResult.value;

      // 3. Construir resposta
      if (conflitos.length === 0) {
        return Result.ok({
          disponivel: true
        });
      }

      return Result.ok({
        disponivel: false,
        conflitos: conflitos.map(aluguel => {
          const cliente = aluguel.clienteId as any;
          const clienteNome = cliente && typeof cliente === 'object' && cliente.nome 
            ? cliente.nome 
            : 'Cliente não informado';

          return {
            aluguelId: aluguel._id.toString(),
            startDate: aluguel.startDate,
            endDate: aluguel.endDate,
            cliente_nome: clienteNome
          };
        })
      });

    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        return Result.fail(new ValidationError([{ field: 'data', message: error.message }]));
      }
      
      Log.error('[AluguelService] Erro ao verificar disponibilidade', { error });
      return Result.fail(new BusinessRuleViolationError('Erro ao verificar disponibilidade'));
    }
  }

  // ============================================
  // MÉTODOS PRIVADOS
  // ============================================

  /**
   * Valida transição de status
   * 
   * Regras:
   * - ativo → finalizado
   * - ativo → cancelado
   * - cancelado: estado final
   * - finalizado: estado final
   */
  private validateStatusTransition(
    currentStatus: string,
    newStatus: string
  ): Result<void, DomainError> {
    // Se não mudou, tudo ok
    if (currentStatus === newStatus) {
      return Result.ok(undefined);
    }

    const validTransitions: Record<string, string[]> = {
      ativo: ['finalizado', 'cancelado'],
      finalizado: [], // Estado final
      cancelado: []  // Estado final
    };

    const allowedNext = validTransitions[currentStatus] || [];
    
    if (!allowedNext.includes(newStatus)) {
      return Result.fail(
        new BusinessRuleViolationError(
          `Transição inválida de status: ${currentStatus} → ${newStatus}`
        )
      );
    }

    return Result.ok(undefined);
  }

  /**
   * Gera chave de cache baseada nos parâmetros
   */
  private generateCacheKey(empresaId: string, query: ListAlugueisQueryDTO): string {
    const { page, limit, sortBy, order, status, placaId, clienteId, tipo } = query;
    return `aluguel:${empresaId}:page:${page}:limit:${limit}:sort:${sortBy}:${order}:status:${status || 'all'}:placa:${placaId || 'all'}:cliente:${clienteId || 'all'}:tipo:${tipo || 'all'}`;
  }
}
