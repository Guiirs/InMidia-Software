import { Request, Response, NextFunction } from 'express';
import logger from '@shared/container/logger';
import AppError from '@shared/container/AppError';

/**
 * Converts Mongoose Cast errors to operational AppError
 */
const handleCastErrorDB = (err: any): AppError => {
  const message = `Recurso inválido. ${err.path}: ${err.value}.`;
  return new AppError(message, 400);
};

/**
 * Converts duplicate key errors (code 11000) to operational AppError
 */
const handleDuplicateFieldsDB = (err: any): AppError => {
  const field = Object.keys(err.keyValue || {})[0];
  const value = field ? err.keyValue[field] : 'desconhecido';
  const message = `O campo '${field}' com valor '${value}' já existe. Por favor, use outro valor.`;
  return new AppError(message, 409);
};

/**
 * Converts Mongoose validation errors to operational AppError
 */
const handleValidationErrorDB = (err: any): AppError => {
  const errors = Object.values(err.errors).map((el: any) => el.message);
  const message = `Dados de entrada inválidos: ${errors.join('. ')}`;
  return new AppError(message, 400);
};

/**
 * Converts JWT invalid token error
 */
const handleJWTError = (): AppError =>
  new AppError('Token inválido. Por favor, faça login novamente.', 401);

/**
 * Converts JWT expired token error
 */
const handleJWTExpiredError = (): AppError =>
  new AppError('O seu token expirou. Por favor, faça login novamente.', 401);

const isV4Route = (req: Request): boolean =>
  req.originalUrl?.startsWith('/api/v4/') ?? false;

/**
 * Normalizes any error into the V4 standard contract:
 * { success: false, code, message, details? }
 */
const sendErrorV4 = (err: any, _req: Request, res: Response): void => {
  const statusCode = err.statusCode || 500;
  const code: string =
    err.code ||
    (statusCode === 401 ? 'UNAUTHORIZED' :
     statusCode === 403 ? 'FORBIDDEN' :
     statusCode === 404 ? 'NOT_FOUND' :
     statusCode === 409 ? 'CONFLICT' :
     statusCode === 422 ? 'VALIDATION_ERROR' :
     'INTERNAL_ERROR');

  const isOperational = err.isOperational ?? statusCode < 500;
  const message = isOperational
    ? (err.message || 'Erro na requisição')
    : 'Erro interno no servidor. Tente novamente mais tarde.';

  const payload: Record<string, unknown> = { success: false, code, message };

  if (err.errors) payload.details = err.errors;
  if (process.env.NODE_ENV === 'development') {
    payload.debug = { originalMessage: err.message, stack: err.stack };
  }

  res.status(statusCode).json(payload);
};

/**
 * Sends detailed error response (development environment)
 */
const sendErrorDev = (err: any, _req: Request, res: Response): void => {
  if (!err) {
    res.status(500).json({
      status: 'error',
      message: 'Erro desconhecido ocorreu',
      error: 'Error object is undefined',
    });
    return;
  }

  const statusCode = err.statusCode || 500;
  const status = err.status || 'error';

  res.status(statusCode).json({
    status,
    message: err.message || 'Erro interno do servidor',
    error: err,
    stack: err.stack,
    ...(err.errors && { errors: err.errors }),
  });
};

/**
 * Sends controlled error response (production environment)
 */
const sendErrorProd = (err: any, res: Response): void => {
  const statusCode = err.statusCode || 500;
  const status = err.status || 'error';

  // Operational error: send message to client
  if (err.isOperational) {
    res.status(statusCode).json({
      status,
      message: err.message || 'Erro no servidor',
      ...(err.errors && { errors: err.errors }),
    });
  } else {
    // Programming or unknown error: don't leak details
    logger.error('ERRO NÃO OPERACIONAL 💥 (PRODUÇÃO)', {
      message: err.message,
      stack: err.stack,
      errorObject: err,
    });

    res.status(500).json({
      status: 'error',
      message: 'Ocorreu um erro interno no servidor. Tente novamente mais tarde.',
    });
  }
};

/**
 * Global Error Handling Middleware
 */
const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (!err) {
    logger.error('Error handler recebeu erro undefined');
    res.status(500).json({
      status: 'error',
      message: 'Erro desconhecido ocorreu',
    });
    return;
  }

  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Centralized logging
  logger.error(
    `${err.statusCode} - ${err.message || 'Sem mensagem'} - ${req.originalUrl} - ${req.method} - IP: ${req.ip}`,
    { stack: err.stack }
  );

  if (isV4Route(req)) {
    let error = { ...err, message: err.message, name: err.name, code: err.code, keyValue: err.keyValue };
    if (error.name === 'CastError') error = handleCastErrorDB(error);
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);
    if (error.name === 'ValidationError') error = handleValidationErrorDB(error);
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();
    if (err.errors) { error.errors = err.errors; error.isOperational = true; }
    sendErrorV4(error, req, res);
    return;
  }

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, req, res);
  } else {
    // Convert technical errors to operational errors
    let error = {
      ...err,
      message: err.message,
      name: err.name,
      code: err.code,
      keyValue: err.keyValue,
    };

    if (error.name === 'CastError') error = handleCastErrorDB(error);
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);
    if (error.name === 'ValidationError') error = handleValidationErrorDB(error);
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();

    // Preserve validation errors from AppError
    if (err.errors) {
      error.errors = err.errors;
      error.isOperational = true;
    }

    sendErrorProd(error, res);
  }
};

export default errorHandler;
