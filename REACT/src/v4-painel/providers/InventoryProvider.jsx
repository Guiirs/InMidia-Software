import { createContext, memo, useCallback, useContext, useMemo, useState } from 'react';
import { useSyncMutation } from '../../core/sync-core/hooks/useSyncMutation.js';
import { useSyncRefresh } from '../../core/sync-core/hooks/useSyncRefresh.js';
import { useSyncResource } from '../../core/sync-core/hooks/useSyncResource.js';
import { setInventoryBoardsQuery } from '../../core/sync-core/query/inventoryBoardQuery.js';
import { deriveInventorySummary } from '../integration/adapters/inventorySummaryAdapter.js';

const InventoryContext = createContext(null);

const EMPTY_SUMMARY_FALLBACK = {
  total: 0,
  ocupadas: 0,
  disponiveis: 0,
  manutencao: 0,
  reservadas: 0,
  criticas: 0,
  taxaOcupacao: 0,
  receitaTotal: 0,
};

function firstError(...resources) {
  const failed = resources.find((resource) => resource.error);
  return failed?.error?.message ?? null;
}

function statusFrom(...resources) {
  if (resources.some((resource) => resource.status === 'unauthorized')) return 'unauthorized';
  if (resources.some((resource) => resource.status === 'forbidden')) return 'forbidden';
  if (resources.some((resource) => resource.status === 'offline')) return 'offline';
  if (resources.some((resource) => resource.status === 'error')) return 'error';
  if (resources.some((resource) => resource.status === 'stale' || resource.isStale)) return 'stale';
  if (resources.some((resource) => resource.status === 'refreshing' || resource.isRefreshing)) return 'refreshing';
  if (resources.some((resource) => resource.status === 'loading' || resource.status === 'idle')) return 'loading';
  return 'success';
}

function sourceFrom(status, hasRealData) {
  if (status === 'stale' || status === 'refreshing') return 'stale';
  if (status === 'error' || status === 'unauthorized' || status === 'forbidden' || status === 'offline') return status;
  return hasRealData ? 'real' : 'empty';
}

function InventoryProvider({ children }) {
  const boardsResource = useSyncResource('inventory.boards');
  const summaryResource = useSyncResource('inventory.summary');
  const updateMutation = useSyncMutation('inventory.board.update');
  const toggleMutation = useSyncMutation('inventory.board.toggleAvailability');
  const createMutation = useSyncMutation('inventory.board.create');
  const deleteMutation = useSyncMutation('inventory.board.delete');
  const { invalidateResource } = useSyncRefresh();
  const [actionError, setActionError] = useState(null);
  const [boardPatches, setBoardPatches] = useState({});

  const boards = useMemo(() => {
    const sourceBoards = Array.isArray(boardsResource.data) ? boardsResource.data : [];
    return sourceBoards.map((board) => {
      const patch = boardPatches[board.id];
      return patch ? { ...board, ...patch } : board;
    });
  }, [boardPatches, boardsResource.data]);

  const summary = useMemo(() => (
    summaryResource.data ?? deriveInventorySummary(boards, EMPTY_SUMMARY_FALLBACK)
  ), [boards, summaryResource.data]);

  const clearActionError = useCallback(() => setActionError(null), []);

  const refreshSummary = useCallback(() => (
    summaryResource.refresh({ reason: 'inventory-summary-manual' })
  ), [summaryResource]);

  const load = useCallback(() => (
    Promise.all([
      boardsResource.refresh({ reason: 'inventory-manual' }),
      summaryResource.refresh({ reason: 'inventory-manual' }),
    ])
  ), [boardsResource, summaryResource]);

  const refreshBoards = boardsResource.refresh;

  const patchBoardLocally = useCallback((boardPatch) => {
    if (!boardPatch?.id) return;
    setBoardPatches((prev) => ({
      ...prev,
      [boardPatch.id]: {
        ...(prev[boardPatch.id] ?? {}),
        ...boardPatch,
      },
    }));
  }, []);

  const setBoardQuery = useCallback((query) => {
    setInventoryBoardsQuery(query);
    return refreshBoards({ reason: 'inventory-query-change' });
  }, [refreshBoards]);

  const updateBoard = useCallback(async (updated) => {
    setActionError(null);

    try {
      const saved = await updateMutation.mutateAsync(updated);
      patchBoardLocally(saved);
      invalidateResource('inventory.boards', { reason: 'inventory-provider:update' });
      invalidateResource('inventory.summary', { reason: 'inventory-provider:update' });
      return saved;
    } catch (err) {
      setActionError(err.message ?? 'Nao foi possivel salvar no servidor.');
      throw err;
    }
  }, [invalidateResource, patchBoardLocally, updateMutation]);

  const toggleAvailability = useCallback(async (board) => {
    setActionError(null);

    try {
      const saved = await toggleMutation.mutateAsync({ id: board.id });
      invalidateResource('inventory.boards', { reason: 'inventory-provider:toggle' });
      invalidateResource('inventory.summary', { reason: 'inventory-provider:toggle' });
      return saved;
    } catch (err) {
      setActionError(err.message ?? 'Nao foi possivel alterar disponibilidade no servidor.');
      throw err;
    }
  }, [invalidateResource, toggleMutation]);

  const createBoard = useCallback(async (boardData) => {
    setActionError(null);

    try {
      const created = await createMutation.mutateAsync(boardData);
      invalidateResource('inventory.boards', { reason: 'inventory-provider:create' });
      invalidateResource('inventory.summary', { reason: 'inventory-provider:create' });
      invalidateResource('inventory.regions', { reason: 'inventory-provider:create' });
      return created;
    } catch (err) {
      setActionError(err.message ?? 'Nao foi possivel criar a placa no servidor.');
      throw err;
    }
  }, [createMutation, invalidateResource]);

  const deleteBoard = useCallback(async (board) => {
    setActionError(null);

    try {
      const result = await deleteMutation.mutateAsync({ id: board.id });
      invalidateResource('inventory.boards', { reason: 'inventory-provider:delete' });
      invalidateResource('inventory.summary', { reason: 'inventory-provider:delete' });
      invalidateResource('inventory.regions', { reason: 'inventory-provider:delete' });
      return result;
    } catch (err) {
      setActionError(err.message ?? 'Nao foi possivel excluir a placa no servidor.');
      throw err;
    }
  }, [deleteMutation, invalidateResource]);

  const status = statusFrom(boardsResource, summaryResource);
  const loading = status === 'loading';
  const refreshing = status === 'refreshing';
  const stale = status === 'stale';
  const summaryLoading = summaryResource.status === 'loading' || summaryResource.status === 'refreshing';
  const error = firstError(boardsResource);
  const summaryError = firstError(summaryResource);
  const hasRealData = Boolean(boardsResource.data || summaryResource.data);
  const source = sourceFrom(status, hasRealData);
  const actionLoading = updateMutation.isLoading || toggleMutation.isLoading
    || createMutation.isLoading || deleteMutation.isLoading;

  const value = useMemo(() => ({
    boards,
    summary,
    summaryLoading,
    summaryError,
    loading,
    refreshing,
    stale,
    status,
    error,
    source,
    refresh: load,
    refreshSummary,
    setBoardQuery,
    patchBoardLocally,
    updateBoard,
    createBoard,
    deleteBoard,
    toggleAvailability,
    actionLoading,
    actionError,
    clearActionError,
  }), [
    actionError,
    actionLoading,
    boards,
    clearActionError,
    createBoard,
    deleteBoard,
    error,
    load,
    loading,
    refreshSummary,
    patchBoardLocally,
    refreshing,
    setBoardQuery,
    source,
    stale,
    status,
    summary,
    summaryError,
    summaryLoading,
    toggleAvailability,
    updateBoard,
  ]);

  return (
    <InventoryContext.Provider value={value}>
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventory() {
  const ctx = useContext(InventoryContext);
  if (!ctx) throw new Error('[v4-painel] useInventory deve ser usado dentro de <InventoryProvider>');
  return ctx;
}

export default memo(InventoryProvider);
