/**
 * SISTEMA GLOBAL DA API
 * 
 * Este arquivo centraliza TODOS os exports, tipos, constantes, 
 * serviços e utilitários da API em um único ponto de acesso.
 * 
 * USO:
 * ```typescript
 * import { 
 *   Models, 
 *   Services, 
 *   Result,
 *   DB,
 *   Cache,
 *   Log,
 *   ValidationError,
 *   STATUS,
 *   HTTP_STATUS,
 *   successResponse,
 *   validateObjectId 
 * } from '@shared/global';
 * ```
 */

// ============================================
// RE-EXPORTS DE CORE (Result Pattern + Errors)
// ============================================

export {
  // Result Pattern
  Result,
  UnwrapResult,
  UnwrapError,
  
  // Domain Errors Base
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
  
  // Singleton Managers
  DB,
  Cache,
  Log,
  
  // Types
  type AsyncResult,
  type ResultFn,
  type AsyncResultFn,
  type DatabaseConfig,
  type CacheConfig,
  type LoggerConfig
} from '@shared/core';

// ============================================
// RE-EXPORTS DE TIPOS
// ============================================

export * from '@shared/types';

// ============================================
// RE-EXPORTS DE CONSTANTES
// ============================================

export * from '@shared/constants';

// ============================================
// RE-EXPORTS DE GLOBALS
// ============================================

export * from '@shared/globals';

// ============================================
// IMPORT SIMPLIFICADO
// ============================================

import { Models, Services, Config, AppError, logger } from '@shared/globals';
import {
  STATUS,
  ROLES,
  PERMISSIONS,
  HTTP_STATUS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  PAGINATION,
  UPLOAD,
  CACHE,
  JWT,
  REGEX
} from '@shared/constants';

// ============================================
// EXPORTS NOMEADOS PRINCIPAIS
// ============================================

export {
  // Principais
  Models,
  Services,
  Config,
  AppError,
  logger,
  
  // Constantes mais usadas
  STATUS,
  ROLES,
  PERMISSIONS,
  HTTP_STATUS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  PAGINATION,
  UPLOAD,
  CACHE as CACHE_CONFIG,
  JWT,
  REGEX
};

// ============================================
// DEFAULT EXPORT (Objeto Global)
// ============================================

const GlobalAPI = {
  // Modelos
  Models,
  
  // Serviços
  Services,
  
  // Configurações
  Config,
  
  // Utilitários
  Utils: {
    AppError,
    logger
  },
  
  // Constantes
  Constants: {
    STATUS,
    ROLES,
    PERMISSIONS,
    HTTP_STATUS,
    ERROR_MESSAGES,
    SUCCESS_MESSAGES,
    PAGINATION,
    UPLOAD,
    CACHE,
    JWT,
    REGEX
  }
};

export default GlobalAPI;

// ============================================
// TIPOS AUXILIARES PARA INTELLISENSE
// ============================================

/**
 * Tipo que representa o objeto global da API
 */
export type GlobalAPIType = typeof GlobalAPI;

/**
 * Tipo que representa os modelos disponíveis
 */
export type AvailableModels = keyof typeof Models;

/**
 * Tipo que representa os serviços disponíveis
 */
export type AvailableServices = keyof typeof Services;

/**
 * Tipo que representa as constantes de status
 */
export type StatusTypes = typeof STATUS;

/**
 * Tipo que representa os roles disponíveis
 */
export type UserRoles = typeof ROLES[keyof typeof ROLES];

/**
 * Tipo que representa as permissões disponíveis
 */
export type UserPermissions = typeof PERMISSIONS[keyof typeof PERMISSIONS];
