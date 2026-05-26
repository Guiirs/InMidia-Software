import { Request } from 'express';
import AppError from '@shared/container/AppError';

/**
 * Type guard to ensure req.user exists and has required properties
 * Throws 401 if user is not authenticated
 */
export function assertAuthenticated(req: Request): asserts req is Request & { user: NonNullable<Request['user']> } {
  if (!req.user) {
    throw new AppError('Usuário não autenticado', 401);
  }
  
  if (!req.user.id || !req.user.email || !req.user.empresaId) {
    throw new AppError('Token inválido: payload incompleto', 403);
  }
}

/**
 * Type guard to ensure req.admin exists
 * Throws 401 if admin is not authenticated
 */
export function assertAdminAuthenticated(req: Request): asserts req is Request & { admin: NonNullable<Request['admin']> } {
  if (!req.admin) {
    throw new AppError('Admin não autenticado', 401);
  }
  
  if (!req.admin.id || !req.admin.username) {
    throw new AppError('Token de admin inválido', 403);
  }
}

/**
 * Type guard to ensure req.empresa exists (API Key auth)
 * Throws 401 if empresa is not found
 */
export function assertEmpresaAuthenticated(req: Request): asserts req is Request & { empresa: NonNullable<Request['empresa']> } {
  if (!req.empresa) {
    throw new AppError('Empresa não autenticada via API Key', 401);
  }
}
