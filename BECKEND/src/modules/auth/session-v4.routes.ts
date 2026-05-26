import { Router, Request, Response } from 'express';
import authenticateToken from '@shared/infra/http/middlewares/auth.middleware';
import { requireTenantGuard } from '@shared/infra/http/middlewares/tenant-guard.middleware';
import { getV4Permissions } from '@shared/infra/http/permissions/permissions.types';
import type { IAuthRequest } from '../../types/express.d';

const router = Router();

router.use(authenticateToken, requireTenantGuard);

/**
 * GET /api/v4/auth/session
 * Returns the authenticated user's session data with V4-format permissions.
 * Used by Sync Core on startup to validate auth and load RBAC context.
 */
router.get('/session', (req: Request, res: Response): void => {
  const authReq = req as IAuthRequest;
  const user = authReq.user;
  const permCtx = authReq.permissionContext;

  if (!user || !permCtx) {
    res.status(401).json({
      success: false,
      code: 'AUTH_REQUIRED',
      message: 'Sessão não encontrada.',
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: {
      id: String(user.id),
      email: user.email,
      nome: user.nome ?? null,
      role: permCtx.role,
      tenantId: String(user.empresaId),
      permissions: getV4Permissions(permCtx.permissions),
    },
  });
});

export default router;
