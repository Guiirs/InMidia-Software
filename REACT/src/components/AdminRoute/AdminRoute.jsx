import React from 'react';
import { RequireAdminAccess } from '../PermissionGuards/PermissionGuards';

function AdminRoute() {
  return <RequireAdminAccess />;
}

export default AdminRoute;
