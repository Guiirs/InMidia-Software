import crypto from 'crypto';
import { randomUUID } from 'crypto';
import RefreshToken from '../RefreshToken';
import type { IRefreshToken } from '@database/schemas/refresh-token.schema';
import logger from '@shared/container/logger';

export interface CreateSessionInput {
  userId: string;
  empresaId: string;
  ip: string;
  userAgent: string;
  expiresInMs: number;
  /** Família de tokens — se omitido, gera nova família (novo login) */
  family?: string;
}

export interface SessionRecord {
  rawToken: string;
  family: string;
  expiresAt: Date;
}

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export class SessionRepository {
  /** Cria nova sessão; retorna token bruto (para enviar ao cliente) */
  async create(input: CreateSessionInput): Promise<SessionRecord> {
    const rawToken = crypto.randomBytes(48).toString('hex');
    const tokenHash = hashToken(rawToken);
    const family = input.family ?? randomUUID();
    const expiresAt = new Date(Date.now() + input.expiresInMs);

    await RefreshToken.create({
      tokenHash,
      userId: input.userId,
      empresaId: input.empresaId,
      ip: input.ip,
      userAgent: input.userAgent,
      family,
      expiresAt,
    });

    return { rawToken, family, expiresAt };
  }

  /** Busca sessão válida pelo hash do token bruto */
  async findValidByRawToken(rawToken: string): Promise<IRefreshToken | null> {
    const tokenHash = hashToken(rawToken);
    const session = await RefreshToken.findOne({ tokenHash })
      .select('+tokenHash')
      .lean<IRefreshToken>()
      .exec();

    return session ?? null;
  }

  /** Revoga uma sessão específica (pelo hash do token bruto) */
  async revokeByRawToken(rawToken: string): Promise<void> {
    const tokenHash = hashToken(rawToken);
    await RefreshToken.updateOne({ tokenHash }, { revokedAt: new Date() }).exec();
  }

  /** Revoga TODA a família de tokens (para reuse attack) */
  async revokeFamilyAll(family: string): Promise<number> {
    const result = await RefreshToken.updateMany(
      { family, revokedAt: null },
      { revokedAt: new Date() }
    ).exec();
    return result.modifiedCount;
  }

  /** Revoga todas as sessões ativas de um usuário (logout global) */
  async revokeAllForUser(userId: string): Promise<number> {
    const result = await RefreshToken.updateMany(
      { userId, revokedAt: null },
      { revokedAt: new Date() }
    ).exec();
    return result.modifiedCount;
  }

  /** Lista sessões ativas de um usuário */
  async findActiveByUser(userId: string): Promise<Omit<IRefreshToken, 'tokenHash'>[]> {
    return RefreshToken.find({
      userId,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    })
      .select('-tokenHash')
      .lean<Omit<IRefreshToken, 'tokenHash'>[]>()
      .exec();
  }

  /** Verifica se a família tem histórico de reuse (outra sessão já usada) */
  async detectReuseInFamily(family: string): Promise<boolean> {
    const count = await RefreshToken.countDocuments({
      family,
      revokedAt: { $ne: null },
    }).exec();
    return count > 0;
  }

  /** Remove refresh token após rotação (substituído por um novo) */
  async deleteByRawToken(rawToken: string): Promise<void> {
    const tokenHash = hashToken(rawToken);
    await RefreshToken.deleteOne({ tokenHash }).exec();
  }

  async logSessionStats(userId: string): Promise<void> {
    const active = await RefreshToken.countDocuments({
      userId,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    });
    logger.debug(`[SessionRepo] userId=${userId} active sessions=${active}`);
  }
}

export const sessionRepository = new SessionRepository();
