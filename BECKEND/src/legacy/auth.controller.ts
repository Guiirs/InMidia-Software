// @ts-nocheck — arquivo legado, não usado pelas rotas ativas. Erros TS pré-existentes.
// src/controllers/auth.controller.ts
import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import AuthService from './auth.service';
import logger from '@shared/container/logger';
import AppError from '@shared/container/AppError';

export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * Controller para login do utilizador.
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    logger.info(`[AuthController] Recebida requisição POST /auth/login.`);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array({ onlyFirstError: true })[0]?.msg || 'Validation error';
      logger.warn(`[AuthController] Login falhou: Erro de validação: ${firstError}`);
      throw new AppError(firstError, 400);
    }

    const { email, password } = req.body;
    logger.debug(`[AuthController] Tentativa de login para email: ${email}`);

    try {
      const result = await this.authService.login(email, password);

      logger.info(`[AuthController] Login bem-sucedido para email: ${email}. Enviando resposta.`);
      res.status(200).json(result);
    } catch (error: unknown) {
      const err = error as Error;
      logger.error(`[AuthController] Erro durante o login para email ${email}: ${err.message}`, { stack: (err as any).stack });
      next(error);
    }
  }

  /**
   * Controller para solicitar a redefinição de senha.
   */
  async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    logger.info(`[AuthController] Recebida requisição POST /auth/forgot-password.`);
    const { email } = req.body;
    if (!email) {
      logger.warn(`[AuthController] Pedido de redefinição falhou: Email em falta no corpo da requisição.`);
      throw new AppError('Email é obrigatório.', 400);
    }
    logger.debug(`[AuthController] Pedido de redefinição de senha para email: ${email}`);

    try {
      await this.authService.requestPasswordReset(email);

      logger.info(`[AuthController] Processamento de forgotPassword concluído para email: ${email}. Enviando resposta genérica.`);
      res.status(200).json({ message: 'Se o email estiver registado, receberá instruções para redefinir a senha.' });
    } catch (error: unknown) {
      const err = error as Error;
      logger.error(`[AuthController] Erro ao chamar authService.requestPasswordReset para email ${email}: ${err.message}`, { stack: (err as any).stack });
      next(error);
    }
  }

  /**
   * Controller para redefinir a senha usando um token.
   */
  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { token } = req.params;
    const { newPassword } = req.body;

    logger.info(`[AuthController] Recebida requisição POST /auth/reset-password/${token ? 'com_token' : 'sem_token'}.`);

    if (!token) {
      logger.warn(`[AuthController] Redefinição de senha falhou: Token em falta na URL.`);
      throw new AppError('Token de redefinição em falta.', 400);
    }
    if (!newPassword || newPassword.length < 6) {
      logger.warn(`[AuthController] Redefinição de senha falhou: Nova senha em falta ou muito curta.`);
      throw new AppError('A nova senha deve ter pelo menos 6 caracteres.', 400);
    }

    try {
      await this.authService.resetPasswordWithToken(token, newPassword);

      logger.info(`[AuthController] Senha redefinida com sucesso usando token (hash omitido).`);
      res.status(200).json({ message: 'Senha redefinida com sucesso.' });
    } catch (error: unknown) {
      const err = error as Error;
      logger.error(`[AuthController] Erro ao chamar authService.resetPasswordWithToken: ${err.message}`, { stack: (err as any).stack });
      next(error);
    }
  }

  /**
   * Controller para verificar se um token de redefinição de senha é válido.
   */
  async verifyResetToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { token } = req.params;
    logger.info(`[AuthController] Recebida requisição GET /auth/verify-token/${token ? 'com_token' : 'sem_token'}.`);

    if (!token) {
      logger.warn(`[AuthController] Verificação de token falhou: Token em falta na URL.`);
      throw new AppError('Token de verificação em falta.', 400);
    }

    try {
      await this.authService.verifyPasswordResetToken(token);

      logger.info(`[AuthController] Token de redefinição verificado como válido (hash omitido).`);
      res.status(200).json({ message: 'Token válido.' });
    } catch (error: unknown) {
      const err = error as Error;
      logger.error(`[AuthController] Erro ao chamar authService.verifyPasswordResetToken: ${err.message}`, { stack: (err as any).stack });
      next(error);
    }
  }
}

