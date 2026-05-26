import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';

let mockUser = { role: 'admin' };
let mockDiagnostics;

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    hasPermission: (permission) => mockUser?.permissions?.includes(permission) || ['admin', 'superadmin', 'admin_empresa'].includes(mockUser?.role),
  }),
}));

vi.mock('../../services/syncService', () => ({
  getDiagnostics: () => mockDiagnostics,
}));

import AdminSyncDiagnosticsPage, { isAdminRole } from './AdminSyncDiagnosticsPage';

beforeEach(() => {
  mockUser = { role: 'admin' };
  mockDiagnostics = {
    connected: false,
    transportMode: 'redis-streams',
    degraded: true,
    transportHealth: 'degraded',
    degradedReason: 'REDIS_DISCONNECTED',
    redisConnected: false,
    sseConnected: true,
    sseClientsConnected: 3,
    averageLagMs: 2200,
    latestLagMs: 3100,
    replayFailureCount: 2,
    snapshotRecoveries: 4,
    legacyCursorDetected: true,
    legacyCursorUses: 7,
    reconnectAttempts: 1,
    healthScore: 62,
    healthStatus: 'degraded',
    reconnectStorm: true,
    reconnectEvents: [
      { at: '2026-05-15T10:01:00.000Z', type: 'SSE_RECONNECT', reason: 'SSE_ERROR', severity: 'warning' },
    ],
    replayFailures: [
      { at: '2026-05-15T10:02:00.000Z', type: 'REPLAY_FAILURE', reason: 'CURSOR_INVALID', severity: 'warning' },
    ],
    degradedTransitionsLog: [
      { at: '2026-05-15T10:03:00.000Z', type: 'DEGRADED_ON', reason: 'REDIS_DISCONNECTED', severity: 'critical' },
    ],
    incidentsTimeline: [
      { at: '2026-05-15T10:03:00.000Z', type: 'DEGRADED_ON', reason: 'REDIS_DISCONNECTED', severity: 'critical' },
    ],
    recentEvents: [
      { id: 'evt-1', type: 'PLACA_UPDATED', empresaId: 'emp-1', occurredAt: '2026-05-15T10:00:00.000Z' },
    ],
  };
});

describe('AdminSyncDiagnosticsPage', () => {
  it('renderiza estado degraded', () => {
    const html = renderToString(<AdminSyncDiagnosticsPage />);
    expect(html).toContain('degraded');
    expect(html).toContain('REDIS_DISCONNECTED');
  });

  it('mostra lag metrics', () => {
    const html = renderToString(<AdminSyncDiagnosticsPage />);
    expect(html).toContain('latestLagMs');
    expect(html).toContain('3100ms');
    expect(html).toContain('averageLagMs');
    expect(html).toContain('2200ms');
  });

  it('mostra warning de legacy cursor', () => {
    const html = renderToString(<AdminSyncDiagnosticsPage />);
    expect(html).toContain('Legacy cursor ainda em uso');
    expect(html).toContain('legacyCursor usage');
  });

  it('mostra health score', () => {
    const html = renderToString(<AdminSyncDiagnosticsPage />);
    expect(html).toContain('62');
    expect(html).toContain('degraded');
  });

  it('mostra timeline e indicadores de reconnect storm', () => {
    const html = renderToString(<AdminSyncDiagnosticsPage />);
    expect(html).toContain('Incident Timeline');
    expect(html).toContain('DEGRADED_ON');
    expect(html).toContain('Reconnect Events');
    expect(html).toContain('SSE_RECONNECT');
    expect(html).toContain('reconnect storm');
    expect(html).toContain('sim');
  });

  it('mostra replay failures recentes', () => {
    const html = renderToString(<AdminSyncDiagnosticsPage />);
    expect(html).toContain('Replay Failures');
    expect(html).toContain('CURSOR_INVALID');
  });

  it('não renderiza para não-admin', () => {
    mockUser = { role: 'user', permissions: [] };
    const html = renderToString(<AdminSyncDiagnosticsPage />);
    expect(html).toBe('');
  });

  it('aceita superadmin', () => {
    expect(isAdminRole('superadmin')).toBe(true);
  });

  it('aceita admin_empresa', () => {
    expect(isAdminRole('admin_empresa')).toBe(true);
  });
});
