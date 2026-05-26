import { ensureNoProductionMock, requestFirstAvailable, v4Base } from './v4ServiceUtils.js';

function groupByDomain(alerts = []) {
  return alerts.reduce((acc, alert) => {
    const domain = alert.domain ?? alert.source ?? alert.category ?? alert.categoria ?? 'system';
    acc[domain] = [...(acc[domain] ?? []), alert];
    return acc;
  }, {});
}

export async function listAlerts(params = {}) {
  const payload = await requestFirstAvailable('get', [v4Base('/alerts')], {
    operation: 'alerts.list.read',
    params,
  });
  return ensureNoProductionMock(Array.isArray(payload) ? payload : (payload?.alerts ?? payload?.items ?? []), 'alerts.list.read');
}

export async function getAlertsSummary(params = {}) {
  const payload = await requestFirstAvailable('get', [v4Base('/alerts/summary')], {
    operation: 'alerts.summary.read',
    params,
  });
  return ensureNoProductionMock(payload, 'alerts.summary.read');
}

export async function getCriticalAlerts(params = {}) {
  const payload = await requestFirstAvailable('get', [v4Base('/alerts/critical')], {
    operation: 'alerts.critical.read',
    params,
  });
  return ensureNoProductionMock(Array.isArray(payload) ? payload : (payload?.alerts ?? payload?.items ?? []), 'alerts.critical.read');
}

export async function getUnreadAlerts(params = {}) {
  const payload = await requestFirstAvailable('get', [v4Base('/alerts/unread')], {
    operation: 'alerts.unread.read',
    params,
  });
  return ensureNoProductionMock(Array.isArray(payload) ? payload : (payload?.alerts ?? payload?.items ?? []), 'alerts.unread.read');
}

export async function getAlertsByDomain(params = {}) {
  const payload = await requestFirstAvailable('get', [v4Base('/alerts/by-domain')], {
    operation: 'alerts.by-domain.read',
    params,
  });
  const grouped = payload?.byDomain ?? (payload && !Array.isArray(payload) ? payload : groupByDomain(Array.isArray(payload) ? payload : (payload?.items ?? [])));
  return ensureNoProductionMock(grouped, 'alerts.by-domain.read');
}

export async function markAlertRead(id, payload = {}) {
  const result = await requestFirstAvailable('patch', [v4Base(`/alerts/${id}/read`)], {
    operation: 'alerts.mark-read',
    data: payload,
  });
  return result?.alert ?? result;
}

export async function markAllAlertsRead(payload = {}) {
  return requestFirstAvailable('patch', [v4Base('/alerts/read-all')], {
    operation: 'alerts.mark-all-read',
    data: payload,
  });
}

export async function dismissAlert(id, payload = {}) {
  const result = await requestFirstAvailable('patch', [v4Base(`/alerts/${id}/dismiss`)], {
    operation: 'alerts.dismiss',
    data: payload,
  });
  return result?.alert ?? result;
}

export async function resolveAlert(id, payload = {}) {
  const result = await requestFirstAvailable('patch', [v4Base(`/alerts/${id}/resolve`)], {
    operation: 'alerts.resolve',
    data: payload,
  });
  return result?.alert ?? result;
}

export async function createManualAlert(payload) {
  const result = await requestFirstAvailable('post', [v4Base('/alerts/manual')], {
    operation: 'alerts.manual.create',
    data: payload,
  });
  return result?.alert ?? result;
}
