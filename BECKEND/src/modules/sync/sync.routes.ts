/**
 * Sync Routes — COMM-3
 *
 * COMM-7: GET /sync/diagnostics (admin)
 *
 * GET  /sync/status         — público
 * GET  /sync/snapshot       — autenticado (Bearer)
 * GET  /sync/events         — autenticado (Bearer, polling)
 * POST /sync/stream-token   — autenticado (Bearer, emite token para SSE)
 * GET  /sync/stream         — token efêmero (SSE)
 * GET  /sync/diagnostics    — autenticado (Bearer, admin role) — COMM-7
 */

import { Router } from 'express';
import authMiddleware from '@middlewares/auth.middleware';
import { requirePermission } from '@middlewares/permissions.middleware';
import { requireTenantGuard } from '@middlewares/tenant-guard.middleware';
import { auditSensitiveRead } from '@modules/audit/audit.controller';
import {
  getStatus,
  getSnapshot,
  getEvents,
  postStreamToken,
  getStream,
  getDiagnostics,
  getDiagnosticsTimeline,
} from './sync.controller';

const router = Router();

router.get('/status',   getStatus);
router.get('/snapshot', authMiddleware, requireTenantGuard, getSnapshot);
router.get('/events',   authMiddleware, requireTenantGuard, getEvents);

router.post('/stream-token', authMiddleware, requireTenantGuard, postStreamToken);
router.get('/stream',        getStream);

router.get('/diagnostics', authMiddleware, requireTenantGuard, requirePermission('sync.diagnostics'), auditSensitiveRead('sync', 'diagnostics'), getDiagnostics);
router.get('/diagnostics/timeline', authMiddleware, requireTenantGuard, requirePermission('sync.diagnostics'), auditSensitiveRead('sync', 'diagnostics_timeline'), getDiagnosticsTimeline);

export default router;
