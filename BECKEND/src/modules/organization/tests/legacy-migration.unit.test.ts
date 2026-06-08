/**
 * Testes unitários — ensureOrganizationForLegacyEmpresa + mapeamento de roles
 */

// ── Mocks ──────────────────────────────────────────────────────────────────────

jest.mock('@modules/organization/organization.schema', () => ({
  Organization: { findOne: jest.fn() },
}));

jest.mock('@modules/organization/membership/tenant-membership.schema', () => ({
  TenantMembership: { findOne: jest.fn() },
}));

jest.mock('@modules/organization/organization.repository', () => ({
  organizationRepository: { create: jest.fn() },
}));

jest.mock('@modules/organization/membership/membership.repository', () => ({
  membershipRepository: { create: jest.fn() },
}));

jest.mock('@modules/empresas/Empresa', () => ({
  __esModule: true,
  default: { findById: jest.fn() },
}));

// ── Imports ────────────────────────────────────────────────────────────────────

import {
  ensureOrganizationForLegacyEmpresa,
  LEGACY_ROLE_TO_MEMBER_ROLE,
} from '../services/legacy-migration.service';
import { Organization } from '@modules/organization/organization.schema';
import { TenantMembership } from '@modules/organization/membership/tenant-membership.schema';
import { organizationRepository } from '../organization.repository';
import { membershipRepository } from '../membership/membership.repository';
import Empresa from '@modules/empresas/Empresa';
import { Types } from 'mongoose';

const MockedOrg         = Organization as unknown as { findOne: jest.Mock };
const MockedMembership  = TenantMembership as unknown as { findOne: jest.Mock };
const mockedOrgRepo     = organizationRepository as jest.Mocked<typeof organizationRepository>;
const mockedMemberRepo  = membershipRepository as jest.Mocked<typeof membershipRepository>;

// ── Fixtures ──────────────────────────────────────────────────────────────────

const EMPRESA_ID = '507f1f77bcf86cd799439011';
const USER_ID    = '507f1f77bcf86cd799439012';
const ORG_ID     = '507f1f77bcf86cd799439013';
const MB_ID      = '507f1f77bcf86cd799439014';

const fakeOrg = {
  _id: new Types.ObjectId(ORG_ID),
  name: 'Inmidia Ltda',
  slug: 'inmidia-ltda-439011',
  legacyEmpresaId: new Types.ObjectId(EMPRESA_ID),
  status: 'ACTIVE',
};

const fakeMembership = {
  _id: new Types.ObjectId(MB_ID),
  organizationId: new Types.ObjectId(ORG_ID),
  userId: new Types.ObjectId(USER_ID),
  role: 'ADMIN',
  status: 'ACTIVE',
};

// ── Suite: ensureOrganizationForLegacyEmpresa ─────────────────────────────────

describe('ensureOrganizationForLegacyEmpresa', () => {
  beforeEach(() => jest.clearAllMocks());

  it('cria Organization quando não existe e membership para o usuário', async () => {
    MockedOrg.findOne.mockReturnValue({ lean: () => Promise.resolve(null) });
    (Empresa.findById as jest.Mock).mockReturnValue({ lean: () => Promise.resolve({ nome: 'Inmidia Ltda' }) });
    mockedOrgRepo.create.mockResolvedValue(fakeOrg as never);
    MockedMembership.findOne.mockReturnValue({ lean: () => Promise.resolve(null) });
    mockedMemberRepo.create.mockResolvedValue(fakeMembership as never);

    const result = await ensureOrganizationForLegacyEmpresa({
      empresaId: EMPRESA_ID,
      userId: USER_ID,
      userRole: 'admin_empresa',
    });

    expect(result.organizationCreated).toBe(true);
    expect(result.membershipCreated).toBe(true);
    expect(mockedOrgRepo.create).toHaveBeenCalledTimes(1);
    expect(mockedMemberRepo.create).toHaveBeenCalledWith(ORG_ID, USER_ID, 'ADMIN');
  });

  it('reutiliza Organization existente sem duplicar', async () => {
    MockedOrg.findOne.mockReturnValue({ lean: () => Promise.resolve(fakeOrg) });
    MockedMembership.findOne.mockReturnValue({ lean: () => Promise.resolve(null) });
    mockedMemberRepo.create.mockResolvedValue(fakeMembership as never);

    const result = await ensureOrganizationForLegacyEmpresa({
      empresaId: EMPRESA_ID,
      userId: USER_ID,
      userRole: 'gestor',
    });

    expect(result.organizationCreated).toBe(false);
    expect(mockedOrgRepo.create).not.toHaveBeenCalled();
  });

  it('não duplica membership quando já existe', async () => {
    MockedOrg.findOne.mockReturnValue({ lean: () => Promise.resolve(fakeOrg) });
    MockedMembership.findOne.mockReturnValue({ lean: () => Promise.resolve(fakeMembership) });

    const result = await ensureOrganizationForLegacyEmpresa({
      empresaId: EMPRESA_ID,
      userId: USER_ID,
      userRole: 'admin_empresa',
    });

    expect(result.membershipCreated).toBe(false);
    expect(mockedMemberRepo.create).not.toHaveBeenCalled();
  });

  it('lança 404 quando Empresa não existe durante criação de org', async () => {
    MockedOrg.findOne.mockReturnValue({ lean: () => Promise.resolve(null) });
    (Empresa.findById as jest.Mock).mockReturnValue({ lean: () => Promise.resolve(null) });

    await expect(
      ensureOrganizationForLegacyEmpresa({ empresaId: EMPRESA_ID, userId: USER_ID, userRole: 'admin_empresa' })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('lança 400 para empresaId inválido', async () => {
    await expect(
      ensureOrganizationForLegacyEmpresa({ empresaId: 'invalido', userId: USER_ID, userRole: 'admin_empresa' })
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

// ── Suite: mapeamento de roles legadas ────────────────────────────────────────

describe('LEGACY_ROLE_TO_MEMBER_ROLE — mapeamento', () => {
  it.each([
    ['superadmin',    'OWNER'],
    ['admin_empresa', 'ADMIN'],
    ['admin',         'ADMIN'],
    ['gestor',        'MANAGER'],
    ['manager',       'MANAGER'],
    ['vendedor',      'OPERATOR'],
    ['user',          'OPERATOR'],
    ['financeiro',    'FINANCIAL'],
    ['visualizador',  'VIEWER'],
    ['viewer',        'VIEWER'],
  ])('%s → %s', (legacy, expected) => {
    expect(LEGACY_ROLE_TO_MEMBER_ROLE[legacy]).toBe(expected);
  });

  it('role desconhecido usa VIEWER como fallback via runtime logic', async () => {
    MockedOrg.findOne.mockReturnValue({ lean: () => Promise.resolve(fakeOrg) });
    MockedMembership.findOne.mockReturnValue({ lean: () => Promise.resolve(null) });
    mockedMemberRepo.create.mockResolvedValue({ ...fakeMembership, role: 'VIEWER' } as never);

    await ensureOrganizationForLegacyEmpresa({
      empresaId: EMPRESA_ID,
      userId: USER_ID,
      userRole: 'role-inexistente',
    });

    expect(mockedMemberRepo.create).toHaveBeenCalledWith(ORG_ID, USER_ID, 'VIEWER');
  });
});
