/**
 * Core System - Export Central
 * 
 * Sistema de fundação type-safe da API incluindo:
 * - Result Pattern para error handling
 * - Domain Errors hierarchy
 * - Singleton Managers (DB, Cache, Logger)
 */

// Result Pattern
export { Result, UnwrapResult, UnwrapError } from './Result';

// Domain Errors
export {
  // Base
  DomainError,
  
  // Validation (400)
  ValidationError,
  InvalidInputError,
  InvalidObjectIdError,
  RequiredFieldError,
  
  // Authentication (401)
  UnauthorizedError,
  InvalidCredentialsError,
  TokenExpiredError,
  InvalidTokenError,
  
  // Authorization (403)
  ForbiddenError,
  InsufficientPermissionsError,
  
  // Not Found (404)
  NotFoundError,
  ClienteNotFoundError,
  PlacaNotFoundError,
  ContratoNotFoundError,
  AluguelNotFoundError,
  PropostaInternaNotFoundError,
  
  // Conflict (409)
  ConflictError,
  ResourceAlreadyExistsError,
  DuplicateKeyError,
  
  // Business Rules (422)
  BusinessRuleViolationError,
  PlacaNotAvailableError,
  InvalidDateRangeError,
  AluguelOverlapError,
  ContratoCannotBeDeletedError,
  ClienteHasDependenciesError,
  
  // External/Infrastructure (502-504)
  ExternalServiceError,
  DatabaseError,
  CacheError,
  TimeoutError,
  
  // Internal (500)
  InternalError,
  UnexpectedError,
  NotImplementedError,
  
  // Helpers
  isDomainError,
  toDomainError,
  getErrorStatusCode,
  getErrorMessage
} from './DomainError';

// Singleton Managers
export {
  DB,
  Cache,
  Log,
  type DatabaseConfig,
  type CacheConfig,
  type LoggerConfig
} from './Managers';

// ============================================
// RE-EXPORT COMMON TYPES
// ============================================

import { Result } from './Result';
import type { DomainError } from './DomainError';

/**
 * Tipo comum para operações assíncronas que podem falhar
 */
export type AsyncResult<T> = Promise<Result<T, DomainError>>;

/**
 * Tipo para funções que retornam Result
 */
export type ResultFn<T, E = DomainError> = () => Result<T, E>;

/**
 * Tipo para funções assíncronas que retornam Result
 */
export type AsyncResultFn<T, E = DomainError> = () => Promise<Result<T, E>>;
