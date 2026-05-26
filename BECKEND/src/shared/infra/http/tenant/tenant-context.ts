import { Request } from 'express';
import AppError from '@shared/container/AppError';
import { IUserPayload } from '../../../../types/express';

export type TenantAuthSource = 'jwt' | 'api-key';

export interface TenantContext {
  empresaId: string;
  authSource: TenantAuthSource;
  userId?: string;
  role?: string;
}

function normalizeEmpresaId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function createTenantContextFromJwt(user: IUserPayload): TenantContext {
  const empresaId = normalizeEmpresaId(user.empresaId);
  if (!empresaId) {
    throw new AppError('Token inválido: empresaId ausente.', 403);
  }

  return {
    empresaId,
    authSource: 'jwt',
    userId: user.id,
    role: user.role,
  };
}

export function createTenantContextFromApiKey(empresa: { _id?: { toString(): string } | string }): TenantContext {
  const rawEmpresaId = typeof empresa?._id === 'string' ? empresa._id : empresa?._id?.toString();
  const empresaId = normalizeEmpresaId(rawEmpresaId);

  if (!empresaId) {
    throw new AppError('Empresa inválida para autenticação por API Key.', 403);
  }

  return {
    empresaId,
    authSource: 'api-key',
  };
}

export function requireEmpresaId(req: Request): string {
  const byTenantContext = normalizeEmpresaId(req.tenantContext?.empresaId);
  if (byTenantContext) return byTenantContext;

  const byUser = normalizeEmpresaId(req.user?.empresaId);
  if (byUser) return byUser;

  const byEmpresa = normalizeEmpresaId(
    typeof req.empresa?._id === 'string' ? req.empresa._id : req.empresa?._id?.toString()
  );
  if (byEmpresa) return byEmpresa;

  throw new AppError('empresaId obrigatório para operação multi-tenant.', 403);
}
