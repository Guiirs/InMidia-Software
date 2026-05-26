/**
 * Sync Controller — COMM-3
 *
 * COMM-7:
 *   - getStream() usa getEventsSinceAsync() → replay path unificado
 *     (antes usava getEventsSince síncrono — modo local apenas)
 *   - getDiagnostics() → GET /sync/diagnostics (admin role obrigatória)
 *   - SSE id já normalizado pelo pushEventToTenant (COMM-7)
 *
 * Endpoints:
 *   GET  /sync/status         — público
 *   GET  /sync/snapshot       — autenticado
 *   GET  /sync/events         — autenticado (polling)
 *   POST /sync/stream-token   — autenticado
 *   GET  /sync/stream         — token efêmero (SSE)
 *   GET  /sync/diagnostics    — autenticado admin (COMM-7)
 */

import { Request, Response, NextFunction } from 'express';
import { IAuthRequest } from '../../types/express';
import { Log } from '@shared/core';
import { requireEmpresaId } from '@shared/infra/http/tenant/tenant-context';
import {
  getSyncStatus,
  getSyncSnapshot,
  getSyncEvents,
  getSyncDiagnostics,
  getSyncDiagnosticsTimeline,
  isLegacyCursorInput,
} from './sync.service';
import { issueStreamToken, consumeStreamToken } from './sync.stream-tokens';
import { registerConnection } from './sync.sse-connections';
import { getEventsSinceAsync } from './sync.registry';
import { parseCursor } from './sync.types';
import type { AnyCursor } from './sync.types';

type AuthReq = Request & IAuthRequest;
type Params  = Record<string, string>;

// ─── GET /sync/status ─────────────────────────────────────────────────────────

export async function getStatus(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const status = await getSyncStatus();
    res.status(200).json({ success: true, data: status });
  } catch (error: any) {
    Log.error('[SyncController] Erro em getStatus', { error: error.message });
    next(error);
  }
}

// ─── GET /sync/snapshot ───────────────────────────────────────────────────────

export async function getSnapshot(
  req: AuthReq,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const empresaId = requireEmpresaId(req);
    const snapshot  = await getSyncSnapshot(empresaId);
    res.status(200).json({ success: true, data: snapshot });
  } catch (error: any) {
    Log.error('[SyncController] Erro em getSnapshot', { error: error.message });
    next(error);
  }
}

// ─── GET /sync/events ─────────────────────────────────────────────────────────

export async function getEvents(
  req: AuthReq,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const empresaId = requireEmpresaId(req);
    const rawCursor: AnyCursor | undefined =
      (req.query.cursor as string | undefined) ||
      (req.query.since  as string | undefined);
    if (isLegacyCursorInput(rawCursor ?? null)) {
      res.setHeader('X-Sync-Legacy-Cursor', 'true');
    }
    const result = await getSyncEvents(empresaId, rawCursor ?? null);
    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    Log.error('[SyncController] Erro em getEvents', { error: error.message });
    next(error);
  }
}

// ─── POST /sync/stream-token ──────────────────────────────────────────────────

export function postStreamToken(
  req: AuthReq,
  res: Response,
  next: NextFunction
): void {
  try {
    const empresaId = requireEmpresaId(req);
    const userId    = (req.user as any).id as string;
    const { token, expiresAt } = issueStreamToken(empresaId, userId);
    res.status(200).json({ success: true, data: { token, expiresAt, ttlMs: 60_000 } });
  } catch (error: any) {
    Log.error('[SyncController] Erro em postStreamToken', { error: error.message });
    next(error);
  }
}

// ─── GET /sync/stream ─────────────────────────────────────────────────────────

/**
 * COMM-7: replay via getEventsSinceAsync() — mesmo path do polling.
 * Anteriormente usava getEventsSince() (síncrono, local-only).
 *
 * Suporta Last-Event-ID nativo (browser reconect).
 * Prioridade: ?cursor > Last-Event-ID > ?since
 */
export async function getStream(
  req: Request,
  res: Response,
): Promise<void> {
  const query = req.query as Params;
  const { token } = query;

  const identity = consumeStreamToken(token ?? '');
  if (!identity) {
    res.status(401).json({
      success: false,
      error:  'Stream token inválido, expirado ou já utilizado.',
      code:   'INVALID_STREAM_TOKEN',
    });
    return;
  }

  const { empresaId, userId } = identity;

  // Resolve cursor — prioridade: canônico > Last-Event-ID > legado
  const lastEventId = req.headers['last-event-id'] as string | undefined;
  const rawCursor: AnyCursor | undefined =
    query.cursor ||
    (lastEventId || undefined) ||
    query.since;

  const parsed = rawCursor ? parseCursor(rawCursor) : null;
  const legacyCursor = isLegacyCursorInput(rawCursor ?? null);

  res.setHeader('Content-Type',      'text/event-stream');
  res.setHeader('Cache-Control',     'no-cache');
  res.setHeader('Connection',        'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (legacyCursor) res.setHeader('X-Sync-Legacy-Cursor', 'true');
  res.flushHeaders();

  Log.info(`[SyncController] SSE conectado: empresa=${empresaId} user=${userId} cursor.mode=${parsed?.mode ?? 'none'}`);

  // COMM-7: replay via getEventsSinceAsync — path unificado com polling
  if (parsed) {
    try {
      const missed = await getEventsSinceAsync(empresaId, parsed) ?? [];
      if (missed.length > 0) {
        Log.info(`[SyncController] SSE replay: ${missed.length} evento(s) para empresa=${empresaId} correlationId=${missed[0]?.correlationId ?? 'n/a'}`);
        for (const evt of missed) {
          // SSE id = occurredAt (cursor-safe, consistente com pushEventToTenant)
          res.write(`id: ${evt.occurredAt}\nevent: ${evt.type}\ndata: ${JSON.stringify(evt)}\n\n`);
        }
      }
    } catch (err: any) {
      const correlationId = makeSyncCorrelationId();
      Log.warn(`[SyncController] Falha no replay SSE: ${err.message} correlationId=${correlationId} — enviando sync_reset`);
      res.write(`event: sync_reset\ndata: ${JSON.stringify({ reason: 'REPLAY_UNAVAILABLE', serverTime: new Date().toISOString(), correlationId })}\n\n`);
    }
  } else {
    res.write(`event: sync_reset\ndata: ${JSON.stringify({ reason: 'no_cursor', serverTime: new Date().toISOString(), correlationId: makeSyncCorrelationId() })}\n\n`);
  }

  const { connId, cleanup } = registerConnection(empresaId, userId, res);

  if (connId === -1) {
    res.write(`event: error\ndata: ${JSON.stringify({ error: 'connection_limit_reached' })}\n\n`);
    res.end();
    return;
  }

  req.on('close',  () => { cleanup(); Log.info(`[SyncController] SSE close id=${connId}`); });
  req.on('error',  () => { cleanup(); Log.info(`[SyncController] SSE error id=${connId}`); });
}

function makeSyncCorrelationId(): string {
  return `sync-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ─── GET /sync/diagnostics — COMM-7 (admin) ──────────────────────────────────

export async function getDiagnostics(
  req: AuthReq,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const diagnostics = await getSyncDiagnostics({
      empresaId: typeof req.query.empresaId === 'string' ? req.query.empresaId : undefined,
      type: typeof req.query.type === 'string' ? req.query.type : undefined,
      since: typeof req.query.since === 'string' ? req.query.since : undefined,
      until: typeof req.query.until === 'string' ? req.query.until : undefined,
      limit: typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined,
      offset: typeof req.query.offset === 'string' ? Number(req.query.offset) : undefined,
      cursor: typeof req.query.cursor === 'string' ? req.query.cursor : undefined,
    });
    res.status(200).json({ success: true, data: diagnostics });
  } catch (error: any) {
    Log.error('[SyncController] Erro em getDiagnostics', { error: error.message });
    next(error);
  }
}

export async function getDiagnosticsTimeline(
  req: AuthReq,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const timeline = await getSyncDiagnosticsTimeline({
      empresaId: typeof req.query.empresaId === 'string' ? req.query.empresaId : undefined,
      type: typeof req.query.type === 'string' ? req.query.type : undefined,
      severity: typeof req.query.severity === 'string' ? req.query.severity : undefined,
      correlationId: typeof req.query.correlationId === 'string' ? req.query.correlationId : undefined,
      since: typeof req.query.since === 'string' ? req.query.since : undefined,
      until: typeof req.query.until === 'string' ? req.query.until : undefined,
      limit: typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined,
      offset: typeof req.query.offset === 'string' ? Number(req.query.offset) : undefined,
      cursor: typeof req.query.cursor === 'string' ? req.query.cursor : undefined,
    });
    res.status(200).json({ success: true, data: timeline });
  } catch (error: any) {
    Log.error('[SyncController] Erro em getDiagnosticsTimeline', { error: error.message });
    next(error);
  }
}
