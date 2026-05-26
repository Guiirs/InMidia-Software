import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError, ZodIssue } from 'zod';
import AppError from '@shared/container/AppError';
import logger from '@shared/container/logger';

/**
 * Middleware genérico de validação usando Zod
 * @param schema - Schema Zod para validação
 */
export const validate = (schema: ZodSchema) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      // Valida req.body, req.params, req.query
      await schema.parseAsync({
        body: req.body,
        params: req.params,
        query: req.query,
      });
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Formata erros do Zod para estrutura amigável
        const errors = error.issues.map((err: ZodIssue) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        
        logger.warn('[Validation] Erro de validação:', { errors });
        
        throw new AppError(
          'Erro de validação dos dados',
          400,
          errors
        );
      }
      
      next(error);
    }
  };
};
