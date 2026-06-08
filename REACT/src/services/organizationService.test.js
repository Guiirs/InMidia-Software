import { describe, expect, it, beforeEach, vi } from 'vitest';
import apiClient from './apiClient';
import organizationService from './organizationService';

vi.mock('./apiClient', () => ({
  default: {
    get:   vi.fn(),
    post:  vi.fn(),
    patch: vi.fn(),
  },
}));

const mockData = (data) => ({ data: { data } });
const mockDirect = (data) => ({ data });

describe('organizationService', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('getCurrentOrganization chama GET /organization/current', async () => {
    apiClient.get.mockResolvedValueOnce(mockData({ name: 'Org X', plan: 'PRO' }));
    const result = await organizationService.getCurrentOrganization();
    expect(apiClient.get).toHaveBeenCalledWith('/organization/current');
    expect(result).toEqual({ name: 'Org X', plan: 'PRO' });
  });

  it('listMembers chama GET /organization/members', async () => {
    apiClient.get.mockResolvedValueOnce(mockData([{ _id: 'm1', role: 'OWNER' }]));
    const result = await organizationService.listMembers();
    expect(apiClient.get).toHaveBeenCalledWith('/organization/members');
    expect(result).toEqual([{ _id: 'm1', role: 'OWNER' }]);
  });

  it('listInvitations chama GET /organization/invitations', async () => {
    apiClient.get.mockResolvedValueOnce(mockData([{ _id: 'i1', email: 'a@b.com' }]));
    const result = await organizationService.listInvitations();
    expect(apiClient.get).toHaveBeenCalledWith('/organization/invitations');
    expect(result).toEqual([{ _id: 'i1', email: 'a@b.com' }]);
  });

  it('createInvitation chama POST /organization/invitations com email e role', async () => {
    apiClient.post.mockResolvedValueOnce(mockData({ _id: 'i2', token: 'tok-abc' }));
    const result = await organizationService.createInvitation({ email: 'x@y.com', role: 'VIEWER' });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/organization/invitations',
      { email: 'x@y.com', role: 'VIEWER' }
    );
    expect(result).toEqual({ _id: 'i2', token: 'tok-abc' });
  });

  it('updateMemberRole chama PATCH /organization/members/:id/role', async () => {
    apiClient.patch.mockResolvedValueOnce(mockDirect({ success: true }));
    await organizationService.updateMemberRole('m1', 'ADMIN');
    expect(apiClient.patch).toHaveBeenCalledWith(
      '/organization/members/m1/role',
      { role: 'ADMIN' }
    );
  });

  it('updateMemberStatus chama PATCH /organization/members/:id/status', async () => {
    apiClient.patch.mockResolvedValueOnce(mockDirect({ success: true }));
    await organizationService.updateMemberStatus('m1', 'SUSPENDED');
    expect(apiClient.patch).toHaveBeenCalledWith(
      '/organization/members/m1/status',
      { status: 'SUSPENDED' }
    );
  });

  it('retorna data direto quando envelope data ausente', async () => {
    apiClient.get.mockResolvedValueOnce({ data: { name: 'Flat' } });
    const result = await organizationService.getCurrentOrganization();
    expect(result).toEqual({ name: 'Flat' });
  });
});
