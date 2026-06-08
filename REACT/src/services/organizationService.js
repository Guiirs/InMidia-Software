// src/services/organizationService.js
// V1 organization management — uses apiClient directly (same as authService pattern)

import apiClient from './apiClient';

const BASE = '/organization';

export const organizationService = {
  getCurrentOrganization: async () => {
    const res = await apiClient.get(`${BASE}/current`);
    return res.data?.data ?? res.data;
  },

  listMembers: async () => {
    const res = await apiClient.get(`${BASE}/members`);
    return res.data?.data ?? res.data;
  },

  listInvitations: async () => {
    const res = await apiClient.get(`${BASE}/invitations`);
    return res.data?.data ?? res.data;
  },

  createInvitation: async ({ email, role }) => {
    const res = await apiClient.post(`${BASE}/invitations`, { email, role });
    return res.data?.data ?? res.data;
  },

  acceptInvitation: async (token) => {
    const res = await apiClient.post(`${BASE}/invitations/accept`, { token });
    return res.data?.data ?? res.data;
  },

  updateMemberRole: async (memberId, role) => {
    const res = await apiClient.patch(`${BASE}/members/${memberId}/role`, { role });
    return res.data?.data ?? res.data;
  },

  updateMemberStatus: async (memberId, status) => {
    const res = await apiClient.patch(`${BASE}/members/${memberId}/status`, { status });
    return res.data?.data ?? res.data;
  },
};

export default organizationService;
