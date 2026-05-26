import jwt from 'jsonwebtoken';
import logger from '@shared/container/logger';
import config from '@config/config';
import { Socket } from 'socket.io';
import { tokenBlacklist } from '@shared/infra/auth/token-blacklist.service';
import { ACCESS_COOKIE } from '@modules/auth/services/auth.service';

interface DecodedToken {
  id: string;
  empresaId: string;
  role: string;
  username: string;
  jti?: string;
}

interface AuthSocket extends Socket {
  user?: DecodedToken;
}

/**
 * Extrai o JWT do Socket.IO handshake.
 * Ordem: cookie HttpOnly > auth.token (para clientes que não suportam cookies).
 * NÃO aceita query param (inseguro — expõe token em logs de servidor).
 */
function extractSocketToken(socket: AuthSocket): string | null {
  // 1) Cookie HttpOnly — preferido (enviado automaticamente pelo browser)
  const cookieHeader = socket.handshake.headers?.cookie;
  if (cookieHeader) {
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${ACCESS_COOKIE}=([^;]+)`));
    if (match?.[1]) return decodeURIComponent(match[1]);
  }

  // 2) auth.token — para clientes nativos (mobile, desktop) que não suportam cookies
  const authToken = socket.handshake.auth?.token as string | undefined;
  if (authToken) return authToken;

  return null;
}

/**
 * Middleware de autenticação para conexões Socket.IO.
 * Suporta HttpOnly cookies e auth.token (fallback para clientes não-browser).
 * Verifica JWT blacklist para garantir revogação imediata.
 */
const socketAuthMiddleware = async (socket: AuthSocket, next: (err?: Error) => void): Promise<void> => {
  try {
    const token = extractSocketToken(socket);

    if (!token) {
      logger.warn('[SocketAuth] Conexão sem token');
      return next(new Error('Authentication error: Token não fornecido'));
    }

    let decoded: DecodedToken;
    try {
      decoded = jwt.verify(token, config.jwtSecret) as DecodedToken;
    } catch (jwtErr: any) {
      logger.warn(`[SocketAuth] Token JWT inválido: ${jwtErr.message}`);
      return next(new Error('Authentication error: Token inválido ou expirado'));
    }

    // Verifica blacklist — garante que logout e revogação afetam realtime imediatamente
    if (decoded.jti) {
      const revoked = await tokenBlacklist.isRevoked(decoded.jti);
      if (revoked) {
        logger.warn(`[SocketAuth] Token revogado jti=${decoded.jti} userId=${decoded.id}`);
        return next(new Error('Authentication error: Sessão encerrada'));
      }
    }

    socket.user = {
      id: decoded.id,
      empresaId: decoded.empresaId,
      role: decoded.role,
      username: decoded.username,
      jti: decoded.jti,
    };

    logger.info(`[SocketAuth] Autenticado: ${decoded.username} (${decoded.id}) empresa=${decoded.empresaId}`);
    next();
  } catch (error: any) {
    logger.error(`[SocketAuth] Erro de autenticação: ${error.message}`);
    next(new Error('Authentication error: Erro interno'));
  }
};

export default socketAuthMiddleware;
