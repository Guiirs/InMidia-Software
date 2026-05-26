/**
 * useClients — React Query hooks for Client V4.1
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import clientService from '../services/clientService';

const CLIENTS_KEY = ['clients', 'v4'];

// ── Query hooks ────────────────────────────────────────────────────────────────

export function useClients(filters = {}) {
  return useQuery({
    queryKey: [...CLIENTS_KEY, 'list', filters],
    queryFn:  () => clientService.list(filters),
    select:   (res) => res,
    staleTime: 60_000,
  });
}

export function useClient(id) {
  return useQuery({
    queryKey: [...CLIENTS_KEY, 'detail', id],
    queryFn:  () => clientService.getById(id),
    select:   (res) => res.data,
    enabled:  !!id,
  });
}

export function useClientSearch(q, limit = 10) {
  return useQuery({
    queryKey: [...CLIENTS_KEY, 'search', q],
    queryFn:  () => clientService.search(q, limit),
    select:   (res) => res.data ?? [],
    enabled:  q?.length >= 2,
    staleTime: 30_000,
  });
}

export function useClientTimeline(id) {
  return useQuery({
    queryKey: [...CLIENTS_KEY, 'timeline', id],
    queryFn:  () => clientService.timeline(id),
    select:   (res) => res.data ?? [],
    enabled:  !!id,
  });
}

// ── Mutation hooks ─────────────────────────────────────────────────────────────

export function useCreateClient(options = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => clientService.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CLIENTS_KEY });
      options.onSuccess?.();
    },
    onError: options.onError,
  });
}

export function useUpdateClient(options = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => clientService.update(id, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: CLIENTS_KEY });
      qc.invalidateQueries({ queryKey: [...CLIENTS_KEY, 'detail', vars.id] });
      options.onSuccess?.();
    },
    onError: options.onError,
  });
}

export function useArchiveClient(options = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => clientService.archive(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CLIENTS_KEY });
      options.onSuccess?.();
    },
    onError: options.onError,
  });
}

export function useRestoreClient(options = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => clientService.restore(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CLIENTS_KEY });
      options.onSuccess?.();
    },
    onError: options.onError,
  });
}
