import request from 'supertest';
import express from 'express';
import logger from '@shared/container/logger';
import { KNOWN_SCANNER_PATHS, isKnownScannerPath } from './security-scan-guard';
import { securityScanGuard } from './security-scan-guard';
import { rootInfoHandler } from './root-info';

jest.mock('@shared/container/logger', () => ({
  __esModule: true,
  default: {
    debug: jest.fn(),
    error: jest.fn(),
    http: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('security scan guard', () => {
  function buildApp() {
    const app = express();
    app.use(securityScanGuard);
    app.get('/', rootInfoHandler);
    app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
    return app;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('mantem lista centralizada de paths de scanners conhecidos', () => {
    expect(KNOWN_SCANNER_PATHS).toContain('/.env');
    expect(KNOWN_SCANNER_PATHS).toContain('/.git/*');
    expect(KNOWN_SCANNER_PATHS).toContain('/actuator/*');
    expect(KNOWN_SCANNER_PATHS).toContain('/.aws/*');
    expect(isKnownScannerPath('/.env.local')).toBe(true);
    expect(isKnownScannerPath('/.git/config')).toBe(true);
    expect(isKnownScannerPath('/actuator/env')).toBe(true);
    expect(isKnownScannerPath('/.aws/credentials')).toBe(true);
  });

  test.each([
    '/.env',
    '/.git/config',
    '/actuator/env',
    '/.aws/credentials',
  ])('bloqueia scanner %s sem gerar error e com log SECURITY_SCAN', async (path) => {
    const res = await request(buildApp())
      .get(path)
      .set('User-Agent', 'scanner-test/1.0')
      .set('CF-Connecting-IP', '65.1.2.3');

    expect(res.status).toBe(404);
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('[SECURITY_SCAN] Blocked request')
    );
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining(`path=${path}`));
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('ip=65.1.2.3'));
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('ua=scanner-test/1.0'));
  });

  it('GET / retorna status operacional minimo', async () => {
    const res = await request(buildApp()).get('/');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      service: 'InMidia API',
      status: 'online',
      version: 'v4',
    });
    expect(res.body.uptime).toBeUndefined();
    expect(res.body.env).toBeUndefined();
    expect(res.body.database).toBeUndefined();
  });
});
