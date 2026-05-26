import { useQuery } from '@tanstack/react-query';
import { PERMISSIONS } from '../auth/permissions';
import { useAuth } from '../context/AuthContext';
import { getAuditLogsByEntity } from '../services/auditService';

export function useEntityAudit(entityType, entityId, options = {}) {
  const { hasPermission } = useAuth();
  const canReadAudit = hasPermission(PERMISSIONS.AUDIT_READ);
  const enabled = Boolean(entityType && entityId && canReadAudit && options.enabled !== false);

  return useQuery({
    queryKey: ['entityAudit', entityType, entityId, options.limit || 10],
    queryFn: () => getAuditLogsByEntity(entityType, entityId, {
      limit: options.limit || 10,
      page: options.page || 1,
    }),
    enabled,
    staleTime: 1000 * 30,
    select: (result) => ({
      events: Array.isArray(result?.data) ? result.data : [],
      pagination: result?.pagination || {},
    }),
    placeholderData: { data: [], pagination: {} },
  });
}

export default useEntityAudit;
