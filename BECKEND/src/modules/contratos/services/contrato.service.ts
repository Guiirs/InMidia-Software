/**
 * Contrato Service
 * Lógica de negócio para contratos com Result pattern
 */

import { Result, DomainError } from '@shared/core';
import { 
  ValidationError,
  ContratoNotFoundError,
  BusinessRuleViolationError,
  NotFoundError
} from '@shared/core';
import { Log, Cache } from '@shared/core';
import PropostaInterna from '@modules/propostas-internas/PropostaInterna';
import { temporalEngine } from '@modules/temporal';
import type { IContratoRepository } from '../repositories/contrato.repository';
import type {
  CreateContratoDTO,
  UpdateContratoDTO,
  ListContratosQueryDTO,
  ContratoEntity,
  PaginatedContratosResponse
} from '../dtos/contrato.dto';
import { 
  validateCreateContrato,
  validateUpdateContrato,
  validateListQuery,
  toListItems
} from '../dtos/contrato.dto';

export class ContratoService {
  
  constructor(private readonly repository: IContratoRepository) {}

  /**
   * Cria um novo contrato a partir de uma PI
   */
  async createContrato(
    data: CreateContratoDTO,
    empresaId: string
  ): Promise<Result<ContratoEntity, DomainError>> {
    try {
      // 1. Validar input
      const validatedData = validateCreateContrato(data);

      // 2. Verificar se PI existe
      const pi = await PropostaInterna.findOne({ 
        _id: validatedData.piId,
        empresaId 
      }).lean();

      if (!pi) {
        return Result.fail(new NotFoundError('PropostaInterna', validatedData.piId));
      }

      // 3. Verificar se já existe contrato para esta PI
      const existingResult = await this.repository.findByPiId(validatedData.piId, empresaId);
      if (existingResult.isFailure) {
        return Result.fail(existingResult.error);
      }

      if (existingResult.value) {
        return Result.fail(
          new BusinessRuleViolationError('Já existe um contrato para esta Proposta Interna')
        );
      }

      // 4. Gerar número do contrato
      try {
        const plateIds = ((pi as any).placas || []).map((placaId: unknown) => String(placaId));
        if (plateIds.length > 0) {
          await temporalEngine.assertMultiplePlatesAvailable(
            plateIds,
            (pi as any).startDate || (pi as any).dataInicio,
            (pi as any).endDate || (pi as any).dataFim,
            {
              empresaId,
              sourceType: 'PI',
              sourceId: validatedData.piId,
            }
          );
        }
      } catch (temporalError) {
        return Result.fail(new BusinessRuleViolationError(
          temporalError instanceof Error ? temporalError.message : 'Placa indisponivel para contrato'
        ));
      }

      const numero = this.generateContratoNumber();

      // 5. Criar contrato
      const createResult = await this.repository.create({
        ...validatedData,
        clienteId: pi.clienteId.toString(),
        empresaId,
        numero
      });

      if (createResult.isFailure) {
        return Result.fail(createResult.error);
      }

      try {
        await temporalEngine.promotePiReservationToContract(
          validatedData.piId,
          String(createResult.value._id),
          empresaId
        );
      } catch (temporalError) {
        return Result.fail(new BusinessRuleViolationError(
          temporalError instanceof Error ? temporalError.message : 'Erro temporal ao ativar contrato'
        ));
      }

      // 6. Invalidar cache
      await Cache.clear(`contrato:${empresaId}:*`);

      Log.info('[ContratoService] Contrato criado com sucesso', {
        contratoId: createResult.value._id,
        piId: validatedData.piId,
        empresaId
      });

      return Result.ok(createResult.value);

    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        return Result.fail(new ValidationError([{ field: 'data', message: error.message }]));
      }
      
      Log.error('[ContratoService] Erro ao criar contrato', { error });
      return Result.fail(new BusinessRuleViolationError('Erro ao criar contrato'));
    }
  }

  /**
   * Lista contratos com filtros e paginação
   */
  async listContratos(
    empresaId: string,
    query: ListContratosQueryDTO
  ): Promise<Result<PaginatedContratosResponse, DomainError>> {
    try {
      // 1. Validar query
      const validatedQuery = validateListQuery(query);

      // 2. Gerar chave de cache
      const cacheKey = this.generateCacheKey(empresaId, validatedQuery);

      // 3. Verificar cache
      const cached = await Cache.get<PaginatedContratosResponse>(cacheKey);
      if (cached.isSuccess && cached.value) {
        Log.info('[ContratoService] Cache HIT', { cacheKey });
        return Result.ok(cached.value);
      }

      Log.info('[ContratoService] Cache MISS', { cacheKey });

      // 4. Buscar do repositório
      const result = await this.repository.findAll(empresaId, validatedQuery);
      if (result.isFailure) {
        return Result.fail(result.error);
      }

      const { data, total } = result.value;

      // 5. Construir resposta
      const response: PaginatedContratosResponse = {
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
      
      Log.error('[ContratoService] Erro ao listar contratos', { error });
      return Result.fail(new BusinessRuleViolationError('Erro ao listar contratos'));
    }
  }

  /**
   * Busca contrato por ID
   */
  async getContratoById(
    id: string,
    empresaId: string
  ): Promise<Result<ContratoEntity, DomainError>> {
    const result = await this.repository.findById(id, empresaId);
    
    if (result.isFailure) {
      return Result.fail(result.error);
    }

    if (!result.value) {
      return Result.fail(new ContratoNotFoundError(id));
    }

    return Result.ok(result.value);
  }

  /**
   * Atualiza contrato
   */
  async updateContrato(
    id: string,
    data: UpdateContratoDTO,
    empresaId: string
  ): Promise<Result<ContratoEntity, DomainError>> {
    try {
      // 1. Validar input
      const validatedData = validateUpdateContrato(data);

      // 2. Buscar contrato atual
      const existingResult = await this.repository.findById(id, empresaId);
      if (existingResult.isFailure) {
        return Result.fail(existingResult.error);
      }
      if (!existingResult.value) {
        return Result.fail(new ContratoNotFoundError(id));
      }

      const current = existingResult.value;

      // 3. Validar transição de status
      if (validatedData.status) {
        const validationResult = this.validateStatusTransition(
          current.status,
          validatedData.status
        );
        if (validationResult.isFailure) {
          return Result.fail(validationResult.error);
        }
      }

      // 4. Atualizar contrato
      const updateResult = await this.repository.update(id, validatedData, empresaId);
      if (updateResult.isFailure) {
        return Result.fail(updateResult.error);
      }

      if (validatedData.status) {
        try {
          await temporalEngine.syncContractStatus(id, validatedData.status, empresaId);
        } catch (temporalError) {
          return Result.fail(new BusinessRuleViolationError(
            temporalError instanceof Error ? temporalError.message : 'Erro temporal ao atualizar contrato'
          ));
        }
      }

      // 5. Invalidar cache
      await Cache.clear(`contrato:${empresaId}:*`);

      Log.info('[ContratoService] Contrato atualizado', {
        contratoId: id,
        empresaId
      });

      return Result.ok(updateResult.value);

    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        return Result.fail(new ValidationError([{ field: 'data', message: error.message }]));
      }
      
      Log.error('[ContratoService] Erro ao atualizar contrato', { error });
      return Result.fail(new BusinessRuleViolationError('Erro ao atualizar contrato'));
    }
  }

  /**
   * Deleta contrato (apenas se status = 'rascunho')
   */
  async deleteContrato(
    id: string,
    empresaId: string
  ): Promise<Result<void, DomainError>> {
    // 1. Buscar contrato
    const existingResult = await this.repository.findById(id, empresaId);
    if (existingResult.isFailure) {
      return Result.fail(existingResult.error);
    }
    if (!existingResult.value) {
      return Result.fail(new ContratoNotFoundError(id));
    }

    // 2. Validar se pode deletar (apenas rascunho)
    if (existingResult.value.status !== 'rascunho') {
      return Result.fail(
        new BusinessRuleViolationError('Apenas contratos em rascunho podem ser deletados')
      );
    }

    // 3. Deletar
    const deleteResult = await this.repository.delete(id, empresaId);
    if (deleteResult.isFailure) {
      return Result.fail(deleteResult.error);
    }

    // 4. Invalidar cache
    await Cache.clear(`contrato:${empresaId}:*`);

    Log.info('[ContratoService] Contrato deletado', {
      contratoId: id,
      empresaId
    });

    return Result.ok(undefined);
  }

  // ============================================
  // MÉTODOS PRIVADOS
  // ============================================

  /**
   * Valida transição de status
   * 
   * Regras:
   * - rascunho → ativo
   * - ativo → concluido
   * - ativo → cancelado
   * - cancelado: estado final
   * - concluido: estado final
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
      rascunho: ['ativo'],
      ativo: ['concluido', 'cancelado'],
      concluido: [], // Estado final
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
   * Gera número único para o contrato
   */
  private generateContratoNumber(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `CONT-${timestamp}-${random}`;
  }

  /**
   * Gera chave de cache baseada nos parâmetros
   */
  private generateCacheKey(empresaId: string, query: ListContratosQueryDTO): string {
    const { page, limit, sortBy, order, status, clienteId } = query;
    return `contrato:${empresaId}:page:${page}:limit:${limit}:sort:${sortBy}:${order}:status:${status || 'all'}:cliente:${clienteId || 'all'}`;
  }
}
