import {
  mergeContractsPayload,
  normalizeContractTimeline,
  normalizeContractsList,
  normalizeContractsSummary,
} from '../v4-painel/integration/adapters/contractAdapter.js';
import { requestV4 } from './v4ServiceUtils.js';

export async function getContractsSummary() {
  const payload = await requestV4('get', '/contracts/summary', {
    operation: 'contracts.summary.read',
  });
  return normalizeContractsSummary(payload);
}

export async function listContracts(params = {}) {
  const payload = await requestV4('get', '/contracts/list', {
    operation: 'contracts.list.read',
    params,
  });
  return normalizeContractsList(payload);
}

export async function getActiveContracts(params = {}) {
  const payload = await requestV4('get', '/contracts/active', {
    operation: 'contracts.active.read',
    params,
  });
  return normalizeContractsList(payload);
}

export async function getExpiringContracts(params = {}) {
  const payload = await requestV4('get', '/contracts/expiring', {
    operation: 'contracts.expiring.read',
    params,
  });
  return normalizeContractsList(payload);
}

export async function getContractsTimeline(params = {}) {
  const payload = await requestV4('get', '/contracts/timeline', {
    operation: 'contracts.timeline.read',
    params,
  });
  return normalizeContractTimeline(payload);
}

export async function getContractsByBoard(boardId) {
  if (!boardId) return [];
  const payload = await requestV4('get', `/contracts/board/${boardId}`, {
    operation: 'contracts.by-board.read',
  });
  return normalizeContractsList(payload);
}

export async function getContractsPayload(params = {}) {
  const [summary, contracts, active, expiring, timeline] = await Promise.all([
    requestV4('get', '/contracts/summary', { operation: 'contracts.summary.read' }),
    requestV4('get', '/contracts/list', { operation: 'contracts.list.read', params }),
    requestV4('get', '/contracts/active', { operation: 'contracts.active.read', params }),
    requestV4('get', '/contracts/expiring', { operation: 'contracts.expiring.read', params }),
    requestV4('get', '/contracts/timeline', { operation: 'contracts.timeline.read', params }),
  ]);

  return mergeContractsPayload(summary, contracts, { active, expiring, timeline });
}

export async function createContract(payload) {
  const created = await requestV4('post', '/contracts', {
    operation: 'contracts.create',
    data: payload,
  });
  return normalizeContractsList([created])[0] ?? created;
}

export async function updateContract(id, payload) {
  const updated = await requestV4('patch', `/contracts/${id}`, {
    operation: 'contracts.update',
    data: payload,
  });
  return normalizeContractsList([updated])[0] ?? updated;
}

export async function changeContractStatus(id, status) {
  const updated = await requestV4('patch', `/contracts/${id}/status`, {
    operation: 'contracts.status.change',
    data: { status },
  });
  return normalizeContractsList([updated])[0] ?? updated;
}

export async function cancelContract(id, payload = {}) {
  const cancelled = await requestV4('post', `/contracts/${id}/cancel`, {
    operation: 'contracts.cancel',
    data: payload,
  });
  return normalizeContractsList([cancelled])[0] ?? cancelled;
}

export async function renewContract(id, payload = {}) {
  const renewed = await requestV4('post', `/contracts/${id}/renew`, {
    operation: 'contracts.renew',
    data: payload,
  });
  return normalizeContractsList([renewed])[0] ?? renewed;
}
