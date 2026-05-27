/**
 * Client Service V4.1
 * Connects to /api/v4/clients
 */

import { requestV4 } from './v4ServiceUtils.js';

const BASE = '/clients';

export const clientService = {
  /** List clients with optional filters */
  list: async (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
    ).toString();
    return requestV4('get', `${BASE}${qs ? `?${qs}` : ''}`, {
      operation: 'clients.list.read',
    });
  },

  /** Get single client by id */
  getById: async (id) => {
    return requestV4('get', `${BASE}/${id}`, {
      operation: 'clients.single.read',
    });
  },

  /** Search clients (autocomplete) */
  search: async (q, limit = 10) => {
    return requestV4('get', `${BASE}/search`, {
      operation: 'clients.search.read',
      params: { q, limit },
    });
  },

  /** Create client */
  create: async (data) => {
    return requestV4('post', BASE, {
      operation: 'clients.create',
      data,
    });
  },

  /** Update client (partial) */
  update: async (id, data) => {
    return requestV4('patch', `${BASE}/${id}`, {
      operation: 'clients.update',
      data,
    });
  },

  /** Archive client */
  archive: async (id) => {
    return requestV4('post', `${BASE}/${id}/archive`, {
      operation: 'clients.archive',
    });
  },

  /** Restore archived client */
  restore: async (id) => {
    return requestV4('post', `${BASE}/${id}/restore`, {
      operation: 'clients.restore',
    });
  },

  /** Get client timeline */
  timeline: async (id) => {
    return requestV4('get', `${BASE}/${id}/timeline`, {
      operation: 'clients.timeline.read',
    });
  },
};

export default clientService;
