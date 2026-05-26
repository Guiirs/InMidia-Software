/**
 * Auth Service — Lógica de negócio com JWT + Refresh Token + Session Management
 */

import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { randomUUID } from 'crypto';
import { Result, InvalidCredentialsError, NotFoundError, BusinessRuleViolationError } from '@shared/core';
import config from '@config/config';
import { tokenBlacklist } from '@shared/infra/auth/token-blacklist.service';
import { sessionRepository } from '../repositories/session.repository';
import { verifyUserPassword } from '../utils/verify-user-password';
import type { IAuthRepository } from '../repositories/auth.repository';
import type {
  LoginInput,
  ChangePasswordInput,
  LoginResponse,
  ChangePasswordResponse,
  JwtPayload,
} from '../dtos/auth.dto';

const ACCESS_COOKIE = 'inmidia_access';
const REFRESH_COOKIE = 'inmidia_refresh';

export { ACCESS_COOKIE, REFRESH_COOKIE };

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
  family: string;
  expiresAt: Date;
}

export interface LogoutResult {
  revokedSessions: number;
}

export class AuthService {
  constructor(private readonly repository: IAuthRepository) {}

  // ─── Token Generators ────────────────────────────────────────────────────────

  generateAccessToken(payload: JwtPayload): string {
    const options: SignOptions = {
      expiresIn: config.accessTokenExpiresIn as any,
      jwtid: randomUUID(), // jti para blacklist granular
    };
    return jwt.sign(payload, config.jwtSecret, options);
  }

  /** Decodifica sem verificar (apenas para leitura do jti ao revogar expirados) */
  decodeToken(token: string): (JwtPayload & { jti?: string; exp?: number }) | null {
    try {
      return jwt.decode(token) as (JwtPayload & { jti?: string; exp?: number }) | null;
    } catch {
      return null;
    }
  }

  // ─── Login ───────────────────────────────────────────────────────────────────

  async login(
    input: LoginInput,
    meta: { ip: string; userAgent: string }
  ): Promise<Result<LoginResponse & { refreshToken: string; refreshExpiresAt: Date; family: string }, InvalidCredentialsError | NotFoundError>> {
    try {
      const userResult = await this.repository.findByUsernameOrEmail(input.usernameOrEmail);

      if (userResult.isFailure || !userResult.value) {
        return Result.fail(new InvalidCredentialsError());
      }

      const user = userResult.value;

      const passwordVerification = await verifyUserPassword(user, input.password);
      if (!passwordVerification.isMatch) {
        return Result.fail(new InvalidCredentialsError());
      }

      const empresaId = ((user as any).empresa || (user as any).empresaId).toString();

      const payload: JwtPayload = {
        id: user._id.toString(),
        empresaId,
        role: user.role,
        username: user.username,
        email: user.email,
      };

      const accessToken = this.generateAccessToken(payload);

      // Cria refresh token (nova família = novo login)
      const session = await sessionRepository.create({
        userId: user._id.toString(),
        empresaId,
        ip: meta.ip,
        userAgent: meta.userAgent,
        expiresInMs: config.refreshTokenExpiresMs,
      });

      return Result.ok({
        token: accessToken,         // compatibilidade Bearer legado
        refreshToken: session.rawToken,
        refreshExpiresAt: session.expiresAt,
        family: session.family,
        user: {
          id: user._id.toString(),
          username: user.username,
          email: user.email,
          nome: user.nome,
          telefone: user.telefone,
          role: user.role,
          empresaId,
          createdAt: user.createdAt,
        },
      });
    } catch {
      return Result.fail(new InvalidCredentialsError());
    }
  }

  // ─── Refresh Flow (com rotação + detecção de reuse) ──────────────────────────

  async refresh(
    rawRefreshToken: string,
    meta: { ip: string; userAgent: string }
  ): Promise<Result<RefreshResult, InvalidCredentialsError>> {
    try {
      const session = await sessionRepository.findValidByRawToken(rawRefreshToken);

      if (!session) {
        return Result.fail(new InvalidCredentialsError());
      }

      // Detecta reuse attack: refresh já foi revogado (mas encontrou por outro meio)
      if (session.revokedAt) {
        // Revoga família inteira — possível roubo de token
        await sessionRepository.revokeFamilyAll(session.family);
        await tokenBlacklist.revokeFamily(session.family);
        return Result.fail(new InvalidCredentialsError());
      }

      // Verifica expiração
      if (session.expiresAt < new Date()) {
        await sessionRepository.revokeByRawToken(rawRefreshToken);
        return Result.fail(new InvalidCredentialsError());
      }

      // Verifica família revogada no blacklist (reuse attack detectado antes)
      const familyRevoked = await tokenBlacklist.isFamilyRevoked(session.family);
      if (familyRevoked) {
        return Result.fail(new InvalidCredentialsError());
      }

      // Busca dados do usuário para gerar novo access token
      const userResult = await this.repository.findByIdWithPassword(session.userId.toString());
      if (userResult.isFailure || !userResult.value) {
        return Result.fail(new InvalidCredentialsError());
      }

      const user = userResult.value;
      const empresaId = session.empresaId.toString();

      const payload: JwtPayload = {
        id: user._id.toString(),
        empresaId,
        role: user.role,
        username: user.username,
        email: user.email,
      };

      const newAccessToken = this.generateAccessToken(payload);

      // Rotação: invalida refresh antigo, cria novo na mesma família
      await sessionRepository.revokeByRawToken(rawRefreshToken);

      const newSession = await sessionRepository.create({
        userId: user._id.toString(),
        empresaId,
        ip: meta.ip,
        userAgent: meta.userAgent,
        expiresInMs: config.refreshTokenExpiresMs,
        family: session.family, // mantém mesma família para rastreamento
      });

      return Result.ok({
        accessToken: newAccessToken,
        refreshToken: newSession.rawToken,
        family: newSession.family,
        expiresAt: newSession.expiresAt,
      });
    } catch {
      return Result.fail(new InvalidCredentialsError());
    }
  }

  // ─── Logout ──────────────────────────────────────────────────────────────────

  async logout(
    accessToken: string | undefined,
    rawRefreshToken: string | undefined
  ): Promise<LogoutResult> {
    let revokedSessions = 0;

    // Revoga access token no blacklist
    if (accessToken) {
      const decoded = this.decodeToken(accessToken);
      if (decoded?.jti && decoded.exp) {
        const ttlSeconds = decoded.exp - Math.floor(Date.now() / 1000);
        if (ttlSeconds > 0) {
          await tokenBlacklist.revoke(decoded.jti, ttlSeconds);
        }
      }
    }

    // Revoga refresh token e sua sessão
    if (rawRefreshToken) {
      const session = await sessionRepository.findValidByRawToken(rawRefreshToken);
      if (session && !session.revokedAt) {
        await sessionRepository.revokeByRawToken(rawRefreshToken);
        revokedSessions = 1;
      }
    }

    return { revokedSessions };
  }

  /** Logout global: revoga TODAS as sessões do usuário */
  async logoutAll(userId: string, currentAccessToken?: string): Promise<LogoutResult> {
    if (currentAccessToken) {
      const decoded = this.decodeToken(currentAccessToken);
      if (decoded?.jti && decoded.exp) {
        const ttl = decoded.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) await tokenBlacklist.revoke(decoded.jti, ttl);
      }
    }

    const count = await sessionRepository.revokeAllForUser(userId);
    return { revokedSessions: count };
  }

  // ─── Change Password ─────────────────────────────────────────────────────────

  async changePassword(
    userId: string,
    input: ChangePasswordInput
  ): Promise<Result<ChangePasswordResponse, InvalidCredentialsError | NotFoundError | BusinessRuleViolationError>> {
    try {
      const userResult = await this.repository.findByIdWithPassword(userId);

      if (userResult.isFailure || !userResult.value) {
        return Result.fail(new NotFoundError('Usuário', userId));
      }

      const user = userResult.value;
      const passwordVerification = await verifyUserPassword(user, input.oldPassword);
      if (!passwordVerification.isMatch) {
        return Result.fail(new BusinessRuleViolationError('Senha atual incorreta'));
      }

      const updateResult = await this.repository.updatePassword(userId, input.newPassword);
      if (updateResult.isFailure) return Result.fail(updateResult.error);

      // Invalida todas as sessões ao trocar senha (segurança)
      await sessionRepository.revokeAllForUser(userId);

      return Result.ok({ message: 'Senha alterada com sucesso' });
    } catch {
      return Result.fail(new NotFoundError('Usuário', userId));
    }
  }

  // ─── Password Reset ───────────────────────────────────────────────────────────

  private generateResetToken(_userId: string): { rawToken: string; tokenHash: string; expiresAt: Date } {
    const rawToken = crypto.randomBytes(48).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    return { rawToken, tokenHash, expiresAt };
  }

  private hashResetToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  async requestPasswordReset(email: string): Promise<Result<void, NotFoundError>> {
    try {
      const userResult = await this.repository.findByEmail(email);
      if (userResult.isFailure || !userResult.value) return Result.ok(undefined);

      const user = userResult.value;
      const { rawToken: _rawToken, tokenHash, expiresAt } = this.generateResetToken(user._id.toString());

      await this.repository.saveResetToken(user._id.toString(), tokenHash, expiresAt);
      // TODO: enviar _rawToken por email

      return Result.ok(undefined);
    } catch {
      return Result.ok(undefined);
    }
  }

  async resetPasswordWithToken(
    rawToken: string,
    newPassword: string
  ): Promise<Result<void, InvalidCredentialsError | NotFoundError>> {
    try {
      const tokenHash = this.hashResetToken(rawToken);
      const userResult = await this.repository.findByResetTokenHash(tokenHash);

      if (userResult.isFailure || !userResult.value) {
        return Result.fail(new InvalidCredentialsError());
      }

      const user = userResult.value;

      if (!user.tokenExpiry || user.tokenExpiry < new Date()) {
        await this.repository.clearResetToken(user._id.toString());
        return Result.fail(new InvalidCredentialsError());
      }

      const updateResult = await this.repository.updatePassword(user._id.toString(), newPassword);
      await this.repository.clearResetToken(user._id.toString());

      if (updateResult.isFailure) return Result.fail(new InvalidCredentialsError());

      // Invalida todas as sessões após reset de senha
      await sessionRepository.revokeAllForUser(user._id.toString());

      return Result.ok(undefined);
    } catch {
      return Result.fail(new InvalidCredentialsError());
    }
  }

  async verifyPasswordResetToken(rawToken: string): Promise<Result<void, InvalidCredentialsError>> {
    try {
      const tokenHash = this.hashResetToken(rawToken);
      const userResult = await this.repository.findByResetTokenHash(tokenHash);

      if (userResult.isFailure || !userResult.value) {
        return Result.fail(new InvalidCredentialsError());
      }

      const user = userResult.value;
      if (!user.tokenExpiry || user.tokenExpiry < new Date()) {
        return Result.fail(new InvalidCredentialsError());
      }

      return Result.ok(undefined);
    } catch {
      return Result.fail(new InvalidCredentialsError());
    }
  }
}
