import { Request, Response, NextFunction } from 'express';
import { invitationService } from './invitation.service';
import { CreateInvitationSchema, AcceptInvitationSchema } from '../dtos/invitation.dto';
import AppError from '@shared/container/AppError';
import {
  requireOrganizationId,
} from '@shared/tenant/require-tenant-context';

function requireUserId(req: Request): string {
  const id = req.user?.id;
  if (!id) throw new AppError('Usuário não autenticado', 401);
  return id;
}

export class InvitationController {
  /**
   * POST /api/v1/organization/invitations
   * organizationId vem exclusivamente do req.organizationContext —
   * body.organizationId é ignorado para prevenir cross-tenant injection.
   */
  async createInvitation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = requireUserId(req);
      const orgId = requireOrganizationId(req);

      const parsed = CreateInvitationSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, message: parsed.error.issues[0]?.message ?? 'Dados inválidos' });
        return;
      }

      const result = await invitationService.createInvitation(orgId, parsed.data, userId);

      res.status(201).json({
        success: true,
        data: result.invitation,
        meta: { token: result.token },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/organization/invitations
   */
  async listInvitations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = requireUserId(req);
      const orgId = requireOrganizationId(req);

      const invitations = await invitationService.listInvitations(orgId, userId);
      res.json({ success: true, data: invitations });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/organization/invitations/accept
   * Aceita convite por token. Não requer organizationId — o token identifica a org.
   * Apenas requer que o usuário esteja autenticado.
   */
  async acceptInvitation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = requireUserId(req);

      const parsed = AcceptInvitationSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, message: parsed.error.issues[0]?.message ?? 'Dados inválidos' });
        return;
      }

      await invitationService.acceptInvitation(parsed.data.token, userId);
      res.json({ success: true, message: 'Convite aceito com sucesso' });
    } catch (error) {
      next(error);
    }
  }
}

export const invitationController = new InvitationController();
