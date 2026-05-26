// @ts-nocheck — arquivo legado, não usado pelas rotas ativas. Erros TS pré-existentes.
// src/controllers/placa.controller.ts
import { Request, Response, NextFunction } from 'express';
import { PlacaService } from './placa.service';
import AppError from '@shared/container/AppError';
import logger from '@shared/container/logger';
import cacheService from '@shared/container/cache.service';

export class PlacaController {
  constructor(private placaService: PlacaService) {}

  /**
   * Controller para criar uma nova placa.
   * POST /api/v1/placas
   */
  async createPlacaController(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!req.user) {
      return next(new AppError('User not authenticated', 401));
    }

    const empresaId = req.user.empresaId;
    const userId = req.user.id;

    logger.info(`[PlacaController] Utilizador ${userId} requisitou createPlaca para empresa ${empresaId}.`);
    logger.debug(`[PlacaController] Dados recebidos (body): ${JSON.stringify(req.body)}`);
    logger.debug(`[PlacaController] Ficheiro recebido: ${req.file ? (req.file as any).key : 'Nenhum'}`);

    try {
      const novaPlaca = await this.placaService.createPlaca(req.body, req.file, empresaId);

      // Invalidate related caches
      await cacheService.del(`placas:locations:empresa:${empresaId}`);
      await cacheService.invalidatePattern(`placas:*`);

      logger.info(`[PlacaController] Placa ${novaPlaca.numero_placa} (ID: ${novaPlaca.id}) criada com sucesso por ${userId}.`);
      res.status(201).json(novaPlaca);
    } catch (err: unknown) {
      if (err instanceof Error) {
        next(err);
      } else {
        next(new AppError('Unknown error occurred', 500));
      }
    }
  }

  /**
   * Controller para atualizar uma placa existente.
   * PUT /api/v1/placas/:id
   */
  async updatePlacaController(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!req.user) {
      return next(new AppError('User not authenticated', 401));
    }

    const empresaId = req.user.empresaId;
    const userId = req.user.id;
    const { id: placaIdToUpdate } = req.params;

    if (!placaIdToUpdate) {
      return next(new AppError('Placa ID is required', 400));
    }

    logger.info(`[PlacaController] Utilizador ${userId} requisitou updatePlaca para ID: ${placaIdToUpdate} na empresa ${empresaId}.`);
    logger.debug(`[PlacaController] Dados recebidos (body): ${JSON.stringify(req.body)}`);
    logger.debug(`[PlacaController] Ficheiro recebido: ${req.file ? (req.file as any).key : 'Nenhum/Manter/Remover'}`);

    try {
      const placaAtualizada = await this.placaService.updatePlaca(placaIdToUpdate, req.body, req.file, empresaId);

      // Invalidate related caches
      await cacheService.del(`placa:${placaIdToUpdate}:empresa:${empresaId}`);
      await cacheService.del(`placas:locations:empresa:${empresaId}`);
      await cacheService.invalidatePattern(`placas:*`);

      logger.info(`[PlacaController] Placa ID ${placaIdToUpdate} atualizada com sucesso por ${userId}.`);
      res.status(200).json(placaAtualizada);
    } catch (err: unknown) {
      if (err instanceof Error) {
        next(err);
      } else {
        next(new AppError('Unknown error occurred', 500));
      }
    }
  }

  /**
   * Controller para buscar todas as placas (com filtros, paginação).
   * GET /api/v1/placas
   */
  async getAllPlacasController(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!req.user) {
      return next(new AppError('User not authenticated', 401));
    }

    const empresaId = req.user.empresaId;
    const userId = req.user.id;

    logger.info(`[PlacaController] Utilizador ${userId} requisitou getAllPlacas para empresa ${empresaId}.`);
    logger.debug(`[PlacaController] Query Params: ${JSON.stringify(req.query)}`);

    try {
      const result = await this.placaService.getAllPlacas(empresaId, req.query);
      logger.info(`[PlacaController] getAllPlacas retornou ${result.data.length} placas na página ${result.pagination.currentPage} (Total: ${result.pagination.totalDocs}).`);
      res.status(200).json(result);
    } catch (err: unknown) {
      if (err instanceof Error) {
        next(err);
      } else {
        next(new AppError('Unknown error occurred', 500));
      }
    }
  }

  /**
   * Controller para buscar uma placa específica pelo ID.
   * GET /api/v1/placas/:id
   */
  async getPlacaByIdController(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!req.user) {
      return next(new AppError('User not authenticated', 401));
    }

    const empresaId = req.user.empresaId;
    const userId = req.user.id;
    const { id: placaIdToGet } = req.params;

    if (!placaIdToGet) {
      return next(new AppError('Placa ID is required', 400));
    }

    logger.info(`[PlacaController] Utilizador ${userId} requisitou getPlacaById para ID: ${placaIdToGet} na empresa ${empresaId}.`);

    try {
      const placa = await this.placaService.getPlacaById(placaIdToGet, empresaId);

      logger.info(`[PlacaController] Placa ID ${placaIdToGet} encontrada com sucesso.`);
      res.status(200).json(placa);
    } catch (err: unknown) {
      if (err instanceof Error) {
        next(err);
      } else {
        next(new AppError('Unknown error occurred', 500));
      }
    }
  }

  /**
   * Controller para apagar uma placa.
   * DELETE /api/v1/placas/:id
   */
  async deletePlacaController(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!req.user) {
      return next(new AppError('User not authenticated', 401));
    }

    const empresaId = req.user.empresaId;
    const userId = req.user.id;
    const { id: placaIdToDelete } = req.params;

    if (!placaIdToDelete) {
      return next(new AppError('Placa ID is required', 400));
    }

    logger.info(`[PlacaController] Utilizador ${userId} requisitou deletePlaca para ID: ${placaIdToDelete} na empresa ${empresaId}.`);

    try {
      await this.placaService.deletePlaca(placaIdToDelete, empresaId);

      // Invalidate related caches
      await cacheService.del(`placa:${placaIdToDelete}:empresa:${empresaId}`);
      await cacheService.del(`placas:locations:empresa:${empresaId}`);
      await cacheService.invalidatePattern(`placas:*`);

      logger.info(`[PlacaController] Placa ID ${placaIdToDelete} apagada com sucesso por ${userId}.`);
      res.status(204).send();
    } catch (err: unknown) {
      if (err instanceof Error) {
        next(err);
      } else {
        next(new AppError('Unknown error occurred', 500));
      }
    }
  }

  /**
   * Controller para alternar a disponibilidade (manutenção).
   * PATCH /api/v1/placas/:id/disponibilidade
   */
  async toggleDisponibilidadeController(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!req.user) {
      return next(new AppError('User not authenticated', 401));
    }

    const empresaId = req.user.empresaId;
    const userId = req.user.id;
    const { id: placaIdToToggle } = req.params;

    if (!placaIdToToggle) {
      return next(new AppError('Placa ID is required', 400));
    }

    logger.info(`[PlacaController] Utilizador ${userId} requisitou toggleDisponibilidade para placa ID: ${placaIdToToggle} na empresa ${empresaId}.`);

    try {
      const placaAtualizada = await this.placaService.toggleDisponibilidade(placaIdToToggle, empresaId);

      // Invalidate related caches
      await cacheService.del(`placa:${placaIdToToggle}:empresa:${empresaId}`);
      await cacheService.del(`placas:locations:empresa:${empresaId}`);
      await cacheService.invalidatePattern(`placas:*`);

      logger.info(`[PlacaController] Disponibilidade da placa ID ${placaIdToToggle} alternada com sucesso para ${placaAtualizada.disponivel} por ${userId}.`);
      res.status(200).json(placaAtualizada);
    } catch (err: unknown) {
      if (err instanceof Error) {
        next(err);
      } else {
        next(new AppError('Unknown error occurred', 500));
      }
    }
  }

  /**
   * Controller para buscar todas as localizações de placas.
   * GET /api/v1/placas/locations
   */
  async getPlacaLocationsController(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!req.user) {
      return next(new AppError('User not authenticated', 401));
    }

    const empresaId = req.user.empresaId;
    const userId = req.user.id;

    logger.info(`[PlacaController] Utilizador ${userId} requisitou getPlacaLocations para empresa ${empresaId}.`);

    try {
      const cacheKey = `placas:locations:empresa:${empresaId}`;
      const cachedLocations = await cacheService.get(cacheKey);

      if (cachedLocations) {
        logger.info(`[PlacaController] Cache HIT para getPlacaLocations empresa ${empresaId}.`);
        res.status(200).json(cachedLocations);
        return;
      }

      logger.info(`[PlacaController] Cache MISS para getPlacaLocations empresa ${empresaId}. Consultando banco...`);
      const locations = await this.placaService.getAllPlacaLocations(empresaId);

      await cacheService.set(cacheKey, locations, 300);

      logger.info(`[PlacaController] getPlacaLocations retornou ${locations.length} localizações.`);
      res.status(200).json(locations);
    } catch (err: unknown) {
      if (err instanceof Error) {
        next(err);
      } else {
        next(new AppError('Unknown error occurred', 500));
      }
    }
  }

  /**
   * Controller para buscar placas disponíveis por período.
   * GET /api/v1/placas/disponiveis
   */
  async getPlacasDisponiveisController(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!req.user) {
      return next(new AppError('User not authenticated', 401));
    }

    const empresaId = req.user.empresaId;
    const userId = req.user.id;
    const dataInicio = req.query.dataInicio || req.query.data_inicio;
    const dataFim = req.query.dataFim || req.query.data_fim;

    logger.info(`[PlacaController] Utilizador ${userId} requisitou getPlacasDisponiveis para empresa ${empresaId}.`);
    logger.debug(`[PlacaController] Query Params: ${JSON.stringify(req.query)}`);
    logger.debug(`[PlacaController] User payload: ${JSON.stringify(req.user)}`);

    if (!dataInicio || !dataFim) {
      logger.warn(`[PlacaController] Requisição para getPlacasDisponiveis sem dataInicio ou dataFim.`);
      res.status(400).json({ message: 'dataInicio e dataFim são obrigatórios.' });
      return;
    }

    if (!empresaId) {
      logger.error(`[PlacaController] Utilizador ${userId} não tem empresaId definido no token!`);
      return next(new AppError('Usuário não associado a uma empresa', 403));
    }

    try {
      const placas = await this.placaService.getPlacasDisponiveis(empresaId, dataInicio as string, dataFim as string, req.query);

      logger.info(`[PlacaController] getPlacasDisponiveis retornou ${placas.length} placas.`);
      res.status(200).json({ data: placas });
    } catch (err: unknown) {
      if (err instanceof Error) {
        next(err);
      } else {
        next(new AppError('Unknown error occurred', 500));
      }
    }
  }
}

