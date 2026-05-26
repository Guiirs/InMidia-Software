import { useCallback, useReducer } from 'react';
import * as regionService from '../services/regionService.js';

const INITIAL_STATE = {
  regions: [],
  selectedRegion: null,
  summary: null,
  plates: [],
  operations: [],
  operationsSummary: null,
  alerts: [],
  alertsSummary: null,
  operationsLoading: false,
  alertsLoading: false,
  operationsError: null,
  alertsError: null,
  loading: false,
  error: null,
  actionLoading: false,
};

function reducer(state, action) {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, loading: true, error: null };
    case 'FETCH_SUCCESS':
      return { ...state, loading: false, regions: action.payload };
    case 'FETCH_ERROR':
      return { ...state, loading: false, error: action.payload };
    case 'SELECT_REGION':
      return {
        ...state,
        selectedRegion: action.payload,
        summary: null,
        plates: [],
        operations: [],
        operationsSummary: null,
        alerts: [],
        alertsSummary: null,
        operationsError: null,
        alertsError: null,
      };
    case 'SUMMARY_SUCCESS':
      return { ...state, summary: action.payload };
    case 'PLATES_SUCCESS':
      return { ...state, plates: action.payload };
    case 'OPERATIONS_START':
      return { ...state, operationsLoading: true, operationsError: null };
    case 'OPERATIONS_SUCCESS':
      return {
        ...state,
        operationsLoading: false,
        operations: action.payload.items,
        operationsSummary: action.payload.summary,
      };
    case 'OPERATIONS_ERROR':
      return { ...state, operationsLoading: false, operationsError: action.payload };
    case 'ALERTS_START':
      return { ...state, alertsLoading: true, alertsError: null };
    case 'ALERTS_SUCCESS':
      return {
        ...state,
        alertsLoading: false,
        alerts: action.payload.items,
        alertsSummary: action.payload.summary,
      };
    case 'ALERTS_ERROR':
      return { ...state, alertsLoading: false, alertsError: action.payload };
    case 'ACTION_START':
      return { ...state, actionLoading: true, error: null };
    case 'ACTION_SUCCESS': {
      const updated = action.payload;
      const regions = state.regions.map((r) => (r.id === updated?.id ? { ...r, ...updated } : r));
      return { ...state, actionLoading: false, regions };
    }
    case 'ACTION_CREATE': {
      const created = action.payload;
      return { ...state, actionLoading: false, regions: [...state.regions, created] };
    }
    case 'ACTION_ERROR':
      return { ...state, actionLoading: false, error: action.payload };
    default:
      return state;
  }
}

export function useRegions() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  const refresh = useCallback(async (filters = {}) => {
    dispatch({ type: 'FETCH_START' });
    try {
      const data = await regionService.listRegions(filters);
      const list = Array.isArray(data) ? data : (data?.regions ?? data?.items ?? []);
      dispatch({ type: 'FETCH_SUCCESS', payload: list });
    } catch (err) {
      dispatch({ type: 'FETCH_ERROR', payload: err.message ?? 'Erro ao carregar regioes.' });
    }
  }, []);

  const selectRegion = useCallback((region) => {
    dispatch({ type: 'SELECT_REGION', payload: region });
  }, []);

  const loadRegionDetails = useCallback(async (id) => {
    if (!id) return;
    try {
      const [summary, platesData] = await Promise.allSettled([
        regionService.getRegionSummary(id),
        regionService.getRegionPlates(id),
      ]);
      if (summary.status === 'fulfilled') {
        dispatch({ type: 'SUMMARY_SUCCESS', payload: summary.value });
      }
      if (platesData.status === 'fulfilled') {
        const list = Array.isArray(platesData.value)
          ? platesData.value
          : (platesData.value?.plates ?? platesData.value?.items ?? []);
        dispatch({ type: 'PLATES_SUCCESS', payload: list });
      }
    } catch {
      // Details are best-effort; main region list is not affected
    }

    dispatch({ type: 'OPERATIONS_START' });
    regionService.getRegionOperations(id)
      .then((data) => {
        dispatch({
          type: 'OPERATIONS_SUCCESS',
          payload: {
            items: Array.isArray(data?.items) ? data.items : [],
            summary: data?.summary ?? { total: 0, pending: 0, critical: 0, overdue: 0 },
          },
        });
      })
      .catch((err) => {
        dispatch({ type: 'OPERATIONS_ERROR', payload: err.message ?? 'Erro ao carregar operacoes regionais.' });
      });

    dispatch({ type: 'ALERTS_START' });
    regionService.getRegionAlerts(id)
      .then((data) => {
        dispatch({
          type: 'ALERTS_SUCCESS',
          payload: {
            items: Array.isArray(data?.items) ? data.items : [],
            summary: data?.summary ?? { total: 0, critical: 0, warning: 0, temporal: 0 },
          },
        });
      })
      .catch((err) => {
        dispatch({ type: 'ALERTS_ERROR', payload: err.message ?? 'Erro ao carregar alertas regionais.' });
      });
  }, []);

  const createRegion = useCallback(async (payload) => {
    dispatch({ type: 'ACTION_START' });
    try {
      const created = await regionService.createRegion(payload);
      dispatch({ type: 'ACTION_CREATE', payload: created });
      return created;
    } catch (err) {
      dispatch({ type: 'ACTION_ERROR', payload: err.message ?? 'Erro ao criar regiao.' });
      throw err;
    }
  }, []);

  const updateRegion = useCallback(async (id, payload) => {
    dispatch({ type: 'ACTION_START' });
    try {
      const updated = await regionService.updateRegion(id, payload);
      dispatch({ type: 'ACTION_SUCCESS', payload: updated });
      return updated;
    } catch (err) {
      dispatch({ type: 'ACTION_ERROR', payload: err.message ?? 'Erro ao atualizar regiao.' });
      throw err;
    }
  }, []);

  const archiveRegion = useCallback(async (id) => {
    dispatch({ type: 'ACTION_START' });
    try {
      const updated = await regionService.archiveRegion(id);
      dispatch({ type: 'ACTION_SUCCESS', payload: { id, status: 'archived', ...updated } });
      return updated;
    } catch (err) {
      dispatch({ type: 'ACTION_ERROR', payload: err.message ?? 'Erro ao arquivar regiao.' });
      throw err;
    }
  }, []);

  return {
    ...state,
    refresh,
    selectRegion,
    loadRegionDetails,
    createRegion,
    updateRegion,
    archiveRegion,
  };
}
