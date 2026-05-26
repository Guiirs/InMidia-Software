/**
 * RBAC Routes — lista roles e permissões para frontend e diagnóstico.
 * Protegido por autenticação e permissão settings.manage ou usuarios.manage.
 */

import { Request, Response, NextFunction, Router } from 'express';
import authenticateToken from '@middlewares/auth.middleware';
import { requireTenantGuard } from '@shared/infra/http/middlewares/tenant-guard.middleware';
import {
  ALL_PERMISSIONS,
  ROLE_PERMISSION_MAP,
  CanonicalRole,
} from '@shared/infra/http/permissions/permissions.types';
import { defaultAuditService } from '@modules/audit/audit.service';

const router = Router();

router.use(authenticateToken, requireTenantGuard);

const PERMISSION_DESCRIPTIONS: Record<string, string> = {
  'dashboard.read':    'Visualizar dashboard operacional',
  'placas.read':       'Visualizar placas/inventário (legado)',
  'placas.create':     'Criar placas (legado)',
  'placas.update':     'Editar placas (legado)',
  'placas.delete':     'Excluir placas (legado)',
  'relatorios.read':   'Visualizar relatórios (legado)',
  'propostas.read':    'Visualizar propostas internas (legado)',
  'propostas.create':  'Criar propostas internas (legado)',
  'propostas.update':  'Editar propostas internas (legado)',
  'contratos.read':    'Visualizar contratos (legado)',
  'contratos.create':  'Criar contratos (legado)',
  'contratos.approve': 'Aprovar contratos (legado)',
  'admin.access':      'Acesso ao painel de administração',
  'usuarios.manage':   'Gerenciar usuários da empresa (legado)',
  'empresas.manage':   'Gerenciar configurações da empresa (legado)',
  'sync.diagnostics':  'Visualizar diagnósticos de sincronização',
  'audit.read':        'Ler log de auditoria',
  'audit.export':      'Exportar log de auditoria',
  'inventory.read':    'Visualizar inventário V4',
  'inventory.update':  'Atualizar itens do inventário V4',
  'inventory.create':  'Criar itens no inventário V4',
  'inventory.delete':  'Excluir itens do inventário V4',
  'contracts.read':    'Visualizar contratos V4',
  'contracts.create':  'Criar contratos V4',
  'contracts.update':  'Atualizar contratos V4',
  'contracts.cancel':  'Cancelar contratos V4',
  'contracts.renew':   'Renovar contratos V4',
  'contracts.delete':  'Excluir contratos V4',
  'commercial.read':   'Visualizar pipeline comercial V4',
  'commercial.create': 'Criar oportunidades/propostas V4',
  'commercial.update': 'Atualizar oportunidades/propostas V4',
  'commercial.delete': 'Excluir itens comerciais V4',
  'commercial.convert':'Converter proposta em contrato V4',
  'alerts.read':       'Visualizar alertas V4',
  'alerts.update':     'Atualizar alertas V4',
  'alerts.resolve':    'Resolver alertas V4',
  'alerts.dismiss':    'Descartar alertas V4',
  'alerts.create':     'Criar alertas V4',
  'operations.read':   'Visualizar operações V4',
  'operations.create': 'Criar operações V4',
  'operations.update': 'Atualizar operações V4',
  'operations.assign': 'Atribuir operações V4',
  'operations.complete':'Concluir operações V4',
  'reports.read':      'Visualizar relatórios V4',
  'reports.export':    'Exportar relatórios V4',
  'reports.schedule':  'Agendar relatórios V4',
  'activity.read':     'Visualizar log de atividade V4',
  'activity.write':    'Registrar atividade V4',
  'campaigns.read':    'Visualizar campanhas V4',
  'campaigns.create':  'Criar campanhas V4',
  'campaigns.update':  'Atualizar campanhas V4',
  'campaigns.delete':  'Excluir campanhas V4',
  'users.manage':      'Gerenciar usuários V4',
  'settings.manage':   'Gerenciar configurações V4',
  'system.readiness':  'Verificar readiness do sistema V4',
  'auth.session.read': 'Ler dados de sessão autenticada',
  'realtime.read':     'Acesso a dados em tempo real',
};

const ROLE_DESCRIPTIONS: Record<CanonicalRole, string> = {
  superadmin:    'Acesso total ao sistema — não restrito a tenant',
  admin_empresa: 'Administrador da empresa — controle total dentro do tenant',
  gestor:        'Gestor operacional — pode criar e gerir mas não deletar',
  vendedor:      'Vendedor — foco em pipeline comercial e propostas',
  financeiro:    'Financeiro — foco em contratos, pagamentos e relatórios',
  visualizador:  'Visualizador — leitura apenas, sem mutações',
};

/**
 * GET /api/v1/rbac/permissions
 * Lista todas as permissões disponíveis com descrições.
 * Requer: autenticação. Disponível para qualquer role autenticada (leitura de metadados).
 */
router.get('/permissions', (_req: Request, res: Response) => {
  const LEGACY_CATEGORIES = new Set(['placas', 'relatorios', 'propostas', 'contratos', 'usuarios', 'empresas']);

  const permissions = ALL_PERMISSIONS.map((permission) => {
    const category = permission.split('.')[0] ?? permission;
    return {
      permission,
      description: PERMISSION_DESCRIPTIONS[permission] ?? permission,
      category,
      isLegacy: LEGACY_CATEGORIES.has(category),
    };
  });

  return res.json({
    success: true,
    data: {
      total: permissions.length,
      permissions,
    },
  });
});

/**
 * GET /api/v1/rbac/roles
 * Lista todas as roles com suas permissões.
 * Requer: autenticação e permissão settings.manage ou usuarios.manage.
 */
router.get('/roles', (req: Request, res: Response) => {
  const ctx = req.permissionContext;

  // Apenas admin_empresa, gestor com users.manage, ou superadmin pode ver as roles completas
  const canSeeRoles =
    ctx &&
    (
      ctx.role === 'superadmin' ||
      ctx.role === 'admin_empresa' ||
      ctx.permissions.includes('users.manage') ||
      ctx.permissions.includes('settings.manage') ||
      ctx.permissions.includes('usuarios.manage')
    );

  if (!canSeeRoles) {
    return res.status(403).json({
      success: false,
      code: 'PERMISSION_DENIED',
      message: 'Acesso negado. Requer permissão settings.manage ou users.manage.',
    });
  }

  const roles = (Object.keys(ROLE_PERMISSION_MAP) as CanonicalRole[]).map((role) => ({
    role,
    description: ROLE_DESCRIPTIONS[role] ?? role,
    permissionCount: ROLE_PERMISSION_MAP[role].length,
    permissions: ROLE_PERMISSION_MAP[role],
  }));

  return res.json({
    success: true,
    data: {
      total: roles.length,
      roles,
    },
  });
});

/**
 * GET /api/v1/rbac/my-permissions
 * Retorna as permissões do usuário autenticado atual.
 * Não vaza dados de outros tenants.
 */
router.get('/my-permissions', (req: Request, res: Response) => {
  const ctx = req.permissionContext;

  if (!ctx) {
    return res.status(403).json({
      success: false,
      code: 'NO_PERMISSION_CONTEXT',
      message: 'Contexto de permissões não encontrado.',
    });
  }

  return res.json({
    success: true,
    data: {
      userId:    ctx.userId,
      empresaId: ctx.empresaId,
      role:      ctx.role,
      permissions: ctx.permissions,
    },
  });
});

/**
 * GET /api/v1/rbac/audit-log
 * Lista eventos de auditoria RBAC (padrão: permission.denied) por tenant.
 * Requer: audit.read, settings.manage, ou role admin_empresa/superadmin.
 * Nunca expõe dados cross-tenant.
 */
router.get('/audit-log', async (req: Request, res: Response, next: NextFunction) => {
  const ctx = req.permissionContext;

  const canAccess =
    ctx &&
    (
      ctx.role === 'superadmin' ||
      ctx.role === 'admin_empresa' ||
      ctx.permissions.includes('audit.read') ||
      ctx.permissions.includes('settings.manage')
    );

  if (!canAccess) {
    return res.status(403).json({
      success: false,
      code: 'PERMISSION_DENIED',
      message: 'Acesso negado. Requer permissao audit.read ou settings.manage.',
    });
  }

  try {
    const page  = Math.max(1,   Number(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));

    // eventType padrão: permission.denied — conforme o domínio da auditoria
    const action      = typeof req.query.eventType  === 'string' ? req.query.eventType  : 'permission.denied';
    const userId      = typeof req.query.userId     === 'string' ? req.query.userId     : undefined;
    const since       = typeof req.query.dateFrom   === 'string' ? req.query.dateFrom   : undefined;
    const until       = typeof req.query.dateTo     === 'string' ? req.query.dateTo     : undefined;
    const entityType  = typeof req.query.entityType === 'string' ? req.query.entityType : undefined;
    const permission  = typeof req.query.permission === 'string' ? req.query.permission : undefined;

    const isSuperadmin = ctx?.role === 'superadmin';

    const result = await defaultAuditService.find({
      empresaId:    req.tenantContext?.empresaId,
      isSuperadmin,
      action,
      actorUserId:  userId,
      entityType,
      since,
      until,
      page,
      limit,
    });

    // Filtro por permissão específica (armazenada em metadata)
    let data = result.data;
    if (permission) {
      data = data.filter((log) => {
        const meta = log.metadata as Record<string, unknown> | null | undefined;
        return (
          meta?.permission === permission ||
          meta?.requiredPermission === permission ||
          String(meta?.permission ?? '').includes(permission)
        );
      });
    }

    return res.json({
      success: true,
      data,
      pagination: {
        totalDocs:   result.total,
        totalPages:  Math.max(1, Math.ceil(result.total / result.limit)),
        currentPage: result.page,
        limit:       result.limit,
      },
      meta: {
        eventType:   action,
        tenant:      req.tenantContext?.empresaId ?? null,
        isSuperadmin,
      },
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
