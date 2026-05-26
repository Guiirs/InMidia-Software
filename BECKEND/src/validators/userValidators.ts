// src/validators/userValidators.ts
import { validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import logger from '@shared/container/logger';

/**
 * Middleware para lidar com erros de validação do express-validator
 */
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(err => err.msg);
    logger.warn(`[Validation] Erros de validação na rota ${req.originalUrl}: ${errorMessages.join(', ')}`);

    res.status(400).json({
      message: 'Dados inválidos fornecidos.',
      errors: errorMessages
    });
    return;
  }

  next();
};