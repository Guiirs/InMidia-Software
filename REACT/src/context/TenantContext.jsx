// src/context/TenantContext.jsx
import { createContext, useContext, useMemo } from 'react';
import { useAuth } from './AuthContext';

const TenantContext = createContext(null);

/** Calcula os valores de tenant a partir do estado de auth. Exportado para testabilidade. */
export function computeTenantValues(auth) {
  const { organization, membership, tenantMode } = auth ?? {};
  const role = membership?.role ?? null;
  const isOwner = role === 'OWNER';
  const isAdmin = role === 'ADMIN' || isOwner;
  const hasOrganization = Boolean(organization);
  const isLegacyMode = !hasOrganization || tenantMode === 'legacy';

  return {
    organization: organization ?? null,
    membership: membership ?? null,
    tenantMode: tenantMode ?? null,
    hasOrganization,
    role,
    canManageOrganization: isOwner,
    canInviteMembers: isAdmin,
    isOwner,
    isAdmin,
    isLegacyMode,
  };
}

export function TenantProvider({ children }) {
  const auth = useAuth();

  const value = useMemo(() => computeTenantValues(auth), [auth]);

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant deve ser usado dentro de um TenantProvider');
  return ctx;
}
