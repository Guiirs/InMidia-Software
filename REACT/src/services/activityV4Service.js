import {
  normalizeActivityTimeline,
  normalizeActivityFeed,
  normalizeActivityAudit,
  normalizeActivityByDomain,
} from '../v4-painel/integration/adapters/activityAdapter.js';
import { ensureNoProductionMock, requestV4 } from './v4ServiceUtils.js';

export async function getActivityTimeline(params = {}) {
  const payload = await requestV4('get', '/activity/timeline', {
    operation: 'activity.timeline.read',
    params,
  });
  return normalizeActivityTimeline(ensureNoProductionMock(payload, 'activity.timeline.read'));
}

export async function getActivityFeed(params = {}) {
  const payload = await requestV4('get', '/activity/feed', {
    operation: 'activity.feed.read',
    params,
  });
  return normalizeActivityFeed(ensureNoProductionMock(payload, 'activity.feed.read'));
}

export async function getActivityAudit(params = {}) {
  const payload = await requestV4('get', '/activity/audit', {
    operation: 'activity.audit.read',
    params,
  });
  return normalizeActivityAudit(ensureNoProductionMock(payload, 'activity.audit.read'));
}

export async function getActivityByDomain(params = {}) {
  const payload = await requestV4('get', '/activity/by-domain', {
    operation: 'activity.byDomain.read',
    params,
  });
  return normalizeActivityByDomain(ensureNoProductionMock(payload, 'activity.byDomain.read'));
}
