/**
 * Admin Controller
 * Endpoints administrativos
 */
// src/modules/admin/admin.controller.ts
import { Response, NextFunction } from 'express';
import { IAuthRequest } from '../../types/express';
import AdminService from './admin.service';
import logger from '../../shared/container/logger';
import { defaultAuditService } from '@modules/audit/audit.service';
import { auditRequestContext } from '@modules/audit/audit.helpers';

// Instancia o serviço fora das funções do controller para reutilização
const adminService = new AdminService();

/**
 * Controller para criar um novo utilizador (apenas Admin).
 */
export async function createUser(req: IAuthRequest, res: Response, next: NextFunction): Promise<void> {
    const empresaId = (req.user as any).empresaId;
    const adminUserId = (req.user as any).id;

    logger.info(`[AdminController] Admin ${adminUserId} requisitou createUser para empresa ${empresaId}.`);
    logger.debug(`[AdminController] Dados recebidos para createUser (parcial): { username: ${(req as any).body.username}, email: ${(req as any).body.email}, role: ${(req as any).body.role} }`);

    try {
        const createdUser = await adminService.createUser((req as any).body, empresaId);

        logger.info(`[AdminController] Utilizador ${createdUser.username} (ID: ${createdUser.id}) criado com sucesso por admin ${adminUserId}.`);
        void defaultAuditService.recordEntityCreated({
            ...auditRequestContext(req as any),
            module: 'admin',
            entityType: 'user',
            entityId: String(createdUser.id || createdUser._id),
            entityLabel: createdUser.username || createdUser.email,
            after: createdUser,
        });
        res.status(201).json(createdUser);
    } catch (err: any) {
        logger.error(`[AdminController] Erro ao chamar adminService.createUser: ${err.message}`, { status: err.status, stack: err.stack });
        next(err);
    }
}

/**
 * Controller para obter todos os utilizadores da empresa (apenas Admin).
 */
export async function getAllUsers(req: IAuthRequest, res: Response, next: NextFunction): Promise<void> {
    const empresaId = (req.user as any).empresaId;
    const adminUserId = (req.user as any).id;

    logger.info(`[AdminController] Admin ${adminUserId} requisitou getAllUsers para empresa ${empresaId}.`);

    try {
        const users = await adminService.getAllUsers(empresaId);
        logger.info(`[AdminController] getAllUsers retornou ${users.length} utilizadores para empresa ${empresaId}.`);
        res.status(200).json(users);
    } catch (err: any) {
        logger.error(`[AdminController] Erro ao chamar adminService.getAllUsers: ${err.message}`, { status: err.status, stack: err.stack });
        next(err);
    }
}

/**
 * Controller para atualizar a role de um utilizador (apenas Admin).
 */
export async function updateUserRole(req: IAuthRequest, res: Response, next: NextFunction): Promise<void> {
    const empresaId = (req.user as any).empresaId;
    const adminUserId = (req.user as any).id;
    const { id: userIdToUpdate } = (req as any).params;
    const { role: newRole } = (req as any).body;

    logger.info(`[AdminController] Admin ${adminUserId} requisitou updateUserRole para utilizador ${userIdToUpdate} na empresa ${empresaId}. Nova role: ${newRole}`);

    try {
        const result = await adminService.updateUserRole(userIdToUpdate, newRole, empresaId);
        logger.info(`[AdminController] updateUserRole para utilizador ${userIdToUpdate} concluído com sucesso.`);
        void defaultAuditService.recordEntityUpdated({
            ...auditRequestContext(req as any),
            module: 'admin',
            entityType: 'user',
            entityId: String(userIdToUpdate),
            after: { role: newRole },
            metadata: { action: 'role_update' },
        });
        res.status(200).json(result);
    } catch (err: any) {
        logger.error(`[AdminController] Erro ao chamar adminService.updateUserRole: ${err.message}`, { status: err.status, stack: err.stack });
        next(err);
    }
}

/**
 * Controller para apagar um utilizador (apenas Admin).
 */
export async function deleteUser(req: IAuthRequest, res: Response, next: NextFunction): Promise<void> {
    const adminUserId = (req.user as any).id;
    const empresaId = (req.user as any).empresaId;
    const { id: userIdToDelete } = (req as any).params;

    logger.info(`[AdminController] Admin ${adminUserId} requisitou deleteUser para utilizador ${userIdToDelete} na empresa ${empresaId}.`);

    try {
        await adminService.deleteUser(userIdToDelete, adminUserId, empresaId);
        logger.info(`[AdminController] deleteUser para utilizador ${userIdToDelete} concluído com sucesso.`);
        void defaultAuditService.recordEntityDeleted({
            ...auditRequestContext(req as any),
            module: 'admin',
            entityType: 'user',
            entityId: String(userIdToDelete),
        });
        res.status(204).send();
    } catch (err: any) {
        logger.error(`[AdminController] Erro ao chamar adminService.deleteUser: ${err.message}`, { status: err.status, stack: err.stack });
        next(err);
    }
}

export default {
    createUser,
    getAllUsers,
    updateUserRole,
    deleteUser
};

