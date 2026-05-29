import { JwtPayload } from 'jsonwebtoken';
import { ObjectId } from 'mongoose';
import type { PermissionContext, Role } from '@shared/infra/http/permissions/permissions.types';
import type { SecurityContext } from '@security/block-auth/types/blockAuth.types';

/**
 * User payload from JWT token
 */
export interface IUserPayload {
  id: string;
  email: string;
  nome?: string;
  role?: Role | string;
  empresaId: string; // Required for business logic
  username?: string;
}

/**
 * Admin payload from JWT token
 */
export interface IAdminPayload {
  id: string;
  username: string;
  role: 'admin' | 'superadmin';
}

export interface ITenantContext {
  empresaId: string;
  authSource: 'jwt' | 'api-key';
  userId?: string;
  role?: Role | string;
}

/**
 * Extend Express Request globally with authenticated user
 */
declare global {
  namespace Express {
    interface Request {
      user?: IUserPayload;
      admin?: IAdminPayload;
      tenantContext?: ITenantContext;
      permissionContext?: PermissionContext;
      empresaId?: string;
      empresa?: {
        _id: ObjectId;
        nome: string;
        cnpj?: string;
      };
      securityContext?: SecurityContext;
    }
  }
}

/**
 * Extended Express Request with authenticated user (Legacy - use Request directly)
 * @deprecated Use Express.Request instead - keeping for backward compatibility
 */
export interface IAuthRequest extends Express.Request {
  user?: IUserPayload;
}

/**
 * Extended Express Request with authenticated admin (Legacy - use Request directly)
 * @deprecated Use Express.Request instead
 */
export interface IAdminRequest extends Express.Request {
  admin?: IAdminPayload;
}

/**
 * Extended Express Request with empresa from API Key (Legacy - use Request directly)
 * @deprecated Use Express.Request instead
 */
export interface IApiKeyRequest extends Express.Request {
  empresa?: {
    _id: ObjectId;
    nome: string;
    cnpj?: string;
  };
}

/**
 * API Response structure
 */
export interface IApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  errors?: Array<{ field: string; message: string }>;
}

/**
 * Pagination parameters
 */
export interface IPaginationParams {
  page: number;
  limit: number;
  skip: number;
}

/**
 * Paginated response
 */
export interface IPaginatedResponse<T> extends IApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Query filters
 */
export interface IQueryFilters {
  search?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  [key: string]: any;
}
