function arr(value) {
  return Array.isArray(value) ? value : [];
}

function unwrap(payload, key) {
  const raw = payload?.data ?? payload ?? {};
  if (Array.isArray(raw)) return raw;
  if (key && Array.isArray(raw[key])) return raw[key];
  return raw;
}

const DOMAIN_LABELS = {
  commercial:  'Comercial',
  operations:  'Operações',
  contracts:   'Contratos',
  alerts:      'Alertas',
  reports:     'Relatórios',
  system:      'Sistema',
};

const DOMAIN_ICONS = {
  commercial:  'business_center',
  operations:  'precision_manufacturing',
  contracts:   'description',
  alerts:      'notifications_active',
  reports:     'analytics',
  system:      'settings',
};

export const EMPTY_ACTIVITY_SNAPSHOT = {
  timeline: [],
  feed: [],
  audit: [],
  byDomain: {},
  generatedAt: null,
};

export function createEmptyActivitySnapshot() {
  return {
    timeline: [],
    feed: [],
    audit: [],
    byDomain: {},
    generatedAt: null,
  };
}

function normalizeItem(item, index) {
  const domain = item.domain ?? 'system';
  return {
    id: item.id ?? item.realId ?? `activity-${index}`,
    realId: item.realId ?? item.id ?? null,
    domain,
    domainLabel: item.domainLabel ?? DOMAIN_LABELS[domain] ?? domain,
    domainIcon: DOMAIN_ICONS[domain] ?? 'task_alt',
    type: item.type ?? 'event',
    title: item.title ?? 'Evento',
    description: item.description ?? null,
    entityId: item.entityId ?? null,
    entityType: item.entityType ?? null,
    actorId: item.actorId ?? null,
    status: item.status ?? 'created',
    payload: item.payload ?? {},
    createdAt: item.createdAt ?? null,
    updatedAt: item.updatedAt ?? null,
  };
}

export function normalizeActivityTimeline(payload) {
  const raw = unwrap(payload);
  const events = arr(raw.events ?? raw.items ?? (Array.isArray(raw) ? raw : []));
  return {
    events: events.map(normalizeItem),
    total: raw.total ?? events.length,
    cursor: raw.cursor ?? null,
    generatedAt: raw.generatedAt ?? null,
  };
}

export function normalizeActivityFeed(payload) {
  const raw = unwrap(payload);
  const items = arr(raw.items ?? raw.events ?? (Array.isArray(raw) ? raw : []));
  return items.map(normalizeItem);
}

export function normalizeActivityAudit(payload) {
  const raw = unwrap(payload);
  const entries = arr(raw.entries ?? raw.items ?? (Array.isArray(raw) ? raw : []));
  return {
    entries: entries.map(normalizeItem),
    total: raw.total ?? entries.length,
    generatedAt: raw.generatedAt ?? null,
  };
}

export function normalizeActivityByDomain(payload) {
  const raw = unwrap(payload);
  const byDomain = raw.byDomain ?? (typeof raw === 'object' && !Array.isArray(raw) ? raw : {});
  return Object.fromEntries(
    Object.entries(byDomain).map(([domain, stats]) => [
      domain,
      {
        domain,
        domainLabel: DOMAIN_LABELS[domain] ?? domain,
        domainIcon: DOMAIN_ICONS[domain] ?? 'task_alt',
        count: stats?.count ?? 0,
        lastAt: stats?.lastAt ?? null,
      },
    ]),
  );
}
