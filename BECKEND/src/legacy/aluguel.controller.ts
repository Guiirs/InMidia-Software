// @ts-nocheck — arquivo legado, não usado pelas rotas ativas. Erros TS pré-existentes.
// src/modules/alugueis/aluguel.controller.ts
import { Request, Response, NextFunction } from 'express';
import AluguelService from './aluguel.service';
import AppError from '@shared/container/AppError';
import logger from '@shared/container/logger';

export class AluguelController {
  constructor(private aluguelService: AluguelService) {}

  /**
   * Controller para obter o histórico de alugueis de uma placa específica.
   * GET /api/v1/alugueis/placa/:placaId
   */
  async getAlugueisByPlaca(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!req.user) {
      return next(new AppError('User not authenticated', 401));
    }

    const empresa_id = req.user.empresaId;
    const { placaId } = req.params;

    if (!placaId) {
      return next(new AppError('placaId é obrigatório.', 400));
    }

    logger.info(`[AluguelController] Requisitado getAlugueisByPlaca para placa ${placaId} na empresa ${empresa_id}.`);

    try {
      const alugueis = await this.aluguelService.getAlugueisByPlaca(placaId, empresa_id);
      logger.info(`[AluguelController] getAlugueisByPlaca retornou ${alugueis.length} alugueis para placa ${placaId}.`);
      res.status(200).json(alugueis);
    } catch (err: unknown) {
      if (err instanceof Error) {
        next(err);
      } else {
        next(new AppError('Unknown error occurred', 500));
      }
    }
  }

  /**
   * Controller para criar um novo aluguel.
   * POST /api/v1/alugueis/
   */
  async createAluguel(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!req.user) {
      return next(new AppError('User not authenticated', 401));
    }

    const empresa_id = req.user.empresaId;

    logger.info(`[AluguelController] Requisitado createAluguel para empresa ${empresa_id}.`);
    logger.debug(`[AluguelController] Dados recebidos para createAluguel: ${JSON.stringify(req.body)}`);

    try {
      const novoAluguel = await this.aluguelService.createAluguel(req.body, empresa_id);
      logger.info(`[AluguelController] createAluguel bem-sucedido. Novo aluguel ID: ${novoAluguel.id}`);
      res.status(201).json(novoAluguel);
    } catch (err: unknown) {
      if (err instanceof Error) {
        next(err);
      } else {
        next(new AppError('Unknown error occurred', 500));
      }
    }
  }

  /**
   * Controller para apagar (cancelar) um aluguel.
   * DELETE /api/v1/alugueis/:id
   */
  async deleteAluguel(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!req.user) {
      return next(new AppError('User not authenticated', 401));
    }

    const empresa_id = req.user.empresaId;
    const { aluguelId } = req.params;

    if (!aluguelId) {
      return next(new AppError('aluguelId é obrigatório.', 400));
    }

    logger.info(`[AluguelController] Requisitado deleteAluguel para aluguel ${aluguelId} na empresa ${empresa_id}.`);

    try {
      const result = await this.aluguelService.deleteAluguel(aluguelId, empresa_id);
      logger.info(`[AluguelController] deleteAluguel para ID ${aluguelId} concluído com sucesso.`);
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
   * Controller para buscar aluguéis por bi-semana
   * GET /api/v1/alugueis/bi-week/:biWeekId
   */
  async getAlugueisByBiWeek(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!req.user) {
      return next(new AppError('User not authenticated', 401));
    }

    const empresa_id = req.user.empresaId;
    const { biWeekId } = req.params;

    if (!biWeekId) {
      return next(new AppError('biWeekId é obrigatório.', 400));
    }

    logger.info(`[AluguelController] Requisitado getAlugueisByBiWeek para biWeek ${biWeekId} na empresa ${empresa_id}.`);

    try {
      const alugueis = await this.aluguelService.getAlugueisByBiWeek(biWeekId, empresa_id);
      logger.info(`[AluguelController] ${alugueis.length} aluguéis encontrados para bi-semana ${biWeekId}.`);
      res.status(200).json(alugueis);
    } catch (err: unknown) {
      if (err instanceof Error) {
        next(err);
      } else {
        next(new AppError('Unknown error occurred', 500));
      }
    }
  }

  /**
   * Controller para buscar placas disponíveis em uma bi-semana
   * GET /api/v1/alugueis/bi-week/:biWeekId/disponiveis
   */
  async getPlacasDisponiveisByBiWeek(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!req.user) {
      return next(new AppError('User not authenticated', 401));
    }

    const empresa_id = req.user.empresaId;
    const { biWeekId } = req.params;

    if (!biWeekId) {
      return next(new AppError('biWeekId é obrigatório.', 400));
    }

    logger.info(`[AluguelController] Requisitado getPlacasDisponiveisByBiWeek para biWeek ${biWeekId} na empresa ${empresa_id}.`);

    try {
      const placas = await this.aluguelService.getPlacasDisponiveisByBiWeek(biWeekId, empresa_id);
      logger.info(`[AluguelController] ${placas.length} placas disponíveis na bi-semana ${biWeekId}.`);
      res.status(200).json(placas);
    } catch (err: unknown) {
      if (err instanceof Error) {
        next(err);
      } else {
        next(new AppError('Unknown error occurred', 500));
      }
    }
  }

  /**
   * Controller para gerar relatório de ocupação por bi-semana
   * GET /api/v1/alugueis/bi-week/:biWeekId/relatorio
   */
  async getRelatorioOcupacaoBiWeek(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!req.user) {
      return next(new AppError('User not authenticated', 401));
    }

    const empresa_id = req.user.empresaId;
    const { biWeekId } = req.params;

    if (!biWeekId) {
      return next(new AppError('biWeekId é obrigatório.', 400));
    }

    logger.info(`[AluguelController] Requisitado getRelatorioOcupacaoBiWeek para biWeek ${biWeekId} na empresa ${empresa_id}.`);

    try {
      const relatorio = await this.aluguelService.getRelatorioOcupacaoBiWeek(biWeekId, empresa_id);
      logger.info(`[AluguelController] Relatório gerado para bi-semana ${biWeekId}.`);
      res.status(200).json(relatorio);
    } catch (err: unknown) {
      if (err instanceof Error) {
        next(err);
      } else {
        next(new AppError('Unknown error occurred', 500));
      }
    }
  }
}

