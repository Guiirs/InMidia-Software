/**
 * Domain Errors - Hierarquia de erros tipados para a aplicação
 * 
 * Substitui strings genéricas por classes de erro específicas,
 * permitindo tratamento diferenciado e type-safe.
 */

/**
 * Base para todos os erros de domínio
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;
  readonly timestamp: Date;
  readonly context?: Record<string, any>;

  constructor(message: string, context?: Record<string, any>) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date();
    this.context = context;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
      context: this.context,
      stack: process.env.NODE_ENV === 'development' ? this.stack : undefined
    };
  }
}

// ============================================
// ERROS DE VALIDAÇÃO (400)
// ============================================

export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 400;
  readonly errors: Array<{ field: string; message: string }>;

  constructor(
    errors: Array<{ field: string; message: string }>,
    message = 'Erro de validação'
  ) {
    super(message);
    this.errors = errors;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      errors: this.errors
    };
  }
}

export class InvalidInputError extends DomainError {
  readonly code = 'INVALID_INPUT';
  readonly statusCode = 400;

  constructor(field: string, reason?: string) {
    super(
      reason ? `Campo inválido: ${field} - ${reason}` : `Campo inválido: ${field}`
    );
  }
}

export class InvalidObjectIdError extends DomainError {
  readonly code = 'INVALID_OBJECT_ID';
  readonly statusCode = 400;

  constructor(field: string, value: string) {
    super(`ObjectId inválido: ${field} = "${value}"`);
  }
}

export class RequiredFieldError extends DomainError {
  readonly code = 'REQUIRED_FIELD';
  readonly statusCode = 400;

  constructor(field: string) {
    super(`Campo obrigatório ausente: ${field}`);
  }
}

// ============================================
// ERROS DE AUTENTICAÇÃO (401)
// ============================================

export class UnauthorizedError extends DomainError {
  readonly code = 'UNAUTHORIZED';
  readonly statusCode = 401;

  constructor(message = 'Não autorizado') {
    super(message);
  }
}

export class InvalidCredentialsError extends DomainError {
  readonly code = 'INVALID_CREDENTIALS';
  readonly statusCode = 401;

  constructor() {
    super('Credenciais inválidas');
  }
}

export class TokenExpiredError extends DomainError {
  readonly code = 'TOKEN_EXPIRED';
  readonly statusCode = 401;

  constructor() {
    super('Token expirado');
  }
}

export class InvalidTokenError extends DomainError {
  readonly code = 'INVALID_TOKEN';
  readonly statusCode = 401;

  constructor() {
    super('Token inválido');
  }
}

// ============================================
// ERROS DE AUTORIZAÇÃO (403)
// ============================================

export class ForbiddenError extends DomainError {
  readonly code = 'FORBIDDEN';
  readonly statusCode = 403;

  constructor(message = 'Acesso negado') {
    super(message);
  }
}

export class InsufficientPermissionsError extends DomainError {
  readonly code = 'INSUFFICIENT_PERMISSIONS';
  readonly statusCode = 403;

  constructor(requiredPermission: string) {
    super(`Permissão insuficiente: ${requiredPermission} é necessária`);
  }
}

// ============================================
// ERROS DE NOT FOUND (404)
// ============================================

export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND';
  readonly statusCode = 404;

  constructor(resource: string, identifier?: string) {
    super(
      identifier
        ? `${resource} não encontrado: ${identifier}`
        : `${resource} não encontrado`
    );
  }
}

export class ClienteNotFoundError extends NotFoundError {
  constructor(id: string) {
    super('Cliente', id);
  }
}

export class PlacaNotFoundError extends NotFoundError {
  constructor(id: string) {
    super('Placa', id);
  }
}

export class ContratoNotFoundError extends NotFoundError {
  constructor(id: string) {
    super('Contrato', id);
  }
}

export class AluguelNotFoundError extends NotFoundError {
  constructor(id: string) {
    super('Aluguel', id);
  }
}

export class PropostaInternaNotFoundError extends NotFoundError {
  constructor(id: string) {
    super('Proposta Interna', id);
  }
}

// ============================================
// ERROS DE CONFLITO (409)
// ============================================

export class ConflictError extends DomainError {
  readonly code = 'CONFLICT';
  readonly statusCode = 409;

  constructor(message: string) {
    super(message);
  }
}

export class ResourceAlreadyExistsError extends DomainError {
  readonly code = 'RESOURCE_ALREADY_EXISTS';
  readonly statusCode = 409;

  constructor(resource: string, field?: string, value?: string) {
    super(
      field && value
        ? `${resource} já existe com ${field} = "${value}"`
        : `${resource} já existe`
    );
  }
}

export class DuplicateKeyError extends DomainError {
  readonly code = 'DUPLICATE_KEY';
  readonly statusCode = 409;
  readonly field: string;

  constructor(field: string) {
    super(`Já existe um registro com este ${field}`);
    this.field = field;
  }
}

// ============================================
// ERROS DE BUSINESS LOGIC (422)
// ============================================

export class BusinessRuleViolationError extends DomainError {
  readonly code = 'BUSINESS_RULE_VIOLATION';
  readonly statusCode = 422;

  constructor(message: string) {
    super(message);
  }
}

export class PlacaNotAvailableError extends BusinessRuleViolationError {
  constructor(placaId: string) {
    super(`Placa ${placaId} não está disponível para aluguel`);
  }
}

export class InvalidDateRangeError extends BusinessRuleViolationError {
  constructor() {
    super('Data de início deve ser anterior à data de fim');
  }
}

export class AluguelOverlapError extends BusinessRuleViolationError {
  constructor(placaId: string) {
    super(`Período de aluguel conflita com outro aluguel da placa ${placaId}`);
  }
}

export class ContratoCannotBeDeletedError extends BusinessRuleViolationError {
  constructor(status: string) {
    super(`Não é possível deletar um contrato com status: ${status}`);
  }
}

export class ClienteHasDependenciesError extends BusinessRuleViolationError {
  constructor(dependencies: string[]) {
    super(
      `Cliente possui dependências e não pode ser deletado: ${dependencies.join(', ')}`
    );
  }
}

// ============================================
// ERROS EXTERNOS (502, 503, 504)
// ============================================

export class ExternalServiceError extends DomainError {
  readonly code = 'EXTERNAL_SERVICE_ERROR';
  readonly statusCode = 502;
  readonly service: string;

  constructor(service: string, message: string) {
    super(`Erro no serviço externo ${service}: ${message}`);
    this.service = service;
  }
}

export class DatabaseError extends DomainError {
  readonly code = 'DATABASE_ERROR';
  readonly statusCode = 503;
  readonly operation: string;

  constructor(operation: string, details?: string) {
    super(`Erro de banco de dados durante ${operation}${details ? `: ${details}` : ''}`);
    this.operation = operation;
  }
}

export class CacheError extends DomainError {
  readonly code = 'CACHE_ERROR';
  readonly statusCode = 503;

  constructor(operation: string) {
    super(`Erro de cache durante ${operation}`);
  }
}

export class TimeoutError extends DomainError {
  readonly code = 'TIMEOUT';
  readonly statusCode = 504;

  constructor(operation: string, timeoutMs: number) {
    super(`Timeout após ${timeoutMs}ms durante ${operation}`);
  }
}

// ============================================
// ERROS INTERNOS (500)
// ============================================

export class InternalError extends DomainError {
  readonly code = 'INTERNAL_ERROR';
  readonly statusCode = 500;

  constructor(message = 'Erro interno do servidor', context?: Record<string, any>) {
    super(message, context);
  }
}

export class UnexpectedError extends DomainError {
  readonly code = 'UNEXPECTED_ERROR';
  readonly statusCode = 500;
  readonly originalError?: unknown;

  constructor(error: unknown, context?: Record<string, any>) {
    const message = error instanceof Error ? error.message : 'Erro inesperado';
    super(message, context);
    this.originalError = error;
  }
}

export class NotImplementedError extends DomainError {
  readonly code = 'NOT_IMPLEMENTED';
  readonly statusCode = 501;

  constructor(feature: string) {
    super(`Funcionalidade não implementada: ${feature}`);
  }
}

// ============================================
// HELPERS
// ============================================

/**
 * Type guard para DomainError
 */
export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}

/**
 * Converte erro desconhecido para DomainError
 */
export function toDomainError(error: unknown, context?: Record<string, any>): DomainError {
  if (isDomainError(error)) {
    return error;
  }

  if (error instanceof Error) {
    // Mongoose validation error
    if (error.name === 'ValidationError') {
      return new ValidationError([{ field: 'unknown', message: error.message }]);
    }

    // Mongoose cast error
    if (error.name === 'CastError') {
      return new InvalidObjectIdError('_id', 'unknown');
    }

    // MongoDB duplicate key
    if ('code' in error && error.code === 11000) {
      const field = 'keyPattern' in error && error.keyPattern && typeof error.keyPattern === 'object'
        ? Object.keys(error.keyPattern)[0] || 'unknown'
        : 'unknown';
      return new DuplicateKeyError(field);
    }

    return new UnexpectedError(error, context);
  }

  return new UnexpectedError(error, context);
}

/**
 * Extrai status code de um erro
 */
export function getErrorStatusCode(error: unknown): number {
  if (isDomainError(error)) {
    return error.statusCode;
  }
  return 500;
}

/**
 * Extrai mensagem de um erro
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Erro desconhecido';
}
