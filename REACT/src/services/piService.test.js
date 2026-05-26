import { beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from './apiClient.js';
import {
  fetchPIs,
  createPI,
  updatePI,
  deletePI,
  approvePI,
  rejectPI,
  cancelPI,
  generateContractFromPI,
  checkPIAvailability,
} from './piService.js';

vi.mock('./apiClient.js', () => ({
  default: {
    get:    vi.fn(),
    post:   vi.fn(),
    put:    vi.fn(),
    delete: vi.fn(),
  },
}));

function ok(data) {
  return Promise.resolve({ data });
}

describe('piService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── CRUD ─────────────────────────────────────────────────────────────────

  it('fetchPIs usa GET /pis com query string', async () => {
    apiClient.get.mockResolvedValueOnce({ data: { data: [], pagination: {} } });
    const params = new URLSearchParams({ page: '1', limit: '10' });
    await fetchPIs(params);
    expect(apiClient.get).toHaveBeenCalledWith('/pis?page=1&limit=10');
  });

  it('createPI usa POST /pis', async () => {
    apiClient.post.mockResolvedValueOnce({ data: { _id: 'pi-1', status: 'DRAFT' } });
    const result = await createPI({ descricao: 'Nova PI' });
    expect(apiClient.post).toHaveBeenCalledWith('/pis', { descricao: 'Nova PI' });
    expect(result.status).toBe('DRAFT');
  });

  it('updatePI usa PUT /pis/:id', async () => {
    apiClient.put.mockResolvedValueOnce({ data: { _id: 'pi-1', status: 'DRAFT' } });
    await updatePI('pi-1', { valorTotal: 2000 });
    expect(apiClient.put).toHaveBeenCalledWith('/pis/pi-1', { valorTotal: 2000 });
  });

  it('deletePI usa DELETE /pis/:id', async () => {
    apiClient.delete.mockResolvedValueOnce({});
    await deletePI('pi-1');
    expect(apiClient.delete).toHaveBeenCalledWith('/pis/pi-1');
  });

  // ── Workflow actions ─────────────────────────────────────────────────────

  it('approvePI usa POST /pis/:id/approve', async () => {
    apiClient.post.mockResolvedValueOnce({ data: { _id: 'pi-1', status: 'APPROVED' } });
    const result = await approvePI('pi-1');
    expect(apiClient.post).toHaveBeenCalledWith('/pis/pi-1/approve');
    expect(result.status).toBe('APPROVED');
  });

  it('rejectPI usa POST /pis/:id/reject', async () => {
    apiClient.post.mockResolvedValueOnce({ data: { _id: 'pi-1', status: 'REJECTED' } });
    const result = await rejectPI('pi-1');
    expect(apiClient.post).toHaveBeenCalledWith('/pis/pi-1/reject');
    expect(result.status).toBe('REJECTED');
  });

  it('cancelPI usa POST /pis/:id/cancel', async () => {
    apiClient.post.mockResolvedValueOnce({ data: { _id: 'pi-1', status: 'CANCELLED' } });
    const result = await cancelPI('pi-1');
    expect(apiClient.post).toHaveBeenCalledWith('/pis/pi-1/cancel');
    expect(result.status).toBe('CANCELLED');
  });

  it('generateContractFromPI usa POST /pis/:id/generate-contract', async () => {
    apiClient.post.mockResolvedValueOnce({ data: { _id: 'cont-1', piId: 'pi-1' } });
    const result = await generateContractFromPI('pi-1');
    expect(apiClient.post).toHaveBeenCalledWith('/pis/pi-1/generate-contract');
    expect(result._id).toBe('cont-1');
  });

  it('checkPIAvailability usa POST /pis/check-availability com body', async () => {
    const payload = { startDate: '2026-06-01', endDate: '2026-06-30' };
    apiClient.post.mockResolvedValueOnce({ data: { available: [], reserved: [] } });
    await checkPIAvailability(payload);
    expect(apiClient.post).toHaveBeenCalledWith('/pis/check-availability', payload);
  });

  // ── Endpoint isolation — acoes nao cruzam endpoints ──────────────────────

  it('approvePI nao chama reject ou cancel', async () => {
    apiClient.post.mockResolvedValueOnce({ data: { status: 'APPROVED' } });
    await approvePI('pi-x');
    const calls = apiClient.post.mock.calls;
    expect(calls.length).toBe(1);
    expect(calls[0][0]).toContain('/approve');
    expect(calls[0][0]).not.toContain('/reject');
    expect(calls[0][0]).not.toContain('/cancel');
  });

  it('cancelPI nao chama reject ou approve', async () => {
    apiClient.post.mockResolvedValueOnce({ data: { status: 'CANCELLED' } });
    await cancelPI('pi-x');
    const calls = apiClient.post.mock.calls;
    expect(calls[0][0]).toContain('/cancel');
    expect(calls[0][0]).not.toContain('/approve');
    expect(calls[0][0]).not.toContain('/reject');
  });
});
