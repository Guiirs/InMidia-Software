import { Request, Response, NextFunction } from 'express';
import { organizationService } from './organization.service';
import { membershipService } from './membership/membership.service';
import {
  UpdateMemberRoleSchema,
  UpdateMemberStatusSchema,
} from './dtos/organization.dto';
import AppError from '@shared/container/AppError';
import {
  requireOrganizationContext,
  requireOrganizationId,
} from '@shared/tenant/require-tenant-context';

function requireUserId(req: Request): string {
  const id = req.user?.id;
  if (!id) throw new AppError('Usuário não autenticado', 401);
  return id;
}

function paramStr(req: Request, key: string): string {
  const v = req.params[key];
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
}

export class OrganizationController {
  /**
   * GET /api/v1/organization/current
   * Retorna a organização do tenant atual.
   * Fonte canônica: req.organizationContext (populado pelo resolveTenantMiddleware).
   * organizationId do body/query é ignorado — prevenção de cross-tenant injection.
   */
  async getCurrent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = requireOrganizationId(req);
      const org = await organizationService.getOrganizationById(orgId);
      const ctx = requireOrganizationContext(req);
      res.json({
        success: true,
        data: org,
        meta: {
          isLegacyFallback: ctx.isLegacyFallback,
          membershipId: ctx.membershipId,
          role: ctx.role,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/organization/members
   */
  async listMembers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = requireOrganizationId(req);
      const members = await membershipService.listMembers(orgId);
      res.json({ success: true, data: members });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/organization/members/:memberId/role
   */
  async updateMemberRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = requireUserId(req);
      const orgId = requireOrganizationId(req);
      const parsed = UpdateMemberRoleSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, message: parsed.error.issues[0]?.message ?? 'Dados inválidos' });
        return;
      }
      const updated = await membershipService.updateMemberRole(
        paramStr(req, 'memberId'),
        orgId,
        parsed.data.role,
        userId
      );
      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/organization/members/:memberId/status
   */
  async updateMemberStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = requireUserId(req);
      const orgId = requireOrganizationId(req);
      const parsed = UpdateMemberStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, message: parsed.error.issues[0]?.message ?? 'Dados inválidos' });
        return;
      }
      const updated = await membershipService.updateMemberStatus(
        paramStr(req, 'memberId'),
        orgId,
        parsed.data.status,
        userId
      );
      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }
}

export const organizationController = new OrganizationController();
