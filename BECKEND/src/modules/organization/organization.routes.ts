import { Router } from 'express';
import authenticateToken from '@shared/infra/http/middlewares/auth.middleware';
import { requireTenantGuard } from '@shared/infra/http/middlewares/tenant-guard.middleware';
import { resolveTenantMiddleware } from '@shared/tenant/tenant-resolution.middleware';
import { organizationController } from './organization.controller';
import { invitationController } from './invitation/invitation.controller';

const router = Router();

// Auth → Tenant guard → Tenant resolution (org + membership)
router.use(authenticateToken);
router.use(requireTenantGuard);
router.use(resolveTenantMiddleware);

// Organization
router.get('/current', organizationController.getCurrent.bind(organizationController));

// Members
router.get('/members', organizationController.listMembers.bind(organizationController));
router.patch('/members/:memberId/role', organizationController.updateMemberRole.bind(organizationController));
router.patch('/members/:memberId/status', organizationController.updateMemberStatus.bind(organizationController));

// Invitations — accept não precisa de org resolvida (token é auto-suficiente)
router.post('/invitations', invitationController.createInvitation.bind(invitationController));
router.get('/invitations', invitationController.listInvitations.bind(invitationController));
router.post('/invitations/accept', invitationController.acceptInvitation.bind(invitationController));

export default router;
