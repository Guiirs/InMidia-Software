import { getFeatureFlags, FEATURE_FLAGS_DEFAULTS } from '../../../services/featureFlagsService.js';

const FEATURES_TTL_MS    = 5 * 60_000;  // 5 min — flags mudam raramente
const FEATURES_STALE_MS  = 15 * 60_000; // 15 min stale window

export const featuresAdapter = {
  domain: 'features',
  domainEvents: ['features.updated'],
  permissions: [],   // qualquer usuário autenticado pode ler suas flags
  ttlMs: FEATURES_TTL_MS,
  fallbackPolicy: 'keep-last-valid',

  resources: [
    {
      key: 'features.flags',
      domain: 'features',
      fetcher: getFeatureFlags,
      ttlMs: FEATURES_TTL_MS,
      staleWhileRevalidate: FEATURES_STALE_MS,
      dependencies: [],
      dependents: [],
      domainEvents: ['features.updated'],
      realtimeEvents: [],
      permissions: [],
      fallbackPolicy: 'keep-last-valid',
      // Fallback seguro: todos os flags false enquanto carrega
      fallbackData: { ...FEATURE_FLAGS_DEFAULTS },
      productionMockAllowed: false,
      debugLabel: 'Feature flags',
    },
  ],

  mutations: [],
  realtimeEvents: {},
};
