/**
 * Testes unitários — Organization Domain (multi-tenant foundation)
 */

import { OrganizationService } from '../organization.service';
import { MembershipService } from '../membership/membership.service';
import { InvitationService } from '../invitation/invitation.service';

// ── Mocks ──────────────────────────────────────────────────────────────────────

jest.mock('../organization.repository', () => ({
  organizationRepository: {
    create: jest.fn(),
    findById: jest.fn(),
    findByLegacyEmpresaId: jest.fn(),
    findBySlug: jest.fn(),
    updateStatus: jest.fn(),
  },
}));

jest.mock('../membership/membership.repository', () => ({
  membershipRepository: {
    create: jest.fn(),
    findByOrganization: jest.fn(),
    findByOrgAndUser: jest.fn(),
    findById: jest.fn(),
    updateRole: jest.fn(),
    updateStatus: jest.fn(),
    countActiveOwners: jest.fn(),
    upsertFromInvitation: jest.fn(),
  },
}));

jest.mock('../invitation/invitation.schema', () => {
  const mockSave = jest.fn().mockResolvedValue(undefined);
  const mockToObject = jest.fn().mockReturnValue({
    _id: 'inv-1',
    organizationId: 'org-1',
    email: 'novo@exemplo.com',
    role: 'VIEWER',
    status: 'PENDING',
    invitedByUserId: 'user-owner',
    expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
    tokenHash: 'somehash',
  });
  const MockInvitationConstructor = jest.fn().mockImplementation(() => ({
    save: mockSave,
    toObject: mockToObject,
    _id: 'inv-1',
  }));
  (MockInvitationConstructor as jest.MockedClass<typeof MockInvitationConstructor> & { findOne?: jest.Mock; find?: jest.Mock; findByIdAndUpdate?: jest.Mock }).findOne = jest.fn();
  (MockInvitationConstructor as jest.MockedClass<typeof MockInvitationConstructor> & { find?: jest.Mock }).find = jest.fn();
  (MockInvitationConstructor as jest.MockedClass<typeof MockInvitationConstructor> & { findByIdAndUpdate?: jest.Mock }).findByIdAndUpdate = jest.fn();
  return { Invitation: MockInvitationConstructor };
});

jest.mock('@modules/users/User', () => ({
  __esModule: true,
  default: { findById: jest.fn() },
}));

// ── Imports após mocks ─────────────────────────────────────────────────────────

import { organizationRepository } from '../organization.repository';
import { membershipRepository } from '../membership/membership.repository';
import { Invitation } from '../invitation/invitation.schema';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockedUserModule = jest.requireMock('@modules/users/User') as { default: { findById: jest.Mock } };

const mockedOrgRepo = organizationRepository as jest.Mocked<typeof organizationRepository>;
const mockedMemberRepo = membershipRepository as jest.Mocked<typeof membershipRepository>;
const MockedInvitation = Invitation as unknown as jest.MockedClass<typeof Invitation> & {
  findOne: jest.Mock;
  find: jest.Mock;
  findByIdAndUpdate: jest.Mock;
};

const ORG_ID = '507f1f77bcf86cd799439011';
const OWNER_ID = '507f1f77bcf86cd799439012';
const ADMIN_ID = '507f1f77bcf86cd799439013';
const MEMBER_ID = '507f1f77bcf86cd799439014';
const MEMBER_DOC_ID = '507f1f77bcf86cd799439015';

const fakeOrg = {
  _id: { toString: () => ORG_ID },
  name: 'Inmidia OOH',
  slug: 'inmidia-ooh',
  status: 'ACTIVE' as const,
  plan: 'FREE' as const,
  ownerUserId: { toString: () => OWNER_ID },
  legacyEmpresaId: { toString: () => 'empresa-1' },
  settings: {},
  limits: {},
  onboardingStatus: 'PENDING' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const ownerMembership = {
  _id: MEMBER_DOC_ID,
  organizationId: { toString: () => ORG_ID },
  userId: { toString: () => OWNER_ID },
  role: 'OWNER' as const,
  status: 'ACTIVE' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const adminMembership = {
  ...ownerMembership,
  userId: { toString: () => ADMIN_ID },
  role: 'ADMIN' as const,
};

const viewerMembership = {
  ...ownerMembership,
  _id: 'memberdoc-2',
  userId: { toString: () => MEMBER_ID },
  role: 'VIEWER' as const,
};

// ── Suite ──────────────────────────────────────────────────────────────────────

describe('OrganizationService', () => {
  const orgService = new OrganizationService();

  beforeEach(() => jest.clearAllMocks());

  it('cria organization e membership OWNER com sucesso', async () => {
    mockedOrgRepo.create.mockResolvedValue(fakeOrg as never);
    mockedMemberRepo.create.mockResolvedValue(ownerMembership as never);

    const result = await orgService.createOrganization(
      { name: 'Inmidia OOH', slug: 'inmidia-ooh', plan: 'FREE' },
      OWNER_ID
    );

    expect(mockedOrgRepo.create).toHaveBeenCalledTimes(1);
    expect(mockedMemberRepo.create).toHaveBeenCalledWith(ORG_ID, OWNER_ID, 'OWNER');
    expect(result.name).toBe('Inmidia OOH');
  });

  it('retorna org atual pelo legacyEmpresaId', async () => {
    mockedOrgRepo.findByLegacyEmpresaId.mockResolvedValue(fakeOrg as never);
    const org = await orgService.getCurrentOrganization('empresa-1');
    expect(org.slug).toBe('inmidia-ooh');
  });

  it('lança 404 quando org não existe para o empresaId', async () => {
    mockedOrgRepo.findByLegacyEmpresaId.mockResolvedValue(null);
    await expect(orgService.getCurrentOrganization('empresa-inexistente')).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe('MembershipService — listagem restrita ao tenant', () => {
  const svc = new MembershipService();

  beforeEach(() => jest.clearAllMocks());

  it('lista apenas membros do tenant atual', async () => {
    mockedMemberRepo.findByOrganization.mockResolvedValue([ownerMembership, viewerMembership] as never);
    const members = await svc.listMembers(ORG_ID);
    expect(mockedMemberRepo.findByOrganization).toHaveBeenCalledWith(ORG_ID);
    expect(members).toHaveLength(2);
  });
});

describe('MembershipService — updateMemberRole', () => {
  const svc = new MembershipService();

  beforeEach(() => jest.clearAllMocks());

  it('OWNER altera role de VIEWER para MANAGER', async () => {
    mockedMemberRepo.findByOrgAndUser.mockResolvedValue(ownerMembership as never);
    mockedMemberRepo.findById.mockResolvedValue({ ...viewerMembership, organizationId: { toString: () => ORG_ID } } as never);
    mockedMemberRepo.updateRole.mockResolvedValue({ ...viewerMembership, role: 'MANAGER' } as never);

    const result = await svc.updateMemberRole(MEMBER_DOC_ID, ORG_ID, 'MANAGER', OWNER_ID);
    expect(result.role).toBe('MANAGER');
  });

  it('impede alteração de role ADMIN sem ser OWNER', async () => {
    mockedMemberRepo.findByOrgAndUser.mockResolvedValue(adminMembership as never);
    mockedMemberRepo.findById.mockResolvedValue({ ...viewerMembership, role: 'ADMIN', organizationId: { toString: () => ORG_ID } } as never);

    await expect(svc.updateMemberRole(MEMBER_DOC_ID, ORG_ID, 'OWNER', ADMIN_ID)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('impede acesso cruzado entre tenants (membro de outro org)', async () => {
    mockedMemberRepo.findByOrgAndUser.mockResolvedValue(ownerMembership as never);
    mockedMemberRepo.findById.mockResolvedValue({
      ...viewerMembership,
      organizationId: { toString: () => 'outro-org' },
    } as never);

    await expect(svc.updateMemberRole(MEMBER_DOC_ID, ORG_ID, 'MANAGER', OWNER_ID)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('impede alteração sem permissão (VIEWER tenta alterar role)', async () => {
    mockedMemberRepo.findByOrgAndUser.mockResolvedValue(viewerMembership as never);
    mockedMemberRepo.findById.mockResolvedValue({ ...ownerMembership, organizationId: { toString: () => ORG_ID } } as never);

    await expect(svc.updateMemberRole(MEMBER_DOC_ID, ORG_ID, 'MANAGER', MEMBER_ID)).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});

describe('MembershipService — updateMemberStatus (remoção último OWNER)', () => {
  const svc = new MembershipService();

  beforeEach(() => jest.clearAllMocks());

  it('impede remoção do último OWNER ativo', async () => {
    mockedMemberRepo.findByOrgAndUser.mockResolvedValue(ownerMembership as never);
    mockedMemberRepo.findById.mockResolvedValue({
      ...ownerMembership,
      organizationId: { toString: () => ORG_ID },
    } as never);
    mockedMemberRepo.countActiveOwners.mockResolvedValue(1);

    await expect(
      svc.updateMemberStatus(MEMBER_DOC_ID, ORG_ID, 'REMOVED', OWNER_ID)
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('permite remoção de OWNER quando há mais de um', async () => {
    mockedMemberRepo.findByOrgAndUser.mockResolvedValue(ownerMembership as never);
    mockedMemberRepo.findById.mockResolvedValue({
      ...ownerMembership,
      organizationId: { toString: () => ORG_ID },
    } as never);
    mockedMemberRepo.countActiveOwners.mockResolvedValue(2);
    mockedMemberRepo.updateStatus.mockResolvedValue({ ...ownerMembership, status: 'REMOVED' } as never);

    const result = await svc.updateMemberStatus(MEMBER_DOC_ID, ORG_ID, 'REMOVED', OWNER_ID);
    expect(result.status).toBe('REMOVED');
  });
});

describe('InvitationService — criar convite', () => {
  const svc = new InvitationService();

  beforeEach(() => jest.clearAllMocks());

  it('cria convite com sucesso para OWNER', async () => {
    mockedMemberRepo.findByOrgAndUser.mockResolvedValue(ownerMembership as never);
    mockedOrgRepo.findById.mockResolvedValue(fakeOrg as never);
    MockedInvitation.findOne.mockResolvedValue(null);

    const result = await svc.createInvitation(
      ORG_ID,
      { email: 'novo@exemplo.com', role: 'VIEWER' },
      OWNER_ID
    );

    expect(result.token).toBeDefined();
    expect(result.token.length).toBeGreaterThan(0);
    expect(result.invitation).not.toHaveProperty('tokenHash');
  });

  it('impede convite duplicado pendente para mesmo email no mesmo tenant', async () => {
    mockedMemberRepo.findByOrgAndUser.mockResolvedValue(ownerMembership as never);
    mockedOrgRepo.findById.mockResolvedValue(fakeOrg as never);
    MockedInvitation.findOne.mockResolvedValue({ _id: 'existing-invite', status: 'PENDING' });

    await expect(
      svc.createInvitation(ORG_ID, { email: 'novo@exemplo.com', role: 'VIEWER' }, OWNER_ID)
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('impede convite por VIEWER (sem permissão)', async () => {
    mockedMemberRepo.findByOrgAndUser.mockResolvedValue(viewerMembership as never);

    await expect(
      svc.createInvitation(ORG_ID, { email: 'outro@exemplo.com', role: 'MANAGER' }, MEMBER_ID)
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('InvitationService — aceitar convite', () => {
  const svc = new InvitationService();
  const ACCEPTING_USER_ID = 'user-new';

  beforeEach(() => jest.clearAllMocks());

  it('aceita convite válido e cria membership', async () => {
    const fakeInvitation = {
      _id: 'inv-1',
      organizationId: { toString: () => ORG_ID },
      email: 'novo@empresa.com',
      role: 'VIEWER' as const,
      status: 'PENDING' as const,
      invitedByUserId: { toString: () => OWNER_ID },
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    };

    MockedInvitation.findOne.mockResolvedValue(fakeInvitation);
    mockedUserModule.default.findById.mockReturnValue({ lean: () => Promise.resolve({ email: 'novo@empresa.com' }) });
    mockedMemberRepo.upsertFromInvitation.mockResolvedValue(viewerMembership as never);
    MockedInvitation.findByIdAndUpdate.mockResolvedValue(null);

    await expect(svc.acceptInvitation('valid-token', ACCEPTING_USER_ID)).resolves.toBeUndefined();
    expect(mockedMemberRepo.upsertFromInvitation).toHaveBeenCalledWith(ORG_ID, ACCEPTING_USER_ID, 'VIEWER', OWNER_ID);
  });

  it('rejeita convite com token inválido', async () => {
    MockedInvitation.findOne.mockResolvedValue(null);
    await expect(svc.acceptInvitation('token-invalido', ACCEPTING_USER_ID)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('rejeita convite expirado', async () => {
    const expired = {
      _id: 'inv-2',
      organizationId: { toString: () => ORG_ID },
      email: 'novo@empresa.com',
      role: 'VIEWER' as const,
      status: 'PENDING' as const,
      invitedByUserId: { toString: () => OWNER_ID },
      expiresAt: new Date(Date.now() - 1000),
    };
    MockedInvitation.findOne.mockResolvedValue(expired);
    MockedInvitation.findByIdAndUpdate.mockResolvedValue(null);

    await expect(svc.acceptInvitation('expired-token', ACCEPTING_USER_ID)).rejects.toMatchObject({
      statusCode: 410,
    });
  });
});
