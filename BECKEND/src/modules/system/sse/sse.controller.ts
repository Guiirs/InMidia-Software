/**
 * SSE Controller — notificações em tempo real por usuário/empresa/admin.
 *
 * Proxy-safe: X-Accel-Buffering + flushHeaders + heartbeat 25s (abaixo do timeout
 * padrão de 30s do OLS/Nginx) garantem funcionamento atrás de qualquer reverse proxy.
 */
import { Request, Response } from 'express';
import { IAuthRequest } from '../../../types/express';
import logger from '../../../shared/container/logger';
import { getRequestId } from '@shared/infra/http/proxy.utils';

type AuthReq = Request & IAuthRequest;

// Heartbeat abaixo de 30s (timeout padrão de proxies) e do keepAliveTimeout do Node
const HEARTBEAT_INTERVAL_MS = 25_000;

interface SSEConn {
  res:         Response;
  userId:      string;
  empresaId:   string;
  username:    string;
  role:        string;
  connectedAt: Date;
  requestId:   string;
}

const conexoesSSE = new Map<string, SSEConn>();

// ─── Stream ───────────────────────────────────────────────────────────────────

export function streamNotificacoes(req: AuthReq, res: Response): void {
  const userId      = String((req.user as any).id);
  const empresaId   = String((req.user as any).empresaId);
  const username    = String((req.user as any).username || userId);
  const role        = String((req.user as any).role || 'user');
  const requestId   = getRequestId(req);
  const connectionId = `${userId}_${Date.now()}`;

  // ── SSE headers — must all be set before flushHeaders() ──────────────────
  res.setHeader('Content-Type',      'text/event-stream');
  res.setHeader('Cache-Control',     'no-cache');
  res.setHeader('Connection',        'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');  // disables OLS/Nginx response buffering
  res.flushHeaders();                          // send headers immediately to the proxy

  logger.info(`[SSE] CONNECT user=${username} connId=${connectionId} requestId=${requestId}`);

  // Initial connected event
  res.write(`event: connected\ndata: ${JSON.stringify({
    type: 'connected',
    connectionId,
    timestamp: new Date().toISOString(),
  })}\n\n`);

  conexoesSSE.set(connectionId, { res, userId, empresaId, username, role, connectedAt: new Date(), requestId });

  // Heartbeat keeps the connection alive through idle-timeout proxies
  const heartbeat = setInterval(() => {
    try {
      res.write(`event: heartbeat\ndata: ${JSON.stringify({ serverTime: new Date().toISOString() })}\n\n`);
    } catch {
      cleanupConn();
    }
  }, HEARTBEAT_INTERVAL_MS);

  let cleaned = false;
  function cleanupConn(): void {
    if (cleaned) return;
    cleaned = true;
    clearInterval(heartbeat);
    conexoesSSE.delete(connectionId);
    logger.info(`[SSE] DISCONNECT user=${username} connId=${connectionId} requestId=${requestId}`);
  }

  req.on('close', cleanupConn);
  req.on('error', (err: Error) => {
    logger.warn(`[SSE] ERROR connId=${connectionId} requestId=${requestId} err=${err.message}`);
    cleanupConn();
  });
}

// ─── Push helpers ─────────────────────────────────────────────────────────────

function writeToConn(conn: SSEConn, connectionId: string, eventType: string, data: unknown): void {
  try {
    conn.res.write(`event: ${eventType}\ndata: ${JSON.stringify({ type: eventType, data, timestamp: new Date().toISOString() })}\n\n`);
  } catch (err: any) {
    logger.error(`[SSE] Write failed connId=${connectionId}: ${err.message}`);
    conexoesSSE.delete(connectionId);
  }
}

export function notificarUsuario(userId: string, type: string, data: unknown): void {
  let sent = 0;
  conexoesSSE.forEach((conn, connId) => {
    if (conn.userId === userId) { writeToConn(conn, connId, type, data); sent++; }
  });
  if (sent > 0) logger.debug(`[SSE] notificarUsuario type=${type} userId=${userId} sent=${sent}`);
}

export function notificarEmpresa(empresaId: string, type: string, data: unknown): void {
  let sent = 0;
  conexoesSSE.forEach((conn, connId) => {
    if (conn.empresaId === empresaId) { writeToConn(conn, connId, type, data); sent++; }
  });
  if (sent > 0) logger.info(`[SSE] notificarEmpresa type=${type} empresaId=${empresaId} sent=${sent}`);
}

export function notificarAdmins(type: string, data: unknown): void {
  let sent = 0;
  conexoesSSE.forEach((conn, connId) => {
    if (conn.role === 'admin') { writeToConn(conn, connId, type, data); sent++; }
  });
  if (sent > 0) logger.info(`[SSE] notificarAdmins type=${type} sent=${sent}`);
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export function getEstatisticas(_req: AuthReq, res: Response): void {
  const porEmpresa: Record<string, number> = {};
  const porRole: Record<string, number> = {};

  conexoesSSE.forEach((conn) => {
    porEmpresa[conn.empresaId] = (porEmpresa[conn.empresaId] ?? 0) + 1;
    porRole[conn.role]         = (porRole[conn.role] ?? 0) + 1;
  });

  res.status(200).json({
    sucesso: true,
    sse_stats: {
      total_conexoes: conexoesSSE.size,
      por_empresa:    porEmpresa,
      por_role:       porRole,
    },
  });
}

export default {
  streamNotificacoes,
  notificarUsuario,
  notificarEmpresa,
  notificarAdmins,
  getEstatisticas,
};
