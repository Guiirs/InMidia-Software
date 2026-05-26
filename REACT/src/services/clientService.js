/**
 * Client Service V4.1
 * Connects to /api/v4/clients
 */

import apiClient from './apiClient';

const BASE = '/api/v4/clients';

export const clientService = {
  /** List clients with optional filters */
  list: async (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
    ).toString();
    const response = await apiClient.get(`${BASE}${qs ? `?${qs}` : ''}`);
    return response.data;
  },

  /** Get single client by id */
  getById: async (id) => {
    const response = await apiClient.get(`${BASE}/${id}`);
    return response.data;
  },

  /** Search clients (autocomplete) */
  search: async (q, limit = 10) => {
    const response = await apiClient.get(`${BASE}/search`, { params: { q, limit } });
    return response.data;
  },

  /** Create client */
  create: async (data) => {
    const response = await apiClient.post(BASE, data);
    return response.data;
  },

  /** Update client (partial) */
  update: async (id, data) => {
    const response = await apiClient.patch(`${BASE}/${id}`, data);
    return response.data;
  },

  /** Archive client */
  archive: async (id) => {
    const response = await apiClient.post(`${BASE}/${id}/archive`);
    return response.data;
  },

  /** Restore archived client */
  restore: async (id) => {
    const response = await apiClient.post(`${BASE}/${id}/restore`);
    return response.data;
  },

  /** Get client timeline */
  timeline: async (id) => {
    const response = await apiClient.get(`${BASE}/${id}/timeline`);
    return response.data;
  },
};

export default clientService;
