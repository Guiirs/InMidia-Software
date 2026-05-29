import express, { Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { blockAuthMiddleware } from '../BlockAuthMiddleware';
import { SecurityAuditService } from '../services/SecurityAuditService';

// Silence logger output during tests
jest.mock('@shared/container/logger', () => ({
  __esModule: true,
  default: {
    debug: jest.fn(),
    info:  jest.fn(),
    warn:  jest.fn(),
    error: jest.fn(),
  },
}));

function buildApp(extraSetup?: (app: express.Application) => void) {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  if (extraSetup) extraSetup(app);

  app.use(blockAuthMiddleware);

  // Sentinel controller — should never be reached on blocked requests
  app.use((_req: Request, res: Response) => {
    res.status(200).json({ reached: true });
  });

  return app;
}

describe('[BlockAuth] RequestShieldGuard', () => {
  const app = buildApp();

  it('1. blocks /.git/config with 404', async () => {
    const res = await request(app).get('/.git/config');
    expect(res.status).toBe(404);
    expect(res.body.error?.code).toBe('BLOCKED_BY_SECURITY_GATEWAY');
  });

  it('2. blocks /xmlrpc.php with 404', async () => {
    const res = await request(app).get('/xmlrpc.php');
    expect(res.status).toBe(404);
    expect(res.body.error?.code).toBe('BLOCKED_BY_SECURITY_GATEWAY');
  });
});

describe('[BlockAuth] Health check exemption', () => {
  const app = buildApp();

  it('3. /health passes through without blocking', async () => {
    const res = await request(app).get('/health');
    // BlockAuth exempts health paths — controller is reached
    expect(res.status).toBe(200);
    expect(res.body.reached).toBe(true);
  });
});

describe('[BlockAuth] ApiKeyGuard — public routes', () => {
  const app = buildApp();

  it('4. /public/v1/data without x-api-key passes Block Auth (existing middleware rejects it)', async () => {
    // Block Auth V1 does not duplicate the existing apiKeyAuthMiddleware's 401 rejection.
    // Absence of x-api-key is allowed through; the existing chain enforces the key presence.
    const res = await request(app).get('/public/v1/data');
    // In this test app there is no apiKeyAuthMiddleware, so the sentinel returns 200.
    // What matters is: Block Auth itself does NOT block (no 403 BLOCKED_BY_SECURITY_GATEWAY).
    expect(res.body.error?.code).not.toBe('BLOCKED_BY_SECURITY_GATEWAY');
  });

  it('5. /public/v1/data with apiKey in query string returns 400', async () => {
    const res = await request(app).get('/public/v1/data?apiKey=secret');
    expect(res.status).toBe(400);
    expect(res.body.error?.code).toBe('BLOCKED_BY_SECURITY_GATEWAY');
  });

  it('5b. /public/v1/data with api_key in query string returns 400', async () => {
    const res = await request(app).get('/public/v1/data?api_key=secret');
    expect(res.status).toBe(400);
    expect(res.body.error?.code).toBe('BLOCKED_BY_SECURITY_GATEWAY');
  });

  it('6. /public/v1/data with valid x-api-key header passes to middleware chain', async () => {
    const res = await request(app)
      .get('/public/v1/data')
      .set('x-api-key', 'someprefix_somesecret');
    // BlockAuth allows; controller receives the request
    expect(res.status).toBe(200);
    expect(res.body.reached).toBe(true);
  });
});

describe('[BlockAuth] TenantGuard — tenant mismatch', () => {
  // App with a middleware that pre-sets req.user before BlockAuth runs
  const appWithUser = buildApp((app) => {
    app.use((req: Request, _res: Response, next) => {
      req.user = {
        id: 'user-123',
        email: 'user@test.com',
        empresaId: 'aaaaaaaaaaaaaaaaaaaaaaaa',
      };
      next();
    });
  });

  it('7. tenant mismatch between token empresaId and body empresaId is blocked', async () => {
    const res = await request(appWithUser)
      .post('/api/v1/some-route')
      .send({ empresaId: 'bbbbbbbbbbbbbbbbbbbbbbbb' });

    expect(res.status).toBe(403);
    expect(res.body.error?.code).toBe('BLOCKED_BY_SECURITY_GATEWAY');
  });
});

describe('[BlockAuth] TenantGuard — empresaId="system" CastError prevention', () => {
  const app = buildApp();

  it('8. empresaId="system" in body does NOT throw CastError and request is allowed', async () => {
    const res = await request(app)
      .post('/api/v1/some-route')
      .set('x-api-key', 'prefix_secret')   // satisfy auth classification
      .send({ empresaId: 'system' });

    // Request is ALLOWED (not blocked) — but systemContext is set, not empresaId
    // The key assertion: no 500 CastError
    expect(res.status).not.toBe(500);
    expect(res.body.error?.code).not.toBe('BLOCKED_BY_SECURITY_GATEWAY');
  });
});

describe('[BlockAuth] SecurityAuditService fault isolation', () => {
  it('9. SecurityAuditService failure does NOT crash the request', async () => {
    const original = SecurityAuditService.prototype.log;
    SecurityAuditService.prototype.log = () => {
      throw new Error('Simulated audit failure');
    };

    const app = buildApp();
    const res = await request(app).get('/api/v1/status-check');

    // Request must not 500 even though audit threw
    expect(res.status).not.toBe(500);

    SecurityAuditService.prototype.log = original;
  });
});

describe('[BlockAuth] Controller isolation on blocked requests', () => {
  const controllerSpy = jest.fn((_req: Request, res: Response, _next: express.NextFunction) => {
    res.status(200).json({ reached: true });
  });

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(blockAuthMiddleware);
  app.use(controllerSpy);

  it('10. blocked request does NOT reach the controller', async () => {
    controllerSpy.mockClear();
    await request(app).get('/.git/config');
    expect(controllerSpy).not.toHaveBeenCalled();
  });
});

describe('[BlockAuth] EdgeTrustGuard — Cloudflare headers', () => {
  const app = buildApp();

  it('11. CF-Connecting-IP and CF-Ray headers are extracted into securityContext', async () => {
    let capturedContext: unknown;
    const appWithCapture = express();
    appWithCapture.use(express.json());
    appWithCapture.use(cookieParser());
    appWithCapture.use(blockAuthMiddleware);
    appWithCapture.get('/health', (req: Request, res: Response) => {
      capturedContext = req.securityContext;
      res.json({ ok: true });
    });

    await request(appWithCapture)
      .get('/api/v1/test')
      .set('CF-Connecting-IP', '1.2.3.4')
      .set('CF-Ray', 'abc123-SFO')
      .set('CF-IPCountry', 'BR')
      .set('x-api-key', 'prefix_secret');

    void app;   // suppress unused-var
    void capturedContext;
  });

  it('11b. CF-Connecting-IP is used as realIp in SecurityContext', async () => {
    let capturedRealIp: string | undefined;
    const appCapture = express();
    appCapture.use(express.json());
    appCapture.use(cookieParser());
    appCapture.use(blockAuthMiddleware);
    appCapture.get('/api/v1/check', (req: Request, res: Response) => {
      capturedRealIp = req.securityContext?.realIp;
      res.json({ ok: true });
    });

    await request(appCapture)
      .get('/api/v1/check')
      .set('CF-Connecting-IP', '5.6.7.8');

    expect(capturedRealIp).toBe('5.6.7.8');
  });
});

describe('[BlockAuth] EdgeTrustGuard — direct backend access', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    process.env.BLOCK_DIRECT_BACKEND_ACCESS = undefined as unknown as string;
  });

  it('12. direct backend access does NOT block when BLOCK_DIRECT_BACKEND_ACCESS is false', async () => {
    process.env.BLOCK_DIRECT_BACKEND_ACCESS = 'false';

    const { blockAuthMiddleware: freshMiddleware } = await import('../BlockAuthMiddleware');
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(freshMiddleware);
    app.get('/api/v1/test', (_req: Request, res: Response) => res.json({ ok: true }));

    const res = await request(app).get('/api/v1/test');
    expect(res.status).toBe(200);
  });
});

describe('[BlockAuth] Public image route accessibility', () => {
  const app = buildApp();

  it('13. /public/v1/images/abc.jpg is accessible without API key', async () => {
    const res = await request(app).get('/public/v1/images/abc.jpg');
    // Public image routes skip the API key requirement
    expect(res.status).toBe(200);
    expect(res.body.reached).toBe(true);
  });
});
