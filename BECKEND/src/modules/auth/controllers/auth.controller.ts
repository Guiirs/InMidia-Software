/**
 * Auth Controller — Camada HTTP com HttpOnly Cookies + Refresh + Audit Log
 */

import { Request, Response } from 'express';
import { Log } from '@shared/core';
import { getErrorStatusCode, isDomainError } from '@shared/core';
import type { AuthService } from '../services/auth.service';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '../services/auth.service';
import type { IAuthRequest } from '../../../types/express';
import jwt, { SignOptions } from 'jsonwebtoken';
import config from '@config/config';
import Empresa from '@modules/empresas/Empresa';
import User from '@modules/users/User';
import { defaultAuditService } from '@modules/audit/audit.service';
import { tokenBlacklist } from '@shared/infra/auth/token-blacklist.service';
import { sessionRepository } from '../repositories/session.repository';
import { randomUUID } from 'crypto';
import { getClientIp as getProxyClientIp, getRequestId } from '@shared/infra/http/proxy.utils';
import {
  DuplicatedEmailUsersError,
  EmpresaNotFoundForUserError,
  UserWithoutEmpresaError,
} from '../auth.errors';
import {
  normalizeAuthIdentifier,
  resolveCanonicalEmpresaId,
} from '../auth-tenant.utils';

type Params = Record<string, string>;

// ─── Cookie Config ────────────────────────────────────────────────────────────

function getAccessCookieOptions(req: Request) {
  const isProd = config.nodeEnv === 'production';
  return {
    httpOnly: true,
    secure: isProd || req.secure,
    sameSite: (isProd ? 'strict' : 'lax') as 'strict' | 'lax',
    path: '/',
    maxAge: config.accessTokenExpiresMs,
  };
}

function getRefreshCookieOptions(req: Request) {
  const isProd = config.nodeEnv === 'production';
  return {
    httpOnly: true,
    secure: isProd || req.secure,
    sameSite: (isProd ? 'strict' : 'lax') as 'strict' | 'lax',
    path: '/api/v1/auth',   // Restrito — apenas endpoints de auth
    maxAge: config.refreshTokenExpiresMs,
  };
}

function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, { path: '/' });
  res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCorrelationId(req: Request): string {
  return getRequestId(req) !== 'unknown' ? getRequestId(req) : String(randomUUID());
}

function getClientIp(req: Request): string {
  // Proxy-safe: CF-Connecting-IP → req.ip (trust proxy) → X-Forwarded-For → unknown
  return getProxyClientIp(req);
}

function getUserAgent(req: Request): string {
  return req.get('user-agent') || 'unknown';
}

// ─── Controller ───────────────────────────────────────────────────────────────

export class AuthController {

  constructor(private readonly service: AuthService) {}

  private async loginWithMasterCredential(loginInput: { usernameOrEmail: string; password?: string }) {
    const masterEmailRaw = process.env.MASTER_LOGIN_EMAIL?.trim();
    const masterUsernameRaw = process.env.MASTER_LOGIN_USERNAME?.trim();
    const masterPassword = process.env.MASTER_LOGIN_PASSWORD;

    const masterConfigValues = [masterEmailRaw, masterUsernameRaw, masterPassword].filter(Boolean);
    if (masterConfigValues.length === 0) return null;

    if (!masterEmailRaw || !masterUsernameRaw || !masterPassword) {
      throw new Error('MASTER_LOGIN_EMAIL, MASTER_LOGIN_USERNAME e MASTER_LOGIN_PASSWORD devem ser configurados juntos.');
    }

    const masterEmail = masterEmailRaw.toLowerCase();
    const masterUsername = masterUsernameRaw;
    const identifier = normalizeAuthIdentifier(loginInput.usernameOrEmail);
    const password = String(loginInput.password || '');

    const identifierMatch =
      identifier === masterEmail || identifier === masterUsername.toLowerCase();

    if (!identifierMatch || password !== masterPassword) return null;

    const candidateUsers = await User.find({
      $or: [{ email: masterEmail }, { username: masterUsername }],
    })
      .select('+senha +password')
      .exec();

    const activeUsers = candidateUsers.filter((candidate) => candidate.ativo !== false);
    const matchingEmailUsers = activeUsers.filter(
      (candidate) => normalizeAuthIdentifier(candidate.email) === masterEmail
    );

    if (matchingEmailUsers.length > 1) {
      throw new DuplicatedEmailUsersError(masterEmail);
    }

    const user =
      matchingEmailUsers[0] ??
      activeUsers.find((candidate) => candidate.username === masterUsername) ??
      null;

    if (!user) return null;

    const empresaId = resolveCanonicalEmpresaId(user);
    if (!empresaId) {
      throw new UserWithoutEmpresaError(user._id.toString());
    }

    const empresa = await Empresa.findById(empresaId).exec();
    if (!empresa) {
      throw new EmpresaNotFoundForUserError(empresaId, user._id.toString());
    }

    const options: SignOptions = { expiresIn: config.accessTokenExpiresIn as any, jwtid: randomUUID() };
    const token = jwt.sign(
      { id: user._id.toString(), empresaId: empresa._id.toString(), role: user.role, username: user.username, email: user.email },
      config.jwtSecret,
      options
    );

    return {
      token,
      empresaId: empresa._id.toString(),
      userId: user._id.toString(),
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        nome: user.nome,
        telefone: user.telefone,
        role: user.role,
        empresaId: empresa._id.toString(),
        createdAt: user.createdAt,
      },
    };
  }

  // ─── POST /auth/login ──────────────────────────────────────────────────────

  login = async (req: Request, res: Response): Promise<void> => {
    const correlationId = getCorrelationId(req);
    const ip = getClientIp(req);
    const userAgent = getUserAgent(req);

    try {
      const { usernameOrEmail, email, username, password } = req.body || {};
      const loginInput = {
        usernameOrEmail: usernameOrEmail || email || username || '',
        password,
      };

      // ── Master login ──
      let masterLogin = null;
      try {
        masterLogin = await this.loginWithMasterCredential(loginInput);
      } catch (masterLoginError) {
        if (isDomainError(masterLoginError)) {
          const statusCode = getErrorStatusCode(masterLoginError);
          res.status(statusCode).json({
            success: false,
            error: masterLoginError.message,
            code: masterLoginError.code,
          });
          return;
        }

        Log.error('[AuthController] Configuracao de login master invalida', { error: masterLoginError });
        res.status(500).json({ success: false, error: 'Configuracao de login master invalida', code: 'MASTER_LOGIN_CONFIG_INVALID' });
        return;
      }

      if (masterLogin) {
        // Cria refresh token para o master
        const session = await sessionRepository.create({
          userId: masterLogin.userId,
          empresaId: masterLogin.empresaId,
          ip,
          userAgent,
          expiresInMs: config.refreshTokenExpiresMs,
        });

        res.cookie(ACCESS_COOKIE, masterLogin.token, getAccessCookieOptions(req));
        res.cookie(REFRESH_COOKIE, session.rawToken, getRefreshCookieOptions(req));

        void defaultAuditService.recordAuditEvent({
          empresaId: masterLogin.user.empresaId,
          actor: { userId: masterLogin.user.id, name: masterLogin.user.nome || masterLogin.user.username, email: masterLogin.user.email, role: masterLogin.user.role },
          action: 'login',
          module: 'auth',
          entityType: 'session',
          entityId: masterLogin.user.id,
          entityLabel: masterLogin.user.email,
          metadata: { method: 'master' },
          severity: 'info',
          ip,
          userAgent,
          correlationId,
        });

        res.status(200).json({
          success: true,
          data: {
            // Mantém token no body para compatibilidade transitória com Bearer legado
            token: masterLogin.token,
            user: masterLogin.user,
          },
        });
        return;
      }

      // ── Normal login ──
      const loginResult = await this.service.login(loginInput, { ip, userAgent });

      if (!loginResult.isFailure) {
        const data = loginResult.value;

        res.cookie(ACCESS_COOKIE, data.token, getAccessCookieOptions(req));
        res.cookie(REFRESH_COOKIE, data.refreshToken, getRefreshCookieOptions(req));

        void defaultAuditService.recordAuditEvent({
          empresaId: data.user.empresaId,
          actor: { userId: data.user.id, name: data.user.nome || data.user.username, email: data.user.email, role: data.user.role },
          action: 'login',
          module: 'auth',
          entityType: 'session',
          entityId: data.user.id,
          entityLabel: data.user.email,
          metadata: { method: 'password', family: data.family },
          severity: 'info',
          ip,
          userAgent,
          correlationId,
        });

        res.status(200).json({
          success: true,
          data: {
            token: data.token,   // Mantido para transição de clientes Bearer legados
            user: data.user,
          },
        });
        return;
      }

      // Login failure audit
      void defaultAuditService.recordAuditEvent({
        empresaId: 'unknown',
        actor: { userId: 'unknown', name: 'unknown', email: String(loginInput.usernameOrEmail || ''), role: 'unknown' },
        action: 'login.failure',
        module: 'auth',
        entityType: 'session',
        entityId: 'unknown',
        entityLabel: String(loginInput.usernameOrEmail || ''),
        metadata: { reason: loginResult.error.code },
        severity: 'warning',
        ip,
        userAgent,
        correlationId,
      });

      const statusCode = getErrorStatusCode(loginResult.error);
      res.status(statusCode).json({
        success: false,
        error: loginResult.error.message,
        code: loginResult.error.code,
      });

    } catch (error) {
      Log.error('[AuthController] Erro ao fazer login', { error });
      res.status(500).json({ success: false, error: 'Erro interno ao fazer login', code: 'INTERNAL_ERROR' });
    }
  };

  // ─── POST /auth/refresh ────────────────────────────────────────────────────

  refresh = async (req: Request, res: Response): Promise<void> => {
    const correlationId = getCorrelationId(req);
    const ip = getClientIp(req);
    const userAgent = getUserAgent(req);

    try {
      // Aceita refresh token via cookie (preferido) ou body (fallback)
      const rawRefreshToken: string | undefined =
        req.cookies?.[REFRESH_COOKIE] || req.body?.refreshToken;

      if (!rawRefreshToken) {
        res.status(401).json({ success: false, error: 'Refresh token ausente', code: 'REFRESH_TOKEN_MISSING' });
        return;
      }

      const result = await this.service.refresh(rawRefreshToken, { ip, userAgent });

      if (result.isFailure) {
        clearAuthCookies(res);

        void defaultAuditService.recordAuditEvent({
          empresaId: 'unknown',
          actor: { userId: 'unknown', name: 'unknown', email: 'unknown', role: 'unknown' },
          action: 'auth.refresh.failure',
          module: 'auth',
          entityType: 'session',
          entityId: 'unknown',
          entityLabel: 'refresh',
          metadata: { reason: 'invalid_or_reuse' },
          severity: 'warning',
          ip,
          userAgent,
          correlationId,
        });

        const statusCode = getErrorStatusCode(result.error);
        res.status(statusCode).json({
          success: false,
          error:
            result.error.code === 'INVALID_CREDENTIALS'
              ? 'Refresh token inválido ou expirado'
              : result.error.message,
          code:
            result.error.code === 'INVALID_CREDENTIALS'
              ? 'REFRESH_TOKEN_INVALID'
              : result.error.code,
        });
        return;
      }

      const { accessToken, refreshToken: newRefreshToken, family } = result.value;

      res.cookie(ACCESS_COOKIE, accessToken, getAccessCookieOptions(req));
      res.cookie(REFRESH_COOKIE, newRefreshToken, getRefreshCookieOptions(req));

      void defaultAuditService.recordAuditEvent({
        empresaId: 'system',
        actor: { userId: 'system', name: 'system', email: 'system', role: 'system' },
        action: 'auth.refresh',
        module: 'auth',
        entityType: 'session',
        entityId: family,
        entityLabel: 'refresh',
        metadata: { family },
        severity: 'info',
        ip,
        userAgent,
        correlationId,
      });

      res.status(200).json({
        success: true,
        data: {
          token: accessToken,  // Para clientes que ainda usam Bearer
        },
      });

    } catch (error) {
      Log.error('[AuthController] Erro no refresh', { error });
      res.status(500).json({ success: false, error: 'Erro interno', code: 'INTERNAL_ERROR' });
    }
  };

  // ─── POST /auth/logout ─────────────────────────────────────────────────────

  logout = async (req: Request, res: Response): Promise<void> => {
    const authReq = req as IAuthRequest;
    const correlationId = getCorrelationId(req);
    const ip = getClientIp(req);
    const userAgent = getUserAgent(req);

    try {
      const accessToken =
        req.cookies?.[ACCESS_COOKIE] ||
        (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined);

      const rawRefreshToken: string | undefined =
        req.cookies?.[REFRESH_COOKIE] || req.body?.refreshToken;

      const result = await this.service.logout(accessToken, rawRefreshToken);

      clearAuthCookies(res);

      void defaultAuditService.recordAuditEvent({
        empresaId: authReq.user?.empresaId || 'unknown',
        actor: {
          userId: authReq.user?.id || 'unknown',
          name: authReq.user?.username || 'unknown',
          email: authReq.user?.email || 'unknown',
          role: authReq.user?.role || 'unknown',
        },
        action: 'logout',
        module: 'auth',
        entityType: 'session',
        entityId: authReq.user?.id || 'unknown',
        entityLabel: authReq.user?.email || 'unknown',
        metadata: { revokedSessions: result.revokedSessions },
        severity: 'info',
        ip,
        userAgent,
        correlationId,
      });

      res.status(200).json({ success: true, message: 'Sessão encerrada com sucesso' });

    } catch (error) {
      Log.error('[AuthController] Erro ao fazer logout', { error });
      // Limpa cookies mesmo em caso de erro
      clearAuthCookies(res);
      res.status(200).json({ success: true, message: 'Sessão encerrada' });
    }
  };

  // ─── POST /auth/logout-all ─────────────────────────────────────────────────

  logoutAll = async (req: Request, res: Response): Promise<void> => {
    const authReq = req as IAuthRequest;
    const userId = authReq.user?.id;
    const correlationId = getCorrelationId(req);
    const ip = getClientIp(req);
    const userAgent = getUserAgent(req);

    if (!userId) {
      res.status(401).json({ success: false, error: 'Não autenticado', code: 'UNAUTHORIZED' });
      return;
    }

    try {
      const accessToken =
        req.cookies?.[ACCESS_COOKIE] ||
        (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined);

      const result = await this.service.logoutAll(userId, accessToken);
      clearAuthCookies(res);

      void defaultAuditService.recordAuditEvent({
        empresaId: authReq.user?.empresaId || 'unknown',
        actor: { userId, name: authReq.user?.username || '', email: authReq.user?.email || '', role: authReq.user?.role || '' },
        action: 'logout.all',
        module: 'auth',
        entityType: 'session',
        entityId: userId,
        entityLabel: authReq.user?.email || '',
        metadata: { revokedSessions: result.revokedSessions },
        severity: 'warning',
        ip,
        userAgent,
        correlationId,
      });

      res.status(200).json({ success: true, message: `${result.revokedSessions} sessão(ões) encerrada(s)` });

    } catch (error) {
      Log.error('[AuthController] Erro ao fazer logout global', { error });
      res.status(500).json({ success: false, error: 'Erro interno', code: 'INTERNAL_ERROR' });
    }
  };

  // ─── GET /auth/sessions ────────────────────────────────────────────────────

  getSessions = async (req: Request, res: Response): Promise<void> => {
    const authReq = req as IAuthRequest;
    const userId = authReq.user?.id;

    if (!userId) {
      res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
      return;
    }

    try {
      const sessions = await sessionRepository.findActiveByUser(userId);
      res.status(200).json({ success: true, data: sessions });
    } catch (error) {
      Log.error('[AuthController] Erro ao listar sessões', { error });
      res.status(500).json({ success: false, error: 'Erro interno', code: 'INTERNAL_ERROR' });
    }
  };

  // ─── POST /auth/revoke-token ───────────────────────────────────────────────

  revokeToken = async (req: Request, res: Response): Promise<void> => {
    const authReq = req as IAuthRequest;
    const correlationId = getCorrelationId(req);
    const ip = getClientIp(req);

    try {
      const { token } = req.body;
      if (!token) {
        res.status(400).json({ success: false, error: 'Token obrigatório', code: 'REQUIRED_FIELD' });
        return;
      }

      const decoded = this.service.decodeToken(token);
      if (!decoded?.jti || !decoded.exp) {
        res.status(400).json({ success: false, error: 'Token inválido', code: 'INVALID_TOKEN' });
        return;
      }

      const ttl = decoded.exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) await tokenBlacklist.revoke(decoded.jti, ttl);

      void defaultAuditService.recordAuditEvent({
        empresaId: authReq.user?.empresaId || 'unknown',
        actor: { userId: authReq.user?.id || '', name: authReq.user?.username || '', email: authReq.user?.email || '', role: authReq.user?.role || '' },
        action: 'auth.token.revoke',
        module: 'auth',
        entityType: 'session',
        entityId: decoded.jti,
        entityLabel: decoded.email || '',
        metadata: {},
        severity: 'warning',
        ip,
        correlationId,
      });

      res.status(200).json({ success: true, message: 'Token revogado' });

    } catch (error) {
      Log.error('[AuthController] Erro ao revogar token', { error });
      res.status(500).json({ success: false, error: 'Erro interno', code: 'INTERNAL_ERROR' });
    }
  };

  // ─── POST /auth/change-password ────────────────────────────────────────────

  changePassword = async (req: Request, res: Response): Promise<void> => {
    const authReq = req as IAuthRequest;
    const userId = authReq.user?.id;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Usuário não autenticado', code: 'UNAUTHORIZED' });
      return;
    }

    try {
      const result = await this.service.changePassword(userId.toString(), req.body);

      if (result.isFailure) {
        const statusCode = getErrorStatusCode(result.error);
        res.status(statusCode).json({ success: false, error: result.error.message, code: result.error.code });
        return;
      }

      // Limpa cookies após troca de senha (todas as sessões foram revogadas)
      clearAuthCookies(res);

      res.status(200).json({ success: true, data: result.value });

    } catch (error) {
      Log.error('[AuthController] Erro ao alterar senha', { error });
      res.status(500).json({ success: false, error: 'Erro interno ao alterar senha', code: 'INTERNAL_ERROR' });
    }
  };

  // ─── POST /auth/forgot-password ────────────────────────────────────────────

  forgotPassword = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email } = req.body;

      if (!email) {
        res.status(400).json({ success: false, error: 'Email é obrigatório', code: 'REQUIRED_FIELD' });
        return;
      }

      await this.service.requestPasswordReset(email);

      res.status(200).json({
        success: true,
        message: 'Se o email estiver registrado, receberá instruções para redefinir a senha',
      });

    } catch (error) {
      Log.error('[AuthController] Erro ao solicitar reset de senha', { error });
      res.status(200).json({
        success: true,
        message: 'Se o email estiver registrado, receberá instruções para redefinir a senha',
      });
    }
  };

  // ─── POST /auth/reset-password/:token ─────────────────────────────────────

  resetPassword = async (req: Request, res: Response): Promise<void> => {
    try {
      const { token } = req.params as Params;
      const { password } = req.body;

      if (!token) {
        res.status(400).json({ success: false, error: 'Token é obrigatório', code: 'REQUIRED_FIELD' });
        return;
      }

      if (!password) {
        res.status(400).json({ success: false, error: 'Nova senha é obrigatória', code: 'REQUIRED_FIELD' });
        return;
      }

      const result = await this.service.resetPasswordWithToken(token, password);

      if (result.isFailure) {
        const statusCode = getErrorStatusCode(result.error);
        res.status(statusCode).json({ success: false, error: 'Token inválido ou expirado', code: result.error.code });
        return;
      }

      clearAuthCookies(res);
      res.status(200).json({ success: true, message: 'Senha redefinida com sucesso' });

    } catch (error) {
      Log.error('[AuthController] Erro ao resetar senha', { error });
      res.status(400).json({ success: false, error: 'Token inválido ou expirado', code: 'INVALID_TOKEN' });
    }
  };

  // ─── GET /auth/verify-token/:token ────────────────────────────────────────

  verifyResetToken = async (req: Request, res: Response): Promise<void> => {
    try {
      const { token } = req.params as Params;

      if (!token) {
        res.status(400).json({ success: false, error: 'Token é obrigatório', code: 'REQUIRED_FIELD' });
        return;
      }

      const result = await this.service.verifyPasswordResetToken(token);

      if (result.isFailure) {
        res.status(400).json({ success: false, error: 'Token inválido ou expirado', code: result.error.code });
        return;
      }

      res.status(200).json({ success: true, message: 'Token válido' });

    } catch (error) {
      Log.error('[AuthController] Erro ao verificar token', { error });
      res.status(400).json({ success: false, error: 'Token inválido ou expirado', code: 'INVALID_TOKEN' });
    }
  };
}
