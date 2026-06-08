/**
 * Testes unitários — resolveTenantMiddleware + requirePermission com OrganizationContext
 */

// ── Mocks ──────────────────────────────────────────────────────────────────────

jest.mock('@modules/organization/organization.schema', () => ({
  Organization: { findOne: jest.fn() },
}));

jest.mock('@modules/organization/membership/tenant-membership.schema', () => ({
  TenantMembership: { findOne: jest.fn() },
  // Exportar tipos como valores para o mock não quebrar
}));

jest.mock('@shared/container/logger', () => ({
  __esModule: true,
  default: { debug: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

jest.mock('@modules/audit/audit.service', () => ({
  defaultAuditService: { recordPermissionDenied: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('@modules/audit/audit.helpers', () => ({
  auditRequestContext: jest.fn().mockReturnValue({ userId: 'u1', empresaId: 'e1' }),
}));

// ── Imports ────────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';
import { resolveTenantMiddleware } from '@shared/tenant/tenant-resolution.middleware';
import { requirePermission } from '@shared/infra/http/middlewares/permissions.middleware';
import { Organization } from '@modules/organization/organization.schema';
import { TenantMembership } from '@modules/organization/membership/tenant-membership.schema';
import { Types } from 'mongoose';

const MockedOrg = Organization as unknown as { findOne: jest.Mock };
const MockedMembership = TenantMembership as unknown as { findOne: jest.Mock };

// ── Fixtures ──────────────────────────────────────────────────────────────────

const EMPRESA_ID = '507f1f77bcf86cd799439011';
const USER_ID    = '507f1f77bcf86cd799439012';
const ORG_ID     = '507f1f77bcf86cd799439013';
const MB_ID      = '507f1f77bcf86cd799439014';

const fakeOrg = {
  _id: new Types.ObjectId(ORG_ID),
  name: 'Inmidia OOH',
  legacyEmpresaId: new Types.ObjectId(EMPRESA_ID),
};

const fakeMembership = {
  _id: new Types.ObjectId(MB_ID),
  organizationId: new Types.ObjectId(ORG_ID),
  userId: new Types.ObjectId(USER_ID),
  role: 'ADMIN',
  status: 'ACTIVE',
};

function buildReq(overrides: Partial<Request> = {}): Request {
  return {
    user: { id: USER_ID, email: 'test@test.com', empresaId: EMPRESA_ID, role: 'gestor' },
    tenantContext: { empresaId: EMPRESA_ID, authSource: 'jwt' },
    empresaId: EMPRESA_ID,
    permissionContext: {
      userId: USER_ID,
      empresaId: EMPRESA_ID,
      role: 'gestor',
      permissions: ['placas.read', 'dashboard.read', 'inventory.read'],
      authSource: 'jwt',
    },
    ...overrides,
  } as unknown as Request;
}

function buildRes(): Response {
  return {} as Response;
}

function buildNext(): NextFunction {
  return jest.fn();
}

// ── Suite: resolveTenantMiddleware ─────────────────────────────────────────────

describe('resolveTenantMiddleware', () => {
  beforeEach(() => jest.clearAllMocks());

  it('resolve organization via legacyEmpresaId', async () => {
    MockedOrg.findOne.mockReturnValue({ lean: () => Promise.resolve(fakeOrg) });
    MockedMembership.findOne.mockReturnValue({ lean: () => Promise.resolve(fakeMembership) });

    const req = buildReq();
    const next = buildNext();
    await resolveTenantMiddleware(req, buildRes(), next);

    expect(req.organizationContext?.organizationId).toBe(ORG_ID);
    expect(req.organizationContext?.legacyEmpresaId).toBe(EMPRESA_ID);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('resolve membership ACTIVE e usa role do membership', async () => {
    MockedOrg.findOne.mockReturnValue({ lean: () => Promise.resolve(fakeOrg) });
    MockedMembership.findOne.mockReturnValue({ lean: () => Promise.resolve(fakeMembership) });

    const req = buildReq();
    await resolveTenantMiddleware(req, buildRes(), buildNext());

    expect(req.organizationContext?.role).toBe('ADMIN');
    expect(req.organizationContext?.membershipId).toBe(MB_ID);
    expect(req.organizationContext?.isLegacyFallback).toBe(false);
  });

  it('resolve permissões do membership — ADMIN tem placas.read e admin.access', async () => {
    MockedOrg.findOne.mockReturnValue({ lean: () => Promise.resolve(fakeOrg) });
    MockedMembership.findOne.mockReturnValue({ lean: () => Promise.resolve(fakeMembership) });

    const req = buildReq();
    await resolveTenantMiddleware(req, buildRes(), buildNext());

    expect(req.organizationContext?.permissions).toContain('placas.read');
    expect(req.organizationContext?.permissions).toContain('admin.access');
  });

  it('usa fallback legado quando org não existe', async () => {
    MockedOrg.findOne.mockReturnValue({ lean: () => Promise.resolve(null) });

    const req = buildReq();
    await resolveTenantMiddleware(req, buildRes(), buildNext());

    expect(req.organizationContext?.isLegacyFallback).toBe(true);
    expect(req.organizationContext?.organizationId).toBeNull();
    expect(req.organizationContext?.role).toBe('gestor');
  });

  it('usa fallback legado quando membership não existe para o usuário', async () => {
    MockedOrg.findOne.mockReturnValue({ lean: () => Promise.resolve(fakeOrg) });
    MockedMembership.findOne.mockReturnValue({ lean: () => Promise.resolve(null) });

    const req = buildReq();
    await resolveTenantMiddleware(req, buildRes(), buildNext());

    expect(req.organizationContext?.isLegacyFallback).toBe(true);
    expect(req.organizationContext?.organizationId).toBe(ORG_ID);
    expect(req.organizationContext?.membershipId).toBeUndefined();
  });

  it('membership REMOVED/SUSPENDED não é encontrado (status = ACTIVE required)', async () => {
    MockedOrg.findOne.mockReturnValue({ lean: () => Promise.resolve(fakeOrg) });
    MockedMembership.findOne.mockReturnValue({ lean: () => Promise.resolve(null) }); // ACTIVE filter returns null

    const req = buildReq();
    await resolveTenantMiddleware(req, buildRes(), buildNext());

    // Fallback legado — membership REMOVED/SUSPENDED não autoriza
    expect(req.organizationContext?.isLegacyFallback).toBe(true);
  });

  it('chama next() mesmo quando DB lança erro (graceful degradation)', async () => {
    MockedOrg.findOne.mockReturnValue({ lean: () => Promise.reject(new Error('DB timeout')) });

    const req = buildReq();
    const next = buildNext();
    await resolveTenantMiddleware(req, buildRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.organizationContext?.isLegacyFallback).toBe(true);
  });

  it('não processa quando user ou empresaId estão ausentes', async () => {
    const req = buildReq({ user: undefined });
    const next = buildNext();
    await resolveTenantMiddleware(req, buildRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.organizationContext).toBeUndefined();
  });
});

// ── Suite: requirePermission com OrganizationContext ──────────────────────────

describe('requirePermission — prioriza organizationContext', () => {
  beforeEach(() => jest.clearAllMocks());

  it('permite acesso quando org context tem permissão', async () => {
    const req = buildReq({
      organizationContext: {
        organizationId: ORG_ID,
        legacyEmpresaId: EMPRESA_ID,
        userId: USER_ID,
        membershipId: MB_ID,
        role: 'ADMIN',
        permissions: ['placas.read', 'admin.access', 'inventory.read'],
        isLegacyFallback: false,
      },
    });
    const next = buildNext();

    await requirePermission('inventory.read')(req, buildRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(); // sem erro
  });

  it('nega acesso 403 quando org context não tem permissão', async () => {
    const req = buildReq({
      organizationContext: {
        organizationId: ORG_ID,
        legacyEmpresaId: EMPRESA_ID,
        userId: USER_ID,
        membershipId: MB_ID,
        role: 'VIEWER',
        permissions: ['placas.read', 'inventory.read'],
        isLegacyFallback: false,
      },
    });
    const next = buildNext();

    await requirePermission('admin.access')(req, buildRes(), next);

    // next é chamado com AppError 403
    expect(next).toHaveBeenCalledTimes(1);
    const err = (next as jest.Mock).mock.calls[0]?.[0];
    expect(err?.statusCode).toBe(403);
  });

  it('usa fallback legado quando isLegacyFallback=true mesmo com org context', async () => {
    const req = buildReq({
      organizationContext: {
        organizationId: ORG_ID,
        legacyEmpresaId: EMPRESA_ID,
        userId: USER_ID,
        membershipId: undefined,
        role: 'gestor',
        // permissões legadas do JWT (gestor inclui placas.read)
        permissions: ['placas.read', 'dashboard.read', 'inventory.read'],
        isLegacyFallback: true,
      },
      permissionContext: {
        userId: USER_ID,
        empresaId: EMPRESA_ID,
        role: 'gestor',
        permissions: ['placas.read', 'dashboard.read', 'inventory.read'],
        authSource: 'jwt',
      },
    });
    const next = buildNext();

    await requirePermission('inventory.read')(req, buildRes(), next);

    expect(next).toHaveBeenCalledWith();
  });

  it('org context sem permissão não pode ser escalado por permissionContext do JWT', async () => {
    // Cenário: VIEWER no membership, mas JWT teria superadmin (simulação de tentativa de elevação)
    const req = buildReq({
      organizationContext: {
        organizationId: ORG_ID,
        legacyEmpresaId: EMPRESA_ID,
        userId: USER_ID,
        membershipId: MB_ID,
        role: 'VIEWER',
        permissions: ['placas.read', 'inventory.read'],
        isLegacyFallback: false,
      },
      permissionContext: {
        userId: USER_ID,
        empresaId: EMPRESA_ID,
        role: 'superadmin', // elevado indevidamente no JWT
        permissions: ['admin.access', 'placas.delete', 'usuarios.manage'],
        authSource: 'jwt',
      },
    });
    const next = buildNext();

    await requirePermission('admin.access')(req, buildRes(), next);

    const err = (next as jest.Mock).mock.calls[0]?.[0];
    expect(err?.statusCode).toBe(403); // JWT não eleva acesso
  });

  it('nega quando permissionContext ausente e sem org context', async () => {
    const req = buildReq({ permissionContext: undefined });
    const next = buildNext();

    await requirePermission('inventory.read')(req, buildRes(), next);

    const err = (next as jest.Mock).mock.calls[0]?.[0];
    expect(err?.statusCode).toBe(403);
  });
});
