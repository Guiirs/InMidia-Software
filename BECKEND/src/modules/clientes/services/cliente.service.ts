/**
 * Cliente Service
 * Camada de lógica de negócios com Result Pattern
 */

import path from 'path';
import { Result } from '@shared/core';
import {
  ClienteNotFoundError,
  ClienteHasDependenciesError,
  ValidationError,
  toDomainError,
  DomainError
} from '@shared/core';
import { Log } from '@shared/core';
import { safeDeleteFromR2 } from '@shared/infra/http/middlewares/upload.middleware';
import Aluguel from '@modules/alugueis/Aluguel';
import type { IClienteRepository } from '../repositories/cliente.repository';
import {
  validateCreateCliente,
  validateUpdateCliente,
  validateListQuery,
  validateClienteLogo,
  toListItems,
  type ClienteEntity,
  type PaginatedClientesResponse
} from '../dtos/cliente.dto';

interface S3File {
  key: string;
  location: string;
  bucket: string;
  mimetype: string;
  originalname: string;
  size: number;
}

export class ClienteService {
  constructor(private readonly repository: IClienteRepository) {}

  /**
   * Cria novo cliente
   */
  async createCliente(
    data: unknown,
    file: S3File | undefined,
    empresaId: string
  ): Promise<Result<ClienteEntity, DomainError>> {
    try {
      // Validar dados de entrada
      const validatedData = validateCreateCliente(data);

      // Validar arquivo se fornecido
      if (file) {
        validateClienteLogo({
          mimetype: file.mimetype,
          size: file.size,
          filename: file.originalname
        });

        Log.info('[ClienteService] Arquivo validado para logo', {
          filename: file.originalname,
          empresaId
        });

        // Adicionar logo_url aos dados validados
        (validatedData as any).logo_url = path.basename(file.key);
      }

      // Criar cliente via repository
      const result = await this.repository.create(validatedData, empresaId);

      if (result.isFailure) {
        return Result.fail(result.error);
      }

      Log.info('[ClienteService] Cliente criado com sucesso', {
        clienteId: result.value._id,
        nome: result.value.nome,
        empresaId
      });

      return Result.ok(result.value);
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        return Result.fail(
          new ValidationError(
            [{ field: 'data', message: 'Dados de entrada inválidos' }]
          )
        );
      }

      const domainError = toDomainError(error);
      Log.error('[ClienteService] Erro ao criar cliente', {
        error: domainError.message,
        empresaId
      });

      return Result.fail(domainError);
    }
  }

  /**
   * Atualiza cliente existente
   */
  async updateCliente(
    id: string,
    data: unknown,
    file: S3File | undefined,
    empresaId: string
  ): Promise<Result<ClienteEntity, DomainError>> {
    try {
      // Validar dados de entrada
      const validatedData = validateUpdateCliente(data);

      // Buscar cliente existente
      const existsResult = await this.repository.findById(id, empresaId);
      if (existsResult.isFailure) {
        return Result.fail(existsResult.error);
      }

      const clienteExistente = existsResult.value;
      if (!clienteExistente) {
        return Result.fail(new ClienteNotFoundError(id));
      }

      // Processar logo
      if (file) {
        // Validar novo arquivo
        validateClienteLogo({
          mimetype: file.mimetype,
          size: file.size,
          filename: file.originalname
        });

        (validatedData as any).logo_url = path.basename(file.key);

        // Apagar logo antigo se existir
        if (clienteExistente.logo_url) {
          const oldKey = `clientes/${clienteExistente.logo_url}`;
          try {
            await safeDeleteFromR2(oldKey);
            Log.info('[ClienteService] Logo antigo removido', { key: oldKey });
          } catch (deleteError) {
            Log.warn('[ClienteService] Falha ao remover logo antigo', {
              key: oldKey,
              error: toDomainError(deleteError).message
            });
          }
        }
      } else if ('logo_url' in validatedData && validatedData.logo_url === null) {
        // Remover logo explicitamente
        if (clienteExistente.logo_url) {
          const logoKey = `clientes/${clienteExistente.logo_url}`;
          try {
            await safeDeleteFromR2(logoKey);
            Log.info('[ClienteService] Logo removido', { key: logoKey });
          } catch (deleteError) {
            Log.warn('[ClienteService] Falha ao remover logo', {
              key: logoKey,
              error: toDomainError(deleteError).message
            });
          }
        }
        (validatedData as any).logo_url = undefined;
      }

      // Atualizar via repository
      const result = await this.repository.update(id, validatedData, empresaId);

      if (result.isFailure) {
        return Result.fail(result.error);
      }

      Log.info('[ClienteService] Cliente atualizado com sucesso', {
        clienteId: id,
        empresaId
      });

      return Result.ok(result.value);
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        return Result.fail(
          new ValidationError(
            [{ field: 'data', message: 'Dados de entrada inválidos' }]
          )
        );
      }

      const domainError = toDomainError(error);
      Log.error('[ClienteService] Erro ao atualizar cliente', {
        error: domainError.message,
        clienteId: id,
        empresaId
      });

      return Result.fail(domainError);
    }
  }

  /**
   * Lista clientes com paginação e filtros
   */
  async listClientes(
    empresaId: string,
    query: unknown
  ): Promise<Result<PaginatedClientesResponse, DomainError>> {
    try {
      // Validar query params
      const validatedQuery = validateListQuery(query);

      // Buscar via repository
      const result = await this.repository.findAll(empresaId, validatedQuery);

      if (result.isFailure) {
        return Result.fail(result.error);
      }

      const { data, total } = result.value;
      const { page, limit } = validatedQuery;

      // Transformar para lista resumida
      const items = toListItems(data);

      const totalPages = Math.ceil(total / limit);

      const response: PaginatedClientesResponse = {
        data: items,
        pagination: {
          totalDocs: total,
          totalPages: totalPages,
          currentPage: page,
          limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      };

      Log.info('[ClienteService] Clientes listados com sucesso', {
        count: items.length,
        total,
        page,
        empresaId
      });

      return Result.ok(response);
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        return Result.fail(
          new ValidationError(
            [{ field: 'query', message: 'Parâmetros de consulta inválidos' }],
            'Validação falhou'
          )
        );
      }

      const domainError = toDomainError(error);
      Log.error('[ClienteService] Erro ao listar clientes', {
        error: domainError.message,
        empresaId
      });

      return Result.fail(domainError);
    }
  }

  /**
   * Busca cliente por ID
   */
  async getClienteById(
    id: string,
    empresaId: string
  ): Promise<Result<ClienteEntity, DomainError>> {
    try {
      const result = await this.repository.findById(id, empresaId);

      if (result.isFailure) {
        return Result.fail(result.error);
      }

      if (!result.value) {
        return Result.fail(new ClienteNotFoundError(id));
      }

      return Result.ok(result.value);
    } catch (error) {
      const domainError = toDomainError(error);
      Log.error('[ClienteService] Erro ao buscar cliente', {
        error: domainError.message,
        clienteId: id,
        empresaId
      });

      return Result.fail(domainError);
    }
  }

  /**
   * Deleta cliente com validações de dependências
   */
  async deleteCliente(
    id: string,
    empresaId: string
  ): Promise<Result<void, DomainError>> {
    try {
      // Buscar cliente existente
      const clienteResult = await this.repository.findById(id, empresaId);

      if (clienteResult.isFailure) {
        return Result.fail(clienteResult.error);
      }

      if (!clienteResult.value) {
        return Result.fail(new ClienteNotFoundError(id));
      }

      const cliente = clienteResult.value;

      // Verificar aluguéis ativos
      const alugueisAtivos = await Aluguel.countDocuments({
        clienteId: id,
        empresaId,
        status: { $in: ['ativo', 'futuro'] }
      });

      if (alugueisAtivos > 0) {
        return Result.fail(
          new ClienteHasDependenciesError([
            `${alugueisAtivos} aluguéis ativos ou futuros`
          ])
        );
      }

      // Verificar Propostas Internas
      const PropostaInterna = (await import('@modules/propostas-internas/PropostaInterna'))
        .default;
      const pisCount = await PropostaInterna.countDocuments({
        clienteId: id,
        empresaId
      });

      if (pisCount > 0) {
        return Result.fail(
          new ClienteHasDependenciesError([`${pisCount} Propostas Internas`])
        );
      }

      // Verificar Contratos
      const Contrato = (await import('@modules/contratos/Contrato')).default;
      const contratosCount = await Contrato.countDocuments({
        clienteId: id,
        empresaId
      });

      if (contratosCount > 0) {
        return Result.fail(
          new ClienteHasDependenciesError([`${contratosCount} Contratos`])
        );
      }

      // Apagar logo se existir
      if (cliente.logo_url) {
        const logoKey = `clientes/${cliente.logo_url}`;
        try {
          await safeDeleteFromR2(logoKey);
          Log.info('[ClienteService] Logo do cliente apagado', { key: logoKey });
        } catch (deleteError) {
          Log.warn('[ClienteService] Falha ao apagar logo do cliente', {
            key: logoKey,
            error: toDomainError(deleteError).message
          });
        }
      }

      // Deletar via repository
      const deleteResult = await this.repository.delete(id, empresaId);

      if (deleteResult.isFailure) {
        return Result.fail(deleteResult.error);
      }

      Log.info('[ClienteService] Cliente deletado com sucesso', {
        clienteId: id,
        empresaId
      });

      return Result.ok(undefined);
    } catch (error) {
      const domainError = toDomainError(error);
      Log.error('[ClienteService] Erro ao deletar cliente', {
        error: domainError.message,
        clienteId: id,
        empresaId
      });

      return Result.fail(domainError);
    }
  }
}
