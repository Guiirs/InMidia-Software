import { beforeEach, describe, expect, it, vi } from 'vitest';

import apiClient from './apiClient.js';
import clientService from './clientService.js';
import {
  getOperationsByDomain,
  getOperationsSummary,
  getOperationsTimeline,
  listOperationTasks,
  listPendingOperationTasks,
} from './operationsV4Service.js';
import { getRealtimeStreamToken } from './realtimeV4Service.js';
import { getSystemReadiness } from './systemReadinessService.js';
import { requestFirstAvailable, requestV4, v1Base, v4Base } from './v4ServiceUtils.js';

vi.mock('./apiClient.js', () => ({
  default: {
    request: vi.fn(),
  },
}));

function mockData(data) {
  apiClient.request.mockResolvedValueOnce({ data: { success: true, data } });
}

function lastRequest() {
  return apiClient.request.mock.calls.at(-1)?.[0];
}

function requestPath(request) {
  return `${request?.baseURL || ''}${request?.url || ''}`;
}

const BROKEN_V4_PATH = '/api/v1' + '/api/v4';
const BROKEN_V1_PATH = '/api/v1' + '/api/v1';

describe('api routing regression', () => {
  beforeEach(() => {
    apiClient.request.mockReset();
  });

  it('usa base /api com path /v4 no helper requestV4', async () => {
    mockData({ ok: true });

    await requestV4('get', '/system/readiness', { operation: 'system.readiness.read' });

    expect(lastRequest()).toEqual(expect.objectContaining({
      baseURL: '/api',
      method: 'get',
      url: '/v4/system/readiness',
    }));
    expect(requestPath(lastRequest())).toBe('/api/v4/system/readiness');
    expect(requestPath(lastRequest())).not.toContain(BROKEN_V4_PATH);
  });

  it('normaliza paths V4 e V1 passados por helpers legados sem duplicar prefixo', async () => {
    mockData({ ok: true });
    await requestFirstAvailable('get', [v4Base('/operations/timeline')], {
      operation: 'operations.timeline.read',
    });

    expect(lastRequest()).toEqual(expect.objectContaining({
      baseURL: '/api',
      method: 'get',
      url: '/v4/operations/timeline',
    }));

    mockData({ ok: true });
    await requestFirstAvailable('post', [v1Base('/placas/b1/images')], {
      operation: 'inventory.board.image.upload',
      data: new FormData(),
    });

    expect(lastRequest()).toEqual(expect.objectContaining({
      baseURL: '/api',
      method: 'post',
      url: '/v1/placas/b1/images',
    }));
    expect(requestPath(lastRequest())).not.toContain(BROKEN_V1_PATH);
  });

  it('roteia os endpoints criticos de operacoes para /api/v4/*', async () => {
    mockData([]);
    await getOperationsTimeline();

    mockData({ totals: {} });
    await getOperationsSummary();

    mockData([]);
    await listOperationTasks();

    mockData([]);
    await listPendingOperationTasks();

    mockData({ byDomain: {} });
    await getOperationsByDomain();

    const paths = apiClient.request.mock.calls.map(([request]) => requestPath(request));
    expect(paths).toEqual(expect.arrayContaining([
      '/api/v4/operations/timeline',
      '/api/v4/operations/summary',
      '/api/v4/operations/tasks',
      '/api/v4/operations/tasks/pending',
      '/api/v4/operations/by-domain',
    ]));
    expect(paths.every((path) => !path.includes(BROKEN_V4_PATH))).toBe(true);
  });

  it('mantem realtime, readiness e clients em /api/v4/*', async () => {
    mockData({ token: 'stream-token-123' });
    await getRealtimeStreamToken();
    expect(lastRequest()).toEqual(expect.objectContaining({
      baseURL: '/api',
      method: 'post',
      url: '/v4/realtime/stream-token',
    }));

    mockData({ status: 'ok' });
    await getSystemReadiness();
    expect(lastRequest()).toEqual(expect.objectContaining({
      baseURL: '/api',
      method: 'get',
      url: '/v4/system/readiness',
    }));

    mockData({ items: [] });
    await clientService.list({ status: 'active' });
    expect(lastRequest()).toEqual(expect.objectContaining({
      baseURL: '/api',
      method: 'get',
      url: '/v4/clients?status=active',
    }));
  });
});
