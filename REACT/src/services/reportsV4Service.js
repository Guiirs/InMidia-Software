import { ensureNoProductionMock, requestFirstAvailable, v4Base } from './v4ServiceUtils.js';

function safeList(payload) {
  return Array.isArray(payload) ? payload : (payload?.exports ?? payload?.items ?? []);
}

export async function getReportsSummary(params = {}) {
  const payload = await requestFirstAvailable('get', [v4Base('/reports/summary')], {
    operation: 'reports.summary.read',
    params,
  });
  return ensureNoProductionMock(payload, 'reports.summary.read');
}

export async function getReportsAnalytics(params = {}) {
  const payload = await requestFirstAvailable('get', [v4Base('/reports/analytics')], {
    operation: 'reports.analytics.read',
    params,
  });
  return ensureNoProductionMock(payload, 'reports.analytics.read');
}

export async function listReportExports(params = {}) {
  const payload = await requestFirstAvailable('get', [v4Base('/reports/exports')], {
    operation: 'reports.exports.read',
    params,
  });
  return ensureNoProductionMock(safeList(payload), 'reports.exports.read');
}

export async function getReportsByPeriod(params = {}) {
  const payload = await requestFirstAvailable('get', [v4Base('/reports/by-period')], {
    operation: 'reports.by-period.read',
    params,
  });
  return ensureNoProductionMock(payload, 'reports.by-period.read');
}

export async function getReportsByDomain(params = {}) {
  const payload = await requestFirstAvailable('get', [v4Base('/reports/by-domain')], {
    operation: 'reports.by-domain.read',
    params,
  });
  return ensureNoProductionMock(payload, 'reports.by-domain.read');
}

export async function createReportExport(payload) {
  const result = await requestFirstAvailable('post', [v4Base('/reports/exports')], {
    operation: 'reports.export.create',
    data: payload,
  });
  return result?.export ?? result;
}

export async function cancelReportExport(id, payload = {}) {
  const result = await requestFirstAvailable('patch', [v4Base(`/reports/exports/${id}/cancel`)], {
    operation: 'reports.export.cancel',
    data: payload,
  });
  return result?.export ?? result;
}

export async function createReportSchedule(payload) {
  const result = await requestFirstAvailable('post', [v4Base('/reports/schedules')], {
    operation: 'reports.schedule.create',
    data: payload,
  });
  return result?.schedule ?? result;
}

export async function updateReportSchedule(id, payload) {
  const result = await requestFirstAvailable('patch', [v4Base(`/reports/schedules/${id}`)], {
    operation: 'reports.schedule.update',
    data: payload,
  });
  return result?.schedule ?? result;
}

export async function deleteReportSchedule(id, payload = {}) {
  return requestFirstAvailable('delete', [v4Base(`/reports/schedules/${id}`)], {
    operation: 'reports.schedule.delete',
    data: payload,
  });
}
