import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

describe('gatewayMiddleware policies', () => {
  const originalJwtSecret = process.env.JWT_SECRET;

  beforeAll(() => {
    process.env.JWT_SECRET = originalJwtSecret || 'gateway-unit-secret';
  });

  afterAll(() => {
    if (originalJwtSecret) process.env.JWT_SECRET = originalJwtSecret;
    else process.env.JWT_SECRET = '';
  });

  function buildApp() {
    const { gatewayMiddleware } = require('../../gateway/gateway.middleware') as typeof import('../../gateway/gateway.middleware');
    const app = express();
    app.use(gatewayMiddleware);
    app.get('/api/v1/admin/ping', (_req, res) => res.json({ ok: true }));
    return app;
  }

  it('bloqueia rota requiresAuth sem token antes do router final', async () => {
    const res = await request(buildApp()).get('/api/v1/admin/ping');

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('AUTH_REQUIRED');
  });

  it('aplica requiredRoles declarado no gateway', async () => {
    const token = jwt.sign(
      {
        id: '507f1f77bcf86cd799439011',
        empresaId: '507f1f77bcf86cd799439012',
        role: 'vendedor',
        email: 'seller@inmidia.com',
        username: 'seller',
      },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' }
    );

    const res = await request(buildApp())
      .get('/api/v1/admin/ping')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('GATEWAY_FORBIDDEN');
  });
});
