// @ts-nocheck — arquivo legado, não usado pelas rotas ativas. Erros TS pré-existentes.
import { Request, Response } from 'express';
import CheckingService from './checking.service';
import AppError from '@shared/container/AppError';

export class CheckingController {
  async createChecking(req: Request, res: Response) {
    try {
      const { aluguelId, placaId, gpsCoordinates } = req.body;
      const installerId = (req as any).user?.id;

      if (!aluguelId || !installerId) {
        throw new AppError('Aluguel ID and installer ID are required', 400);
      }

      const photoUrl = (req as any).file?.location || (req as any).file?.path;
      if (!photoUrl) {
        throw new AppError('Photo upload failed', 400);
      }

      const checking = await CheckingService.createChecking({
        aluguelId,
        placaId,
        installerId,
        photoUrl,
        gpsCoordinates,
      });

      res.status(201).json({
        success: true,
        data: checking,
      });
    } catch (error) {
      const err = error as AppError;
      res.status(err.statusCode || 500).json({
        success: false,
        message: err.message,
      });
    }
  }

  async getChecking(req: Request, res: Response) {
    try {
      const { id } = req.params;
      if (!id) {
        throw new AppError('ID is required', 400);
      }
      const checking = await CheckingService.getCheckingById(id);

      if (!checking) {
        throw new AppError('Checking not found', 404);
      }

      res.json({
        success: true,
        data: checking,
      });
    } catch (error) {
      const err = error as AppError;
      res.status(err.statusCode || 500).json({
        success: false,
        message: err.message,
      });
    }
  }

  async getCheckingsByAluguel(req: Request, res: Response) {
    try {
      const { aluguelId } = req.params;
      if (!aluguelId) {
        throw new AppError('Aluguel ID is required', 400);
      }
      const checkings = await CheckingService.getCheckingsByAluguel(aluguelId);

      res.json({
        success: true,
        data: checkings,
      });
    } catch (error) {
      const err = error as AppError;
      res.status(err.statusCode || 500).json({
        success: false,
        message: err.message,
      });
    }
  }
}

export default new CheckingController();