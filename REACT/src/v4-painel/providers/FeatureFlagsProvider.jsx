import { createContext, memo, useContext, useMemo } from 'react';
import { useSyncResource } from '../../core/sync-core/hooks/useSyncResource.js';

const FEATURE_FLAGS_DEFAULTS = {
  v4Painel:     false,
  v4Commercial: false,
  v4Reports:    false,
  v4Alerts:     false,
  v4Operations: false,
  syncDevtools: false,
};

const FeatureFlagsContext = createContext(FEATURE_FLAGS_DEFAULTS);

/**
 * Fornece as feature flags do tenant para a árvore de componentes.
 *
 * Deve ser usado dentro de <SyncCoreProvider>.
 * Enquanto as flags carregam, retorna os defaults (todos false) — fail-safe.
 */
function FeatureFlagsProvider({ children }) {
  const resource = useSyncResource('features.flags');

  const flags = useMemo(() => {
    const data = resource.data;
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      return { ...FEATURE_FLAGS_DEFAULTS, ...data };
    }
    return FEATURE_FLAGS_DEFAULTS;
  }, [resource.data]);

  return (
    <FeatureFlagsContext.Provider value={flags}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

/**
 * Retorna todas as feature flags do tenant.
 */
export function useFeatures() {
  return useContext(FeatureFlagsContext);
}

/**
 * Retorna o valor booleano de uma flag específica.
 * Retorna false se a flag não existir ou ainda estiver carregando.
 */
export function useFeatureFlag(flag) {
  const flags = useContext(FeatureFlagsContext);
  return flags[flag] === true;
}

export default memo(FeatureFlagsProvider);
