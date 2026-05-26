/**
 * Cliente Controller
 * Camada de apresentação com Result Pattern
 */

import { Request, Response, NextFunction } from 'express';

type Params = Record<string, string>;
import { IAuthRequest } from '../../../types/express.d';
import { getErrorStatusCode } from '@shared/core';
import { Log, Cache } from '@shared/core';
import type { ClienteService } from '../services/cliente.service';

export class ClienteController {
  constructor(private readonly clienteService: ClienteService) {}

  /**
   * Cria novo cliente
   * POST /api/v1/clientes
   */
  async createClienteController(
    req: Request & IAuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado'
        });
        return;
      }

      const { empresaId, id: userId } = req.user;

      Log.info('[ClienteController] Criando novo cliente', {
        userId,
        empresaId,
        hasFile: !!req.file
      });

      // Chamar service
      const result = await this.clienteService.createCliente(
        req.body,
        req.file as any,
        empresaId
      );

      // Verificar resultado
      if (result.isFailure) {
        const statusCode = getErrorStatusCode(result.error);
        res.status(statusCode).json({
          success: false,
          error: result.error.message,
          code: result.error.code
        });
        return;
      }

      // Invalidar cache
      const clearResult = await Cache.clear(`clientes:empresa:${empresaId}:*`);
      if (clearResult.isFailure) {
        Log.warn('[ClienteController] Falha ao invalidar cache', {
          error: clearResult.error.message
        });
      }

      Log.info('[ClienteController] Cliente criado com sucesso', {
        clienteId: result.value._id,
        nome: result.value.nome,
        userId,
        empresaId
      });

      res.status(201).json({
        success: true,
        data: result.value
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Atualiza cliente existente
   * PUT /api/v1/clientes/:id
   */
  async updateClienteController(
    req: Request & IAuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado'
        });
        return;
      }

      const { empresaId, id: userId } = req.user;
      const { id: clienteId } = req.params as Params;

      if (!clienteId) {
        res.status(400).json({
          success: false,
          error: 'ID do cliente é obrigatório'
        });
        return;
      }

      Log.info('[ClienteController] Atualizando cliente', {
        clienteId,
        userId,
        empresaId,
        hasFile: !!req.file
      });

      // Chamar service
      const result = await this.clienteService.updateCliente(
        clienteId,
        req.body,
        req.file as any,
        empresaId
      );

      // Verificar resultado
      if (result.isFailure) {
        const statusCode = getErrorStatusCode(result.error);
        res.status(statusCode).json({
          success: false,
          error: result.error.message,
          code: result.error.code
        });
        return;
      }

      // Invalidar cache
      const clearResult = await Cache.clear(`clientes:empresa:${empresaId}:*`);
      if (clearResult.isFailure) {
        Log.warn('[ClienteController] Falha ao invalidar cache', {
          error: clearResult.error.message
        });
      }

      Log.info('[ClienteController] Cliente atualizado com sucesso', {
        clienteId,
        userId,
        empresaId
      });

      res.status(200).json({
        success: true,
        data: result.value
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Lista todos os clientes com paginação
   * GET /api/v1/clientes
   */
  async getAllClientesController(
    req: Request & IAuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado'
        });
        return;
      }

      const { empresaId, id: userId } = req.user;

      Log.info('[ClienteController] Listando clientes', {
        userId,
        empresaId,
        query: req.query
      });

      // Verificar cache
      const page = req.query.page || 1;
      const limit = req.query.limit || 10;
      const cacheKey = `clientes:empresa:${empresaId}:page:${page}:limit:${limit}`;

      const cachedResult = await Cache.get<any>(cacheKey);

      if (cachedResult) {
        Log.info('[ClienteController] Cache HIT para clientes', {
          empresaId,
          page
        });

        res.status(200).json({
          success: true,
          ...cachedResult,
          cached: true
        });
        return;
      }

      Log.info('[ClienteController] Cache MISS para clientes', {
        empresaId,
        page
      });

      // Chamar service
      const result = await this.clienteService.listClientes(empresaId, req.query);

      // Verificar resultado
      if (result.isFailure) {
        const statusCode = getErrorStatusCode(result.error);
        res.status(statusCode).json({
          success: false,
          error: result.error.message,
          code: result.error.code
        });
        return;
      }

      // Salvar em cache (3 minutos)
      await Cache.set(cacheKey, result.value, 180);

      Log.info('[ClienteController] Clientes listados com sucesso', {
        count: result.value.data.length,
        total: result.value.pagination.totalDocs,
        empresaId
      });

      res.status(200).json({
        success: true,
        ...result.value
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Busca cliente por ID
   * GET /api/v1/clientes/:id
   */
  async getClienteByIdController(
    req: Request & IAuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado'
        });
        return;
      }

      const { empresaId, id: userId } = req.user;
      const { id: clienteId } = req.params as Params;

      if (!clienteId) {
        res.status(400).json({
          success: false,
          error: 'ID do cliente é obrigatório'
        });
        return;
      }

      Log.info('[ClienteController] Buscando cliente por ID', {
        clienteId,
        userId,
        empresaId
      });

      // Chamar service
      const result = await this.clienteService.getClienteById(clienteId, empresaId);

      // Verificar resultado
      if (result.isFailure) {
        const statusCode = getErrorStatusCode(result.error);
        res.status(statusCode).json({
          success: false,
          error: result.error.message,
          code: result.error.code
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.value
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Deleta cliente
   * DELETE /api/v1/clientes/:id
   */
  async deleteClienteController(
    req: Request & IAuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado'
        });
        return;
      }

      const { empresaId, id: userId } = req.user;
      const { id: clienteId } = req.params as Params;

      if (!clienteId) {
        res.status(400).json({
          success: false,
          error: 'ID do cliente é obrigatório'
        });
        return;
      }

      Log.info('[ClienteController] Deletando cliente', {
        clienteId,
        userId,
        empresaId
      });

      // Chamar service
      const result = await this.clienteService.deleteCliente(clienteId, empresaId);

      // Verificar resultado
      if (result.isFailure) {
        const statusCode = getErrorStatusCode(result.error);
        res.status(statusCode).json({
          success: false,
          error: result.error.message,
          code: result.error.code
        });
        return;
      }

      // Invalidar cache
      const clearResult = await Cache.clear(`clientes:empresa:${empresaId}:*`);
      if (clearResult.isFailure) {
        Log.warn('[ClienteController] Falha ao invalidar cache', {
          error: clearResult.error.message
        });
      }

      Log.info('[ClienteController] Cliente deletado com sucesso', {
        clienteId,
        userId,
        empresaId
      });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}
