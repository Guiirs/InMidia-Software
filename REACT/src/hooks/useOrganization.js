/**
 * useOrganization — React Query hooks for Organization V1
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import organizationService from '../services/organizationService';

const ORG_KEY       = ['organization', 'v1'];
const MEMBERS_KEY   = ['organization', 'v1', 'members'];
const INVITES_KEY   = ['organization', 'v1', 'invitations'];

// ── Query hooks ────────────────────────────────────────────────────────────────

export function useOrganization() {
  return useQuery({
    queryKey: [...ORG_KEY, 'current'],
    queryFn:  () => organizationService.getCurrentOrganization(),
    staleTime: 120_000,
  });
}

export function useOrganizationMembers() {
  return useQuery({
    queryKey: MEMBERS_KEY,
    queryFn:  () => organizationService.listMembers(),
    staleTime: 60_000,
  });
}

export function useOrganizationInvitations() {
  return useQuery({
    queryKey: INVITES_KEY,
    queryFn:  () => organizationService.listInvitations(),
    staleTime: 60_000,
  });
}

// ── Mutation hooks ─────────────────────────────────────────────────────────────

export function useCreateInvitation(options = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => organizationService.createInvitation(data),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: INVITES_KEY });
      options.onSuccess?.(result);
    },
    onError: options.onError,
  });
}

export function useUpdateMemberRole(options = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, role }) => organizationService.updateMemberRole(memberId, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MEMBERS_KEY });
      options.onSuccess?.();
    },
    onError: options.onError,
  });
}

export function useUpdateMemberStatus(options = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, status }) => organizationService.updateMemberStatus(memberId, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MEMBERS_KEY });
      options.onSuccess?.();
    },
    onError: options.onError,
  });
}
