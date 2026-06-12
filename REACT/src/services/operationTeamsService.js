import { ensureNoProductionMock, requestFirstAvailable, v4Base } from './v4ServiceUtils.js';

function safeList(payload) {
  return Array.isArray(payload) ? payload : (payload?.teams ?? []);
}

export async function listOperationTeams(params = {}) {
  const payload = await requestFirstAvailable('get', [v4Base('/operation-teams')], {
    operation: 'operationTeams.list.read',
    params,
  });
  return ensureNoProductionMock(safeList(payload), 'operationTeams.list.read');
}

export async function getOperationTeamById(id) {
  const result = await requestFirstAvailable('get', [v4Base(`/operation-teams/${id}`)], {
    operation: 'operationTeams.single.read',
  });
  return result?.team ?? result;
}

export async function createOperationTeam(payload) {
  const result = await requestFirstAvailable('post', [v4Base('/operation-teams')], {
    operation: 'operationTeams.create',
    data: payload,
  });
  return result?.team ?? result;
}

export async function updateOperationTeam(id, payload) {
  const result = await requestFirstAvailable('put', [v4Base(`/operation-teams/${id}`)], {
    operation: 'operationTeams.update',
    data: payload,
  });
  return result?.team ?? result;
}

export async function archiveOperationTeam(id) {
  const result = await requestFirstAvailable('post', [v4Base(`/operation-teams/${id}/archive`)], {
    operation: 'operationTeams.archive',
    data: {},
  });
  return result?.team ?? result;
}
