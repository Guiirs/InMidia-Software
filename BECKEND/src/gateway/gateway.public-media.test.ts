/**
 * Regressão: rota de mídia pública não pode cair no rate limit de 100 req/15min
 * do módulo 'public-api' (JSON).
 *
 * Causa raiz do bug original: gatewayConfig.routes só tinha '/api/v1/public/*'
 * (módulo 'public-api', max 100/15min, chave por IP), que casava também com
 * '/api/v1/public/media/plates/:id/main'. O publicMediaRateLimiter (5000/15min)
 * aplicado em app.ts nunca chegava a importar — o gatewayMiddleware já barrava
 * a requisição antes com 429 "GATEWAY_RATE_LIMITED" / log "public-api".
 */

import { findRoute, gatewayConfig } from './gateway.config';

describe('Gateway — rota de mídia pública isolada do rate limit de dados', () => {
  it('media: /api/v1/public/media/plates/:id/main resolve para módulo public-media', () => {
    const route = findRoute('/api/v1/public/media/plates/64f1c2b2a1b2c3d4e5f6a7b8/main');
    expect(route).toEqual(
      expect.objectContaining({ module: 'public-media', requiresAuth: false }),
    );
  });

  it('media: rota public-media não define rateLimit próprio (delega ao publicMediaRateLimiter)', () => {
    const route = findRoute('/api/v1/public/media/plates/64f1c2b2a1b2c3d4e5f6a7b8/main');
    expect(route?.rateLimit).toBeUndefined();
  });

  it('JSON: /api/v1/public/placas continua resolvendo para public-api com 100/15min', () => {
    const route = findRoute('/api/v1/public/placas');
    expect(route).toEqual(
      expect.objectContaining({
        module: 'public-api',
        rateLimit: { windowMs: 15 * 60 * 1000, max: 100 },
      }),
    );
  });

  it('JSON: /api/v1/public/placas/export continua resolvendo para public-api com 100/15min', () => {
    const route = findRoute('/api/v1/public/placas/export');
    expect(route).toEqual(
      expect.objectContaining({ module: 'public-api', rateLimit: { windowMs: 15 * 60 * 1000, max: 100 } }),
    );
  });

  it('rota /api/v1/public/media/* está declarada antes de /api/v1/public/* (precedência do find)', () => {
    const mediaIdx = gatewayConfig.routes.findIndex((r) => r.path === '/api/v1/public/media/*');
    const publicApiIdx = gatewayConfig.routes.findIndex((r) => r.path === '/api/v1/public/*');
    expect(mediaIdx).toBeGreaterThanOrEqual(0);
    expect(publicApiIdx).toBeGreaterThanOrEqual(0);
    expect(mediaIdx).toBeLessThan(publicApiIdx);
  });
});
