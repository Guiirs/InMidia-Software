// src/modules/users/user.controller.ts
import { Response, NextFunction } from 'express';
import { Request } from 'express';
import UserService from './user.service';
import logger from '../../shared/container/logger';
import AppError from '../../shared/container/AppError';

export class UserController {
  constructor(private userService: UserService) {}

  /**
   * Controller para obter o perfil do utilizador autenticado.
   * GET /api/v1/user/me
   */
  async getUserProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    const user = req.user as { id: string };
    if (!user?.id) {
      throw new AppError('Utilizador não autenticado', 401);
    }

    const userId = user.id;

    logger.info(`[UserController] Utilizador ID ${userId} requisitou getUserProfile.`);

    try {
      const userProfile = await this.userService.getProfile(userId);
      logger.info(`[UserController] Perfil do utilizador ID ${userId} encontrado com sucesso.`);
      res.status(200).json(userProfile);
    } catch (error: unknown) {
      const err = error as Error;
      logger.error(`[UserController] Erro ao chamar userService.getProfile (ID: ${userId}): ${err.message}`);
      next(error);
    }
  }

  /**
   * Controller para atualizar o perfil do utilizador autenticado.
   * PUT /api/v1/user/me
   */
  async updateUserProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    const user = req.user as { id: string };
    if (!user?.id) {
      throw new AppError('Utilizador não autenticado', 401);
    }

    const userId = user.id;

    logger.info(`[UserController] Utilizador ID ${userId} requisitou updateUserProfile.`);
    logger.debug(`[UserController] Dados recebidos para update: ${JSON.stringify(req.body)}`);

    try {
      const updatedUser = await this.userService.updateProfile(userId, req.body);

      logger.info(`[UserController] Perfil do utilizador ID ${userId} atualizado com sucesso.`);
      res.status(200).json({
        message: 'Dados do utilizador atualizados com sucesso.',
        user: updatedUser
      });
    } catch (error: unknown) {
      const err = error as Error;
      logger.error(`[UserController] Erro ao chamar userService.updateProfile (ID: ${userId}): ${err.message}`);
      next(error);
    }
  }

  /**
   * Controller para obter os dados da empresa associada (apenas Admin).
   * GET /api/v1/user/me/empresa
   */
  async getEmpresaProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    const user = req.user as { empresaId: string; role: string; id: string };
    if (!user?.empresaId || !user?.role || !user?.id) {
      throw new AppError('Utilizador não autenticado', 401);
    }

    const empresaId = user.empresaId;
    const userRole = user.role;
    const userId = user.id;

    logger.info(`[UserController] Utilizador ID ${userId} requisitou getEmpresaProfile (Role: ${userRole}).`);

    try {
      const empresa = await this.userService.getEmpresaProfile(empresaId, userRole);

      logger.info(`[UserController] Perfil da empresa ID ${empresaId} encontrado com sucesso.`);
      res.status(200).json(empresa);
    } catch (error: unknown) {
      const err = error as Error;
      logger.error(`[UserController] Erro ao chamar userService.getEmpresaProfile (Empresa: ${empresaId}): ${err.message}`);
      next(error);
    }
  }

  /**
   * Controller para regenerar a API Key da empresa (apenas Admin com confirmação de senha).
   * POST /api/v1/user/me/empresa/regenerate-api-key
   */
  async regenerateEmpresaApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    const user = req.user as { id: string; empresaId: string; role: string };
    if (!user?.id || !user?.empresaId || !user?.role) {
      throw new AppError('Utilizador não autenticado', 401);
    }

    const userId = user.id;
    const empresaId = user.empresaId;
    const userRole = user.role;
    const body = (req.body || {}) as Record<string, unknown>;
    const passwordInput = body.password ?? body.senha ?? body.currentPassword ?? body.adminPassword;
    const password = typeof passwordInput === 'string' ? passwordInput : '';

    logger.info('[REGENERATE_API_KEY_ACTIVE_ROUTE] version=2026-05-26-debug-2', {
      userId,
      empresaId,
      role: userRole,
    });
    logger.info(`[UserController] Utilizador ID ${userId} requisitou regenerateEmpresaApiKey (Role: ${userRole}).`);
    logger.debug('[UserController] regenerateEmpresaApiKey payload recebido', {
      userId,
      empresaId,
      role: userRole,
      receivedFields: Object.keys(body),
      passwordField:
        body.password !== undefined ? 'password' :
        body.senha !== undefined ? 'senha' :
        body.currentPassword !== undefined ? 'currentPassword' :
        body.adminPassword !== undefined ? 'adminPassword' :
        'none',
      passwordType: typeof passwordInput,
      passwordLength: typeof password === 'string' ? password.length : 0,
    });

    try {
      const auditData = {
        ip_address: req.ip || req.connection?.remoteAddress,
        user_agent: req.get('user-agent')
      };

      const result = await this.userService.regenerateApiKey(userId, empresaId, userRole, password, auditData);

      logger.info(`[UserController] API Key regenerada com sucesso para empresa ${empresaId} por admin ${userId}.`);

      res.status(200).json({
        message: 'API Key regenerada com sucesso! Guarde-a num local seguro.',
        fullApiKey: result.fullApiKey,
        newApiKeyPrefix: result.newPrefix
      });
    } catch (error: unknown) {
      const err = error as Error;
      logger.error(`[UserController] Erro ao chamar userService.regenerateApiKey (Empresa: ${empresaId}): ${err.message}`);
      next(error);
    }
  }
}

