// src/context/AuthContext.jsx
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { jwtDecode } from 'jwt-decode';
import * as syncService from '../services/syncService';
import { logoutUser as logoutUserApi, refreshAccessToken } from '../services/authService';
import {
  canAccessRouteWithPermissions,
  hasAllPermissionsInList,
  hasAnyPermissionInList,
  hasPermissionInList,
  normalizeAuthUser,
} from '../auth/permissions';

const decodeJWT = (token) => {
  try {
    return jwtDecode(token);
  } catch (error) {
    console.error('[AuthContext] Erro ao decodificar token:', error.message);
    return null;
  }
};

const AuthContext = createContext(null);
const EMPTY_PERMISSIONS = [];

export function clearAuthSessionStorage(storage = localStorage) {
  storage.removeItem('user');
  storage.removeItem('token');
  storage.removeItem('permissions');
  storage.removeItem('session');
  storage.removeItem('organization');
  storage.removeItem('membership');
  storage.removeItem('tenantMode');
}

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(null);
  const [token, setTokenState] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [membership, setMembership] = useState(null);
  const [tenantMode, setTenantMode] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionWarning, setSessionWarning] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    try {
      const storedToken = localStorage.getItem('token');
      const storedUserString = localStorage.getItem('user');

      if (storedToken && storedUserString) {
        /* Valida expiração antes de restaurar — evita iniciar autenticado com token morto */
        const decoded = decodeJWT(storedToken);
        const nowSec = Math.floor(Date.now() / 1000);
        if (!decoded?.exp || decoded.exp <= nowSec) {
          console.warn('[AuthContext] Token expirado no localStorage — sessão não restaurada.');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setIsLoading(false);
          return;
        }

        const storedUser = normalizeAuthUser(JSON.parse(storedUserString));
        setUserState(storedUser);
        setTokenState(storedToken);
        setIsAuthenticated(true);

        const storedOrg = localStorage.getItem('organization');
        const storedMembership = localStorage.getItem('membership');
        const storedTenantMode = localStorage.getItem('tenantMode');
        if (storedOrg) setOrganization(JSON.parse(storedOrg));
        if (storedMembership) setMembership(JSON.parse(storedMembership));
        if (storedTenantMode) setTenantMode(storedTenantMode);

        syncService.boot().catch(err => {
          console.warn('[AuthContext] Sync boot (sessao restaurada) falhou:', err?.message);
        });
      }
    } catch (error) {
      console.error('[AuthContext] Erro ao carregar dados do localStorage:', error);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearSessionStorage = useCallback(() => {
    clearAuthSessionStorage();
  }, []);

  const logout = useCallback(() => {
    // Notifica o servidor para revogar sessão e limpar cookies HttpOnly
    logoutUserApi().catch(() => {});
    syncService.reset();
    clearSessionStorage();
    setUserState(null);
    setTokenState(null);
    setOrganization(null);
    setMembership(null);
    setTenantMode(null);
    setIsAuthenticated(false);
    setSessionWarning(false);
  }, [clearSessionStorage]);

  const dismissSessionWarning = useCallback(() => {
    setSessionWarning(false);
  }, []);

  const renewSession = useCallback(async () => {
    try {
      const newToken = await refreshAccessToken();

      if (newToken) {
        localStorage.setItem('token', newToken);
        setTokenState(newToken);
      }

      setSessionWarning(false);
      setSessionExpired(false);
      return true;
    } catch (error) {
      console.warn('[AuthContext] Falha ao renovar sessao:', error?.message);
      logout();
      return false;
    }
  }, [logout]);

  const expireSession = useCallback((message = 'Sua sessão expirou. Faça login novamente.') => {
    if (!localStorage.getItem('token') && !isAuthenticated) return;
    console.warn('[AuthContext] Sessao expirada:', message);
    setSessionExpired(true);
    logout();
  }, [isAuthenticated, logout]);

  /* Escuta evento global disparado pelo apiClient quando recebe 403/401 por token expirado.
     Só age se ainda houver token no localStorage (evita loop se já deslogado). */
  useEffect(() => {
    const handleSessionExpired = (event) => {
      expireSession(event?.detail?.message);
    };
    window.addEventListener('auth:expired', handleSessionExpired);
    window.addEventListener('v4:session-expired', handleSessionExpired);
    return () => {
      window.removeEventListener('auth:expired', handleSessionExpired);
      window.removeEventListener('v4:session-expired', handleSessionExpired);
    };
  }, [expireSession]);

  useEffect(() => {
    if (!token) return undefined;

    const checkTokenExpiration = () => {
      const decoded = decodeJWT(token);

      if (!decoded || typeof decoded.exp !== 'number') {
        logout();
        return;
      }

      const currentTime = Math.floor(Date.now() / 1000);
      const timeUntilExpiry = decoded.exp - currentTime;

      if (timeUntilExpiry <= 0) {
        logout();
      } else if (timeUntilExpiry <= 300) {
        setSessionWarning(true);
      } else {
        setSessionWarning(false);
      }
    };

    checkTokenExpiration();
    const interval = setInterval(checkTokenExpiration, 60000);
    return () => clearInterval(interval);
  }, [logout, token]);

  const login = useCallback((userData, userToken, options = {}) => {
    try {
      const normalizedUser = normalizeAuthUser(userData);
      localStorage.setItem('user', JSON.stringify(normalizedUser));
      localStorage.setItem('token', userToken);
      setUserState(normalizedUser);
      setTokenState(userToken);
      setIsAuthenticated(true);
      setSessionExpired(false);

      const { organization: org, membership: mem, tenantMode: mode } = options;
      if (org) {
        localStorage.setItem('organization', JSON.stringify(org));
        setOrganization(org);
      }
      if (mem) {
        localStorage.setItem('membership', JSON.stringify(mem));
        setMembership(mem);
      }
      if (mode) {
        localStorage.setItem('tenantMode', mode);
        setTenantMode(mode);
      }

      syncService.boot().catch(err => {
        console.warn('[AuthContext] Sync boot falhou (nao critico):', err?.message);
      });
    } catch (error) {
      console.error('[AuthContext] Erro ao guardar dados no localStorage durante o login:', error);
    }
  }, []);

  const updateUser = useCallback((newUserData) => {
    if (isAuthenticated && newUserData) {
      try {
        const normalizedUser = normalizeAuthUser({ ...user, ...newUserData });
        localStorage.setItem('user', JSON.stringify(normalizedUser));
        setUserState(normalizedUser);
      } catch (error) {
        console.error('[AuthContext] Erro ao atualizar dados do utilizador no localStorage:', error);
      }
    }
  }, [isAuthenticated, user]);

  const role = user?.role || null;
  const permissions = user?.permissions ?? EMPTY_PERMISSIONS;
  const empresaId = user?.empresaId || null;
  const userId = user?.userId || null;

  const hasOrganization = Boolean(organization);
  const isOrganizationMode = hasOrganization && tenantMode !== 'legacy';
  const isLegacyTenantMode = !hasOrganization || tenantMode === 'legacy';
  const currentOrganizationId = organization?.id ?? null;
  const currentMembershipRole = membership?.role ?? null;

  const value = useMemo(() => ({
    user,
    token,
    role,
    permissions,
    empresaId,
    userId,
    organization,
    membership,
    tenantMode,
    hasOrganization,
    isOrganizationMode,
    isLegacyTenantMode,
    currentOrganizationId,
    currentMembershipRole,
    isAuthenticated,
    isLoading,
    sessionWarning,
    sessionExpired,
    hasPermission: (permission) => hasPermissionInList(permissions, permission),
    hasAnyPermission: (requiredPermissions) => hasAnyPermissionInList(permissions, requiredPermissions),
    hasAllPermissions: (requiredPermissions) => hasAllPermissionsInList(permissions, requiredPermissions),
    canAccessRoute: (routeKey) => canAccessRouteWithPermissions(permissions, routeKey),
    login,
    logout,
    renewSession,
    dismissSessionWarning,
    updateUser,
  }), [
    user,
    token,
    role,
    permissions,
    empresaId,
    userId,
    organization,
    membership,
    tenantMode,
    hasOrganization,
    isOrganizationMode,
    isLegacyTenantMode,
    currentOrganizationId,
    currentMembershipRole,
    isAuthenticated,
    isLoading,
    sessionWarning,
    sessionExpired,
    login,
    logout,
    renewSession,
    dismissSessionWarning,
    updateUser,
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}
