import { ensureNoProductionMock, requestFirstAvailable, v4Base } from './v4ServiceUtils.js';

function safeList(payload) {
  return Array.isArray(payload) ? payload : (payload?.tasks ?? payload?.events ?? payload?.items ?? []);
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getOperationsTimeline(params = {}) {
  const payload = await requestFirstAvailable('get', [v4Base('/operations/timeline')], {
    operation: 'operations.timeline.read',
    params,
  });
  return ensureNoProductionMock(safeList(payload), 'operations.timeline.read');
}

export async function getOperationsSummary(params = {}) {
  const payload = await requestFirstAvailable('get', [v4Base('/operations/summary')], {
    operation: 'operations.summary.read',
    params,
  });
  return ensureNoProductionMock(payload, 'operations.summary.read');
}

export async function listOperations(params = {}) {
  const payload = await requestFirstAvailable('get', [v4Base('/operations')], {
    operation: 'operations.list.read',
    params,
  });
  return ensureNoProductionMock(payload, 'operations.list.read');
}

export async function listOperationTasks(params = {}) {
  const payload = await requestFirstAvailable('get', [v4Base('/operations/tasks')], {
    operation: 'operations.tasks.read',
    params,
  });
  return ensureNoProductionMock(safeList(payload), 'operations.tasks.read');
}

export async function listPendingOperationTasks(params = {}) {
  const payload = await requestFirstAvailable('get', [v4Base('/operations/tasks/pending')], {
    operation: 'operations.tasks.pending.read',
    params,
  });
  return ensureNoProductionMock(safeList(payload), 'operations.tasks.pending.read');
}

export async function getOperationsByDomain(params = {}) {
  const payload = await requestFirstAvailable('get', [v4Base('/operations/by-domain')], {
    operation: 'operations.by-domain.read',
    params,
  });
  return ensureNoProductionMock(payload, 'operations.by-domain.read');
}

export async function getOperationById(id) {
  const result = await requestFirstAvailable('get', [v4Base(`/operations/${id}`)], {
    operation: 'operations.single.read',
  });
  return result?.task ?? result;
}

export async function getOperationsByPlate(plateId, params = {}) {
  const payload = await requestFirstAvailable('get', [v4Base(`/operations/by-plate/${plateId}`)], {
    operation: 'operations.by-plate.read',
    params,
  });
  return ensureNoProductionMock(payload, 'operations.by-plate.read');
}

export async function getOperationsByRegion(regionId, params = {}) {
  const payload = await requestFirstAvailable('get', [v4Base(`/operations/by-region/${regionId}`)], {
    operation: 'operations.by-region.read',
    params,
  });
  return ensureNoProductionMock(payload, 'operations.by-region.read');
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export async function createOperationTask(payload) {
  const result = await requestFirstAvailable('post', [v4Base('/operations')], {
    operation: 'operations.task.create',
    data: payload,
  });
  return result?.task ?? result;
}

export async function updateOperationTask(id, payload) {
  const result = await requestFirstAvailable('patch', [v4Base(`/operations/tasks/${id}`)], {
    operation: 'operations.task.update',
    data: payload,
  });
  return result?.task ?? result;
}

export async function startOperationTask(id, payload = {}) {
  const result = await requestFirstAvailable('post', [v4Base(`/operations/${id}/start`)], {
    operation: 'operations.task.start',
    data: payload,
  });
  return result?.task ?? result;
}

export async function completeOperationTask(id, payload = {}) {
  const result = await requestFirstAvailable('post', [v4Base(`/operations/${id}/complete`)], {
    operation: 'operations.task.complete',
    data: payload,
  });
  return result?.task ?? result;
}

export async function cancelOperationTask(id, payload = {}) {
  const result = await requestFirstAvailable('post', [v4Base(`/operations/${id}/cancel`)], {
    operation: 'operations.task.cancel',
    data: payload,
  });
  return result?.task ?? result;
}

export async function assignOperationTask(id, payload = {}) {
  const result = await requestFirstAvailable('patch', [v4Base(`/operations/tasks/${id}/assign`)], {
    operation: 'operations.task.assign',
    data: payload,
  });
  return result?.task ?? result;
}

export async function createOperationEvent(payload) {
  const result = await requestFirstAvailable('post', [v4Base('/operations/events')], {
    operation: 'operations.event.create',
    data: payload,
  });
  return result?.event ?? result;
}
