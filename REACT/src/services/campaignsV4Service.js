import { ensureNoProductionMock, requestFirstAvailable, v4Base } from './v4ServiceUtils.js';

function safeList(payload) {
  return Array.isArray(payload) ? payload : (payload?.campaigns ?? payload?.items ?? []);
}

export async function getCampaignsSummary(params = {}) {
  const payload = await requestFirstAvailable('get', [v4Base('/campaigns/summary')], {
    operation: 'campaigns.summary.read',
    params,
  });
  return ensureNoProductionMock(payload, 'campaigns.summary.read');
}

export async function listCampaigns(params = {}) {
  const payload = await requestFirstAvailable('get', [v4Base('/campaigns')], {
    operation: 'campaigns.list.read',
    params,
  });
  return ensureNoProductionMock(payload, 'campaigns.list.read');
}

export async function getActiveCampaigns(params = {}) {
  const payload = await requestFirstAvailable('get', [v4Base('/campaigns/active')], {
    operation: 'campaigns.active.read',
    params,
  });
  return ensureNoProductionMock(safeList(payload), 'campaigns.active.read');
}

export async function getScheduledCampaigns(params = {}) {
  const payload = await requestFirstAvailable('get', [v4Base('/campaigns/scheduled')], {
    operation: 'campaigns.scheduled.read',
    params,
  });
  return ensureNoProductionMock(safeList(payload), 'campaigns.scheduled.read');
}

export async function getCampaignsPerformance(params = {}) {
  const payload = await requestFirstAvailable('get', [v4Base('/campaigns/performance')], {
    operation: 'campaigns.performance.read',
    params,
  });
  return ensureNoProductionMock(payload, 'campaigns.performance.read');
}

export async function createCampaign(payload) {
  const result = await requestFirstAvailable('post', [v4Base('/campaigns')], {
    operation: 'campaigns.create',
    data: payload,
  });
  return result?.campaign ?? result;
}

export async function updateCampaign(id, payload) {
  const result = await requestFirstAvailable('patch', [v4Base(`/campaigns/${id}`)], {
    operation: 'campaigns.update',
    data: payload,
  });
  return result?.campaign ?? result;
}

export async function pauseCampaign(id) {
  const result = await requestFirstAvailable('patch', [v4Base(`/campaigns/${id}/pause`)], {
    operation: 'campaigns.pause',
    data: {},
  });
  return result?.campaign ?? result;
}

export async function activateCampaign(id) {
  const result = await requestFirstAvailable('patch', [v4Base(`/campaigns/${id}/activate`)], {
    operation: 'campaigns.activate',
    data: {},
  });
  return result?.campaign ?? result;
}

export async function deleteCampaign(id) {
  const result = await requestFirstAvailable('delete', [v4Base(`/campaigns/${id}`)], {
    operation: 'campaigns.delete',
  });
  return result;
}
