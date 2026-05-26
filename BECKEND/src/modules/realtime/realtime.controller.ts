import { Request, Response } from 'express';
import type { IAuthRequest } from '../../types/express.d';
import logger from '@shared/container/logger';
import { eventBus } from './event-bus.service';
import type { OperationalEvent } from './domain-events';
import { consumeStreamToken, issueStreamToken } from '@modules/sync/sync.stream-tokens';
import { realtimeMetrics } from './realtime.metrics';

export function getRealtimeHealth(_req: Request, res: Response): void {
  const snap = realtimeMetrics.snapshot();
  res.status(200).json({
    success: true,
    data: {
      connectedClients:    snap.connectedClients,
      emittedLastMinute:   snap.emittedLastMinute,
      activeListeners:     snap.activeListeners,
      uptime:              snap.uptime,
      memory:              snap.memory,
      reconnectRate:       snap.reconnectRate,
      authFailuresLastMin: snap.authFailuresLastMinute,
      totals:              snap.totals,
      timestamp:           snap.timestamp,
    },
  });
}

type AuthReq = Request & IAuthRequest;
type Params = Record<string, string>;

const HEARTBEAT_INTERVAL_MS = 25_000;

function writeSseFrame(res: Response, options: { id?: string; event?: string; data: unknown }): void {
  if (options.id) res.write(`id: ${options.id}\n`);
  if (options.event) res.write(`event: ${options.event}\n`);
  res.write(`data: ${JSON.stringify(options.data)}\n\n`);
}

export function postOperationalStreamToken(req: AuthReq, res: Response): void {
  if (!req.user?.empresaId || !req.user?.id) {
    res.status(401).json({ success: false, error: 'Usuario nao autenticado' });
    return;
  }

  const companyId = String(req.user.empresaId);
  const userId = String(req.user.id);
  const { token, expiresAt } = issueStreamToken(companyId, userId);

  res.status(200).json({
    success: true,
    data: {
      token,
      expiresAt,
      ttlMs: 60_000,
    },
  });
}

export function streamOperationalEvents(req: Request, res: Response): void {
  const query = req.query as Params;
  const streamToken = query.token;
  const identity = consumeStreamToken(streamToken ?? '');

  if (!identity) {
    realtimeMetrics.recordAuthFailure('invalid_stream_token');
    res.status(401).json({ success: false, error: 'Stream token invalido, expirado ou ja utilizado' });
    return;
  }

  const companyId = identity.empresaId;
  const userId = identity.userId;
  const lastEventId = typeof req.headers['last-event-id'] === 'string' ? req.headers['last-event-id'] : undefined;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  writeSseFrame(res, {
    event: 'connected',
    data: {
      connected: true,
      companyId,
      userId,
      timestamp: new Date().toISOString(),
    },
  });

  const replay = eventBus.getRecentEvents(companyId, lastEventId);
  replay.forEach((event) => {
    writeSseFrame(res, {
      id: event.timestamp,
      event: 'operational',
      data: event,
    });
  });

  const onEvent = (event: OperationalEvent) => {
    if (event.companyId !== companyId) return;
    writeSseFrame(res, {
      id: event.timestamp,
      event: 'operational',
      data: event,
    });
  };

  eventBus.subscribe(onEvent);
  realtimeMetrics.recordSseConnected({ companyId, userId });

  const heartbeatInterval = setInterval(() => {
    writeSseFrame(res, {
      event: 'heartbeat',
      data: {
        timestamp: new Date().toISOString(),
      },
    });
  }, HEARTBEAT_INTERVAL_MS);

  logger.info(`[RealtimeGateway] SSE connected company=${companyId} user=${userId}`);

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    clearInterval(heartbeatInterval);
    eventBus.unsubscribe(onEvent);
    realtimeMetrics.recordSseDisconnected({ companyId, userId });
    logger.info(`[RealtimeGateway] SSE disconnected company=${companyId} user=${userId}`);
  };

  req.on('close', cleanup);
  req.on('error', cleanup);
}
