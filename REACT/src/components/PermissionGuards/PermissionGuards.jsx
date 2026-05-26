import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { PERMISSIONS } from '../../auth/permissions';
import AccessDenied from '../AccessDenied/AccessDenied';
import Spinner from '../Spinner/Spinner';

function GuardShell({ isAllowed, children, deniedMessage }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <Spinner message="A verificar permissoes..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isAllowed) {
    return <AccessDenied message={deniedMessage} />;
  }

  return children || <Outlet />;
}

export function RequirePermission({ permission, routeKey, children, deniedMessage }) {
  const { hasPermission, canAccessRoute } = useAuth();
  const isAllowed = routeKey ? canAccessRoute(routeKey) : hasPermission(permission);

  return (
    <GuardShell isAllowed={isAllowed} deniedMessage={deniedMessage}>
      {children}
    </GuardShell>
  );
}

export function RequireAnyPermission({ permissions, children, deniedMessage }) {
  const { hasAnyPermission } = useAuth();

  return (
    <GuardShell isAllowed={hasAnyPermission(permissions)} deniedMessage={deniedMessage}>
      {children}
    </GuardShell>
  );
}

export function RequireAdminAccess({ children }) {
  const { hasAnyPermission } = useAuth();
  const isAllowed = hasAnyPermission([
    PERMISSIONS.USERS_MANAGE,
    PERMISSIONS.SYNC_OPS_VIEW,
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.ADMIN_ACCESS,
  ]);

  return (
    <GuardShell
      isAllowed={isAllowed}
      deniedMessage="Esta area e reservada para administradores da empresa."
    >
      {children}
    </GuardShell>
  );
}

export default RequirePermission;
