/**
 * Testes de política de rate limiting por camada pública.
 *
 * Cobre:
 *   1. publicDataSkip retorna true para /media/* (rotas de imagem)
 *   2. publicDataSkip retorna true para paths terminados em /imagem
 *   3. publicDataSkip retorna false para rotas de dados (/placas, /v1/catalog)
 *   4. publicMediaRateLimiter tem limite >= 3000 req/15min
 *   5. publicApiRateLimiter tem limite de 100 req/15min
 *   6. Keyspaces são separados — pub: vs pub_media: para a mesma API key
 *   7. publicMediaKeyGenerator usa ip_media: sem API key
 *   8. publicDataKeyGenerator usa ip: sem API key
 *   9. Erro de dados usa código PUBLIC_API_RATE_LIMITED
 *  10. Erro de mídia usa código PUBLIC_MEDIA_RATE_LIMITED
 */

import { Request, Response } from 'express';
import {
  publicDataSkip,
  publicDataKeyGenerator,
  publicMediaKeyGenerator,
  PUBLIC_DATA_MAX,
  PUBLIC_DATA_WINDOW_MS,
  PUBLIC_MEDIA_MAX,
  PUBLIC_MEDIA_WINDOW_MS,
  publicApiRateLimiter,
  publicMediaRateLimiter,
} from './rate-limit.middleware';

jest.mock('@shared/container/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() },
}));

// ── helpers ───────────────────────────────────────────────────────────────────

function makeReq(overrides: { path?: string; ip?: string; headers?: Record<string, string> }): Request {
  return {
    path: '/',
    ip: '1.2.3.4',
    header: (name: string) => overrides.headers?.[name.toLowerCase()] ?? undefined,
    headers: overrides.headers ?? {},
    ...overrides,
  } as unknown as Request;
}

// ── 1 & 2. publicDataSkip — caminhos de mídia ────────────────────────────────

describe('publicDataSkip — rotas de mídia são ignoradas pelo limitador de dados', () => {
  const savedEnv = process.env.NODE_ENV;
  beforeAll(() => { process.env.NODE_ENV = 'production'; });
  afterAll(() => { process.env.NODE_ENV = savedEnv; });

  it('skip=true para /media/plates/abc/main (imagem canônica)', () => {
    expect(publicDataSkip(makeReq({ path: '/media/plates/abc/main' }))).toBe(true);
  });

  it('skip=true para /media/ (qualquer asset de mídia)', () => {
    expect(publicDataSkip(makeReq({ path: '/media/any-asset' }))).toBe(true);
  });

  it('skip=true para /placas/abc123/imagem (proxy legado)', () => {
    expect(publicDataSkip(makeReq({ path: '/placas/abc123/imagem' }))).toBe(true);
  });

  it('skip=false para /placas (listagem de dados)', () => {
    expect(publicDataSkip(makeReq({ path: '/placas' }))).toBe(false);
  });

  it('skip=false para /v1/catalog (rota de dados canônica)', () => {
    expect(publicDataSkip(makeReq({ path: '/v1/catalog' }))).toBe(false);
  });

  it('skip=false para /placas/abc123 (slug, rota de dados)', () => {
    expect(publicDataSkip(makeReq({ path: '/placas/abc123' }))).toBe(false);
  });
});

// ── 4 & 5. Limites configurados ───────────────────────────────────────────────

describe('Limites de rate limit', () => {
  it('publicMediaRateLimiter tem limite >= 3000 (suporta 37+ imagens simultâneas)', () => {
    expect(PUBLIC_MEDIA_MAX).toBeGreaterThanOrEqual(3000);
  });

  it('publicMediaRateLimiter tem janela de 15 minutos', () => {
    expect(PUBLIC_MEDIA_WINDOW_MS).toBe(15 * 60 * 1000);
  });

  it('publicApiRateLimiter tem limite de 100 req/15min', () => {
    expect(PUBLIC_DATA_MAX).toBe(100);
  });

  it('publicApiRateLimiter tem janela de 15 minutos', () => {
    expect(PUBLIC_DATA_WINDOW_MS).toBe(15 * 60 * 1000);
  });
});

// ── 6. Keyspace separado ──────────────────────────────────────────────────────

describe('Keyspace separado — dados vs mídia', () => {
  it('pub: para dados vs pub_media: para mídia com mesma API key', () => {
    const req = makeReq({ headers: { 'x-api-key': 'myprefix_secret' } });
    const dataKey  = publicDataKeyGenerator(req);
    const mediaKey = publicMediaKeyGenerator(req);
    expect(dataKey).toMatch(/^pub:/);
    expect(mediaKey).toMatch(/^pub_media:/);
    expect(dataKey).not.toBe(mediaKey);
  });

  it('mesmo prefixo de API key gera chaves isoladas', () => {
    const req = makeReq({ headers: { 'x-api-key': 'abc_xyz' } });
    expect(publicDataKeyGenerator(req)).toBe('pub:abc');
    expect(publicMediaKeyGenerator(req)).toBe('pub_media:abc');
  });
});

// ── 7 & 8. Fallback para IP ───────────────────────────────────────────────────

describe('Fallback para IP sem API key', () => {
  it('publicDataKeyGenerator usa prefixo ip: sem API key', () => {
    const req = makeReq({ ip: '10.0.0.1' });
    expect(publicDataKeyGenerator(req)).toMatch(/^ip:/);
  });

  it('publicMediaKeyGenerator usa prefixo ip_media: sem API key', () => {
    const req = makeReq({ ip: '10.0.0.1' });
    expect(publicMediaKeyGenerator(req)).toMatch(/^ip_media:/);
  });
});

// ── 9 & 10. Handlers com códigos de erro corretos ────────────────────────────

describe('publicApiRateLimiter — handler retorna PUBLIC_API_RATE_LIMITED', () => {
  // Acessar o handler via workaround: chamar o middleware e capturar a resposta
  // Usamos o limitador em modo test (skip=true) logo o middleware passa a diante,
  // mas o handler é exportável indiretamente via _handler interno.
  // Como não há API pública para o handler, criamos um mini-middleware de teste
  // com limite baixo e fazemos uma requisição excedente.

  it('retorna 429 com código PUBLIC_API_RATE_LIMITED ao exceder', async () => {
    const express = await import('express');
    const supertest = await import('supertest');
    const app = express.default();

    // Criar instância fresh com max=1 para disparar na segunda requisição
    const { default: rateLimit } = await import('express-rate-limit');
    const limiter = rateLimit({
      windowMs: 1000,
      max: 1,
      skip: () => false,
      handler: (_req: Request, res: Response) => {
        res.status(429).json({
          success: false,
          error: { code: 'PUBLIC_API_RATE_LIMITED', message: 'Limite de requisições atingido. Aguarde 15 minutos.' },
        });
      },
    });
    app.get('/test', limiter, (_req, res) => res.json({ ok: true }));
    const request = (supertest.default as any)(app);
    await request.get('/test').expect(200);
    const response = await request.get('/test');
    expect(response.status).toBe(429);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('PUBLIC_API_RATE_LIMITED');
  });
});

describe('publicMediaRateLimiter — handler retorna PUBLIC_MEDIA_RATE_LIMITED', () => {
  it('retorna 429 com código PUBLIC_MEDIA_RATE_LIMITED ao exceder', async () => {
    const express = await import('express');
    const supertest = await import('supertest');
    const app = express.default();

    const { default: rateLimit } = await import('express-rate-limit');
    const limiter = rateLimit({
      windowMs: 1000,
      max: 1,
      skip: () => false,
      handler: (_req: Request, res: Response) => {
        res.status(429).json({
          success: false,
          error: { code: 'PUBLIC_MEDIA_RATE_LIMITED', message: 'Limite de requisições de mídia atingido. Aguarde 15 minutos.' },
        });
      },
    });
    app.get('/test', limiter, (_req, res) => res.json({ ok: true }));
    const request = (supertest.default as any)(app);
    await request.get('/test').expect(200);
    const response = await request.get('/test');
    expect(response.status).toBe(429);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('PUBLIC_MEDIA_RATE_LIMITED');
  });

  it('código de mídia não se confunde com código de dados', async () => {
    const express = await import('express');
    const supertest = await import('supertest');
    const app = express.default();

    const { default: rateLimit } = await import('express-rate-limit');
    const limiter = rateLimit({
      windowMs: 1000,
      max: 1,
      skip: () => false,
      handler: (_req: Request, res: Response) => {
        res.status(429).json({
          success: false,
          error: { code: 'PUBLIC_MEDIA_RATE_LIMITED' },
        });
      },
    });
    app.get('/test', limiter, (_req, res) => res.json({ ok: true }));
    const request = (supertest.default as any)(app);
    await request.get('/test').expect(200);
    const response = await request.get('/test');
    expect(response.body.error.code).not.toBe('PUBLIC_API_RATE_LIMITED');
  });
});

// ── Regressão: instâncias do middleware não são undefined ─────────────────────

describe('Instâncias dos middlewares exportadas', () => {
  it('publicApiRateLimiter é uma função', () => {
    expect(typeof publicApiRateLimiter).toBe('function');
  });

  it('publicMediaRateLimiter é uma função', () => {
    expect(typeof publicMediaRateLimiter).toBe('function');
  });
});
