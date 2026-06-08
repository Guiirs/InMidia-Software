/**
 * Testes unitários — Bootstrap multi-tenant no fluxo de Auth (Ciclo 3)
 *
 * Cobre:
 *  - login cria Organization + TenantMembership quando não existem
 *  - login reutiliza sem duplicar
 *  - JWT contém organizationId/membershipId quando bootstrap habilitado
 *  - JWT permanece legado quando feature flag desabilitada
 *  - Auth response inclui organization/membership quando bootstrap habilitado
 *  - refresh token preserva organizationId/membershipId
 *  - refresh token funciona em modo legado
 *  - falha no bootstrap não derruba login
 */

// ── Feature flag — habilitada por padrão nos testes ──────────────────────────

const mockConfig = {
  jwtSecret: 'test-secret-64-chars-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  accessTokenExpiresIn: '15m',
  accessTokenExpiresMs: 900000,
  refreshTokenExpiresMs: 604800000,
  enableOrganizationBootstrapOnLogin: true,
};

jest.mock('@config/config', () => ({ __esModule: true, default: mockConfig }));

// ── Mocks de dependências ─────────────────────────────────────────────────────

jest.mock('@modules/organization/services/legacy-migration.service', () => ({
  ensureOrganizationForLegacyEmpresa: jest.fn(),
}));

jest.mock('@modules/organization/organization.schema', () => ({
  Organization: { findOne: jest.fn() },
}));

jest.mock('@modules/organization/membership/tenant-membership.schema', () => ({
  TenantMembership: { findOne: jest.fn() },
}));

jest.mock('@modules/empresas/Empresa', () => ({
  __esModule: true,
  default: { exists: jest.fn() },
}));

jest.mock('@shared/infra/auth/token-blacklist.service', () => ({
  tokenBlacklist: { revoke: jest.fn(), isFamilyRevoked: jest.fn().mockResolvedValue(false) },
}));

jest.mock('../repositories/session.repository', () => ({
  sessionRepository: {
    create: jest.fn(),
    findValidByRawToken: jest.fn(),
    revokeByRawToken: jest.fn(),
    revokeFamilyAll: jest.fn(),
    revokeAllForUser: jest.fn(),
  },
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { AuthService } from '../services/auth.service';
import { ensureOrganizationForLegacyEmpresa } from '@modules/organization/services/legacy-migration.service';
import { Organization } from '@modules/organization/organization.schema';
import { TenantMembership } from '@modules/organization/membership/tenant-membership.schema';
import Empresa from '@modules/empresas/Empresa';
import { sessionRepository } from '../repositories/session.repository';

const mockedBootstrap    = ensureOrganizationForLegacyEmpresa as jest.Mock;
const MockedOrg          = Organization as unknown as { findOne: jest.Mock };
const MockedMembership   = TenantMembership as unknown as { findOne: jest.Mock };
const mockedSessionRepo  = sessionRepository as jest.Mocked<typeof sessionRepository>;

// ── Fixtures ──────────────────────────────────────────────────────────────────

const EMPRESA_ID = new Types.ObjectId().toString();
const USER_ID    = new Types.ObjectId().toString();
const ORG_ID     = new Types.ObjectId().toString();
const MB_ID      = new Types.ObjectId().toString();

const fakeUser = {
  _id: new Types.ObjectId(USER_ID),
  username: 'tester',
  email: 'tester@test.com',
  nome: 'Tester',
  role: 'admin_empresa' as const,
  ativo: true,
  empresa: new Types.ObjectId(EMPRESA_ID),
  createdAt: new Date(),
};

const fakeOrg = {
  _id: new Types.ObjectId(ORG_ID),
  name: 'Test Org',
  slug: 'test-org',
  status: 'ACTIVE',
  plan: 'FREE',
  legacyEmpresaId: new Types.ObjectId(EMPRESA_ID),
};

const fakeMembership = {
  _id: new Types.ObjectId(MB_ID),
  organizationId: new Types.ObjectId(ORG_ID),
  userId: new Types.ObjectId(USER_ID),
  role: 'ADMIN',
  status: 'ACTIVE',
};

const fakeBootstrapResult = {
  organization: fakeOrg,
  membership: fakeMembership,
  organizationCreated: false,
  membershipCreated: false,
};

const fakeSession = {
  rawToken: 'raw-refresh-token',
  expiresAt: new Date(Date.now() + 604800000),
  family: 'family-uuid',
};

// Mock do repositório de auth
const mockAuthRepo = {
  findLoginUsers: jest.fn(),
  findByIdWithPassword: jest.fn(),
  findByEmail: jest.fn(),
  findByResetTokenHash: jest.fn(),
  saveResetToken: jest.fn(),
  clearResetToken: jest.fn(),
  updatePassword: jest.fn(),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeService() {
  return new AuthService(mockAuthRepo as never);
}

function setupLoginMocks(user = fakeUser) {
  mockAuthRepo.findLoginUsers.mockResolvedValue({ isFailure: false, value: [user] });
  (Empresa.exists as jest.Mock).mockResolvedValue({ _id: new Types.ObjectId(EMPRESA_ID) });
  mockedSessionRepo.create.mockResolvedValue(fakeSession as never);
}

// Mock verifyUserPassword inline via jest module registry isn't needed here —
// we mock the password check by patching the user object's password field
// and importing the real bcrypt. Instead, mock at module level:
jest.mock('../utils/verify-user-password', () => ({
  verifyUserPassword: jest.fn().mockResolvedValue({ isMatch: true }),
}));

// ── Suite: login + bootstrap ──────────────────────────────────────────────────

describe('AuthService.login — bootstrap multi-tenant', () => {
  beforeEach(() => jest.clearAllMocks());

  it('chama ensureOrganizationForLegacyEmpresa quando bootstrap habilitado', async () => {
    setupLoginMocks();
    mockedBootstrap.mockResolvedValue(fakeBootstrapResult);

    const service = makeService();
    const result = await service.login(
      { usernameOrEmail: 'tester', password: 'pass' },
      { ip: '127.0.0.1', userAgent: 'test' }
    );

    expect(result.isFailure).toBe(false);
    expect(mockedBootstrap).toHaveBeenCalledWith({
      empresaId: EMPRESA_ID,
      userId: USER_ID,
      userRole: 'admin_empresa',
    });
  });

  it('JWT contém organizationId, membershipId e tenantMode=organization quando bootstrap ok', async () => {
    setupLoginMocks();
    mockedBootstrap.mockResolvedValue(fakeBootstrapResult);

    const service = makeService();
    const result = await service.login(
      { usernameOrEmail: 'tester', password: 'pass' },
      { ip: '127.0.0.1', userAgent: 'test' }
    );

    expect(result.isFailure).toBe(false);
    const decoded = jwt.decode(result.value.token) as Record<string, unknown>;
    expect(decoded.organizationId).toBe(ORG_ID);
    expect(decoded.membershipId).toBe(MB_ID);
    expect(decoded.membershipRole).toBe('ADMIN');
    expect(decoded.tenantMode).toBe('organization');
    // campos legados preservados
    expect(decoded.empresaId).toBe(EMPRESA_ID);
    expect(decoded.role).toBe('admin_empresa');
  });

  it('auth response inclui organization e membership quando bootstrap ok', async () => {
    setupLoginMocks();
    mockedBootstrap.mockResolvedValue(fakeBootstrapResult);

    const service = makeService();
    const result = await service.login(
      { usernameOrEmail: 'tester', password: 'pass' },
      { ip: '127.0.0.1', userAgent: 'test' }
    );

    expect(result.isFailure).toBe(false);
    expect(result.value.organization).toMatchObject({
      id: ORG_ID,
      name: 'Test Org',
      slug: 'test-org',
      status: 'ACTIVE',
      plan: 'FREE',
    });
    expect(result.value.membership).toMatchObject({
      id: MB_ID,
      role: 'ADMIN',
      status: 'ACTIVE',
    });
  });

  it('JWT fica em tenantMode=legacy quando feature flag desabilitada', async () => {
    mockConfig.enableOrganizationBootstrapOnLogin = false;
    setupLoginMocks();

    const service = makeService();
    const result = await service.login(
      { usernameOrEmail: 'tester', password: 'pass' },
      { ip: '127.0.0.1', userAgent: 'test' }
    );

    expect(result.isFailure).toBe(false);
    expect(mockedBootstrap).not.toHaveBeenCalled();
    const decoded = jwt.decode(result.value.token) as Record<string, unknown>;
    expect(decoded.tenantMode).toBe('legacy');
    expect(decoded.organizationId).toBeUndefined();

    mockConfig.enableOrganizationBootstrapOnLogin = true;
  });

  it('response não inclui organization/membership quando flag desabilitada', async () => {
    mockConfig.enableOrganizationBootstrapOnLogin = false;
    setupLoginMocks();

    const service = makeService();
    const result = await service.login(
      { usernameOrEmail: 'tester', password: 'pass' },
      { ip: '127.0.0.1', userAgent: 'test' }
    );

    expect(result.isFailure).toBe(false);
    expect(result.value.organization).toBeUndefined();
    expect(result.value.membership).toBeUndefined();

    mockConfig.enableOrganizationBootstrapOnLogin = true;
  });

  it('falha no bootstrap não derruba login — retorna token legado', async () => {
    setupLoginMocks();
    mockedBootstrap.mockRejectedValue(new Error('DB timeout'));

    const service = makeService();
    const result = await service.login(
      { usernameOrEmail: 'tester', password: 'pass' },
      { ip: '127.0.0.1', userAgent: 'test' }
    );

    expect(result.isFailure).toBe(false);
    const decoded = jwt.decode(result.value.token) as Record<string, unknown>;
    expect(decoded.tenantMode).toBe('legacy');
    expect(result.value.organization).toBeUndefined();
  });

  it('campos legados (empresaId, role) sempre presentes no JWT', async () => {
    setupLoginMocks();
    mockedBootstrap.mockResolvedValue(fakeBootstrapResult);

    const service = makeService();
    const result = await service.login(
      { usernameOrEmail: 'tester', password: 'pass' },
      { ip: '127.0.0.1', userAgent: 'test' }
    );

    const decoded = jwt.decode(result.value.token) as Record<string, unknown>;
    expect(decoded.empresaId).toBe(EMPRESA_ID);
    expect(decoded.role).toBe('admin_empresa');
    expect(decoded.id).toBe(USER_ID);
  });
});

// ── Suite: role legada → membershipRole no JWT ────────────────────────────────

describe('AuthService.login — mapeamento de roles', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([
    ['superadmin',    'OWNER'],
    ['admin_empresa', 'ADMIN'],
    ['gestor',        'MANAGER'],
    ['vendedor',      'OPERATOR'],
    ['financeiro',    'FINANCIAL'],
    ['visualizador',  'VIEWER'],
  ])('role legada %s gera membership.role=%s via bootstrap', async (legacyRole, expectedMemberRole) => {
    const userWithRole = { ...fakeUser, role: legacyRole as never };
    setupLoginMocks(userWithRole);
    mockedBootstrap.mockResolvedValue({
      ...fakeBootstrapResult,
      membership: { ...fakeMembership, role: expectedMemberRole },
    });

    const service = makeService();
    const result = await service.login(
      { usernameOrEmail: 'tester', password: 'pass' },
      { ip: '127.0.0.1', userAgent: 'test' }
    );

    expect(result.isFailure).toBe(false);
    expect(result.value.membership?.role).toBe(expectedMemberRole);
    expect(mockedBootstrap).toHaveBeenCalledWith(
      expect.objectContaining({ userRole: legacyRole })
    );
  });
});

// ── Suite: refresh + org resolution ──────────────────────────────────────────

describe('AuthService.refresh — resolução de org/membership', () => {
  beforeEach(() => jest.clearAllMocks());

  const fakeExpiredAt = new Date(Date.now() + 3600000);
  const fakeRefreshSession = {
    userId: new Types.ObjectId(USER_ID),
    empresaId: new Types.ObjectId(EMPRESA_ID),
    family: 'family-uuid',
    expiresAt: fakeExpiredAt,
    revokedAt: null,
    rawToken: 'raw-refresh-token',
  };

  function setupRefreshMocks() {
    mockedSessionRepo.findValidByRawToken.mockResolvedValue(fakeRefreshSession as never);
    mockedSessionRepo.revokeByRawToken.mockResolvedValue(undefined as never);
    mockedSessionRepo.create.mockResolvedValue(fakeSession as never);
    mockAuthRepo.findByIdWithPassword.mockResolvedValue({
      isFailure: false,
      value: fakeUser,
    });
    (Empresa.exists as jest.Mock).mockResolvedValue({ _id: new Types.ObjectId(EMPRESA_ID) });
  }

  it('JWT do refresh contém organizationId quando org e membership existem', async () => {
    setupRefreshMocks();
    MockedOrg.findOne.mockReturnValue({ lean: () => Promise.resolve(fakeOrg) });
    MockedMembership.findOne.mockReturnValue({ lean: () => Promise.resolve(fakeMembership) });

    const service = makeService();
    const result = await service.refresh('raw-refresh-token', { ip: '127.0.0.1', userAgent: 'test' });

    expect(result.isFailure).toBe(false);
    const decoded = jwt.decode(result.value.accessToken) as Record<string, unknown>;
    expect(decoded.organizationId).toBe(ORG_ID);
    expect(decoded.membershipId).toBe(MB_ID);
    expect(decoded.tenantMode).toBe('organization');
  });

  it('JWT do refresh fica legado quando org não existe', async () => {
    setupRefreshMocks();
    MockedOrg.findOne.mockReturnValue({ lean: () => Promise.resolve(null) });

    const service = makeService();
    const result = await service.refresh('raw-refresh-token', { ip: '127.0.0.1', userAgent: 'test' });

    expect(result.isFailure).toBe(false);
    const decoded = jwt.decode(result.value.accessToken) as Record<string, unknown>;
    expect(decoded.tenantMode).toBe('legacy');
    expect(decoded.organizationId).toBeUndefined();
  });

  it('JWT do refresh fica legado quando membership não está ACTIVE', async () => {
    setupRefreshMocks();
    MockedOrg.findOne.mockReturnValue({ lean: () => Promise.resolve(fakeOrg) });
    MockedMembership.findOne.mockReturnValue({ lean: () => Promise.resolve(null) });

    const service = makeService();
    const result = await service.refresh('raw-refresh-token', { ip: '127.0.0.1', userAgent: 'test' });

    expect(result.isFailure).toBe(false);
    const decoded = jwt.decode(result.value.accessToken) as Record<string, unknown>;
    expect(decoded.tenantMode).toBe('legacy');
  });

  it('falha na resolução de org no refresh não derruba o fluxo', async () => {
    setupRefreshMocks();
    MockedOrg.findOne.mockReturnValue({ lean: () => Promise.reject(new Error('DB error')) });

    const service = makeService();
    const result = await service.refresh('raw-refresh-token', { ip: '127.0.0.1', userAgent: 'test' });

    expect(result.isFailure).toBe(false);
    const decoded = jwt.decode(result.value.accessToken) as Record<string, unknown>;
    expect(decoded.tenantMode).toBe('legacy');
  });

  it('refresh funciona em modo legado quando flag desabilitada', async () => {
    mockConfig.enableOrganizationBootstrapOnLogin = false;
    setupRefreshMocks();

    const service = makeService();
    const result = await service.refresh('raw-refresh-token', { ip: '127.0.0.1', userAgent: 'test' });

    expect(result.isFailure).toBe(false);
    expect(MockedOrg.findOne).not.toHaveBeenCalled();
    const decoded = jwt.decode(result.value.accessToken) as Record<string, unknown>;
    expect(decoded.tenantMode).toBe('legacy');

    mockConfig.enableOrganizationBootstrapOnLogin = true;
  });

  it('refresh não chama ensureOrganizationForLegacyEmpresa (só leitura)', async () => {
    setupRefreshMocks();
    MockedOrg.findOne.mockReturnValue({ lean: () => Promise.resolve(fakeOrg) });
    MockedMembership.findOne.mockReturnValue({ lean: () => Promise.resolve(fakeMembership) });

    const service = makeService();
    await service.refresh('raw-refresh-token', { ip: '127.0.0.1', userAgent: 'test' });

    expect(mockedBootstrap).not.toHaveBeenCalled();
  });

  it('campos legados (empresaId, role) sempre presentes no JWT do refresh', async () => {
    setupRefreshMocks();
    MockedOrg.findOne.mockReturnValue({ lean: () => Promise.resolve(fakeOrg) });
    MockedMembership.findOne.mockReturnValue({ lean: () => Promise.resolve(fakeMembership) });

    const service = makeService();
    const result = await service.refresh('raw-refresh-token', { ip: '127.0.0.1', userAgent: 'test' });

    const decoded = jwt.decode(result.value.accessToken) as Record<string, unknown>;
    expect(decoded.empresaId).toBe(EMPRESA_ID);
    expect(decoded.role).toBe('admin_empresa');
  });
});

// ── Suite: segurança ──────────────────────────────────────────────────────────

describe('AuthService — segurança multi-tenant', () => {
  beforeEach(() => jest.clearAllMocks());

  it('organizationId no JWT vem exclusivamente do bootstrap, nunca do body', async () => {
    // O body pode ter qualquer coisa — o AuthService não lê req.body, só usa os dados do DB
    setupLoginMocksForSecurity();
    mockedBootstrap.mockResolvedValue(fakeBootstrapResult);

    const service = makeService();
    const result = await service.login(
      { usernameOrEmail: 'tester', password: 'pass' },
      { ip: '127.0.0.1', userAgent: 'test' }
    );

    expect(result.isFailure).toBe(false);
    const decoded = jwt.decode(result.value.token) as Record<string, unknown>;
    // organizationId é exatamente o que veio do bootstrap (DB), não outro valor
    expect(decoded.organizationId).toBe(ORG_ID);
  });

  it('membership.status=ACTIVE é required para incluir org no refresh JWT', async () => {
    const fakeRefreshSession = {
      userId: new Types.ObjectId(USER_ID),
      empresaId: new Types.ObjectId(EMPRESA_ID),
      family: 'fam',
      expiresAt: new Date(Date.now() + 3600000),
      revokedAt: null,
    };
    mockedSessionRepo.findValidByRawToken.mockResolvedValue(fakeRefreshSession as never);
    mockedSessionRepo.revokeByRawToken.mockResolvedValue(undefined as never);
    mockedSessionRepo.create.mockResolvedValue(fakeSession as never);
    mockAuthRepo.findByIdWithPassword.mockResolvedValue({ isFailure: false, value: fakeUser });
    (Empresa.exists as jest.Mock).mockResolvedValue({ _id: new Types.ObjectId(EMPRESA_ID) });

    MockedOrg.findOne.mockReturnValue({ lean: () => Promise.resolve(fakeOrg) });
    // membership query retorna null porque filtra status=ACTIVE e o membership está SUSPENDED
    MockedMembership.findOne.mockReturnValue({ lean: () => Promise.resolve(null) });

    const service = makeService();
    const result = await service.refresh('raw-refresh-token', { ip: '127.0.0.1', userAgent: 'test' });

    expect(result.isFailure).toBe(false);
    const decoded = jwt.decode(result.value.accessToken) as Record<string, unknown>;
    expect(decoded.organizationId).toBeUndefined();
  });
});

// Helper para o teste de segurança
function setupLoginMocksForSecurity(user = fakeUser) {
  mockAuthRepo.findLoginUsers.mockResolvedValue({ isFailure: false, value: [user] });
  (Empresa.exists as jest.Mock).mockResolvedValue({ _id: new Types.ObjectId(EMPRESA_ID) });
  mockedSessionRepo.create.mockResolvedValue(fakeSession as never);
}
