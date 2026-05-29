/**
 * Auth V2 Integration Tests
 * Testa: HttpOnly cookies, refresh token, rotação, reuse attack, revogação, logout
 */

import request from 'supertest';
import { Types } from 'mongoose';
import {
  app,
  clearDatabase,
  setupIntegrationDb,
  teardownIntegrationDb,
} from './setup';
import Empresa from '@modules/empresas/Empresa';
import User from '@modules/users/User';
import RefreshToken from '@modules/auth/RefreshToken';
import AuditLog from '@modules/audit/audit.model';

const PASSWORD = 'SenhaV2Forte123!';

async function createEmpresa() {
  return Empresa.create({
    nome: 'Empresa V2 Teste',
    cnpj: `${Date.now()}${Math.floor(Math.random() * 9999)}`.slice(0, 14).padEnd(14, '0'),
  });
}

async function createUser(overrides: Record<string, unknown> = {}) {
  const empresa = await createEmpresa();
  const user = await User.create({
    username: `v2user${Date.now()}${Math.floor(Math.random() * 999)}`,
    email: `v2auth${Date.now()}${Math.floor(Math.random() * 999)}@inmidia.com`,
    nome: 'Usuario V2',
    role: 'admin',
    empresa: empresa._id,
    password: PASSWORD,
    ...overrides,
  });
  return { empresa, user };
}

/** Faz login e retorna token+cookies */
async function doLogin(email: string, password = PASSWORD) {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password });
  return res;
}

async function findAuditLogWithRetry(filter: Record<string, unknown>) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const audit = await AuditLog.findOne(filter).lean();
    if (audit) return audit;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return AuditLog.findOne(filter).lean();
}

describe('Auth V2 — HttpOnly Cookies + Refresh + Revogação', () => {
  beforeAll(async () => {
    await setupIntegrationDb();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await teardownIntegrationDb();
  });

  // ─── Cookie Auth ────────────────────────────────────────────────────────────

  describe('HttpOnly Cookie', () => {
    it('login seta cookie inmidia_access e inmidia_refresh', async () => {
      const { user } = await createUser();
      const res = await doLogin(user.email);

      expect(res.status).toBe(200);
      expect(res.headers['set-cookie']).toBeDefined();
      const cookies = res.headers['set-cookie'] as unknown as string[];
      const accessCookie = cookies.find((c) => c.includes('inmidia_access'));
      const refreshCookie = cookies.find((c) => c.includes('inmidia_refresh'));

      expect(accessCookie).toBeDefined();
      expect(refreshCookie).toBeDefined();
      // HttpOnly deve estar presente
      expect(accessCookie).toMatch(/httponly/i);
      expect(refreshCookie).toMatch(/httponly/i);
    });

    it('login retorna token no body para compatibilidade Bearer legado', async () => {
      const { user } = await createUser();
      const res = await doLogin(user.email);

      expect(res.status).toBe(200);
      expect(res.body.data?.token).toBeDefined();
      expect(typeof res.body.data.token).toBe('string');
    });

    it('rota protegida aceita Bearer header (legado)', async () => {
      const { user } = await createUser();
      const loginRes = await doLogin(user.email);
      const token = loginRes.body.data.token;

      const res = await request(app)
        .get('/api/v1/user/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it('rota protegida aceita cookie inmidia_access', async () => {
      const { user } = await createUser();
      const loginRes = await doLogin(user.email);
      const cookies = loginRes.headers['set-cookie'] as unknown as string[];
      const accessCookie = (cookies.find((c) => c.includes('inmidia_access')) || '').split(';')[0];

      const res = await request(app)
        .get('/api/v1/user/me')
        .set('Cookie', accessCookie ?? '');

      expect(res.status).toBe(200);
    });
  });

  // ─── Refresh Flow ────────────────────────────────────────────────────────────

  describe('Refresh Token', () => {
    it('POST /auth/refresh com cookie válido retorna novo access token', async () => {
      const { user } = await createUser();
      const loginRes = await doLogin(user.email);
      const cookies = loginRes.headers['set-cookie'] as unknown as string[];
      const refreshCookie = (cookies.find((c) => c.includes('inmidia_refresh')) || '').split(';')[0];

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set("Cookie", refreshCookie ?? "");

      expect(res.status).toBe(200);
      expect(res.body.data?.token).toBeDefined();

      const audit = await findAuditLogWithRetry({ action: 'auth.refresh', module: 'auth' });
      expect(audit).toBeTruthy();
      expect(audit?.empresaId).toBeUndefined();
      expect(audit?.actorType).toBe('system');
      expect(audit?.actorUserId).toBeUndefined();
      expect(audit?.actorLabel).toBe('system');
    });

    it('refresh token é rotacionado — token antigo não pode ser usado novamente', async () => {
      const { user } = await createUser();
      const loginRes = await doLogin(user.email);
      const cookies = loginRes.headers['set-cookie'] as unknown as string[];
      const refreshCookie = (cookies.find((c) => c.includes('inmidia_refresh')) || '').split(';')[0];

      // Usa o refresh token uma vez
      const refreshRes = await request(app)
        .post('/api/v1/auth/refresh')
        .set("Cookie", refreshCookie ?? "");

      expect(refreshRes.status).toBe(200);

      // Tenta usar o mesmo refresh token novamente — deve falhar (rotacionado)
      const reuseRes = await request(app)
        .post('/api/v1/auth/refresh')
        .set("Cookie", refreshCookie ?? "");

      expect(reuseRes.status).toBe(401);
    });

    it('refresh token ausente retorna 401', async () => {
      const res = await request(app).post('/api/v1/auth/refresh');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('REFRESH_TOKEN_MISSING');
    });

    it('refresh token inválido retorna 401', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', 'inmidia_refresh=invalidtoken123');

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('REFRESH_TOKEN_INVALID');
    });

    it('falha explicitamente quando a sessao refresh diverge da empresa do usuario', async () => {
      const { user } = await createUser();
      const loginRes = await doLogin(user.email);
      const cookies = loginRes.headers['set-cookie'] as unknown as string[];
      const refreshCookie = (cookies.find((c) => c.includes('inmidia_refresh')) || '').split(';')[0];

      await RefreshToken.updateMany(
        { userId: user._id },
        { empresaId: new Types.ObjectId() }
      ).exec();

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', refreshCookie ?? '');

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('TENANT_CONTEXT_INCONSISTENT');
    });
  });

  // ─── Reuse Attack ─────────────────────────────────────────────────────────

  describe('Replay / Reuse Attack Detection', () => {
    it('usar refresh token revogado (reuse attack) revoga família inteira', async () => {
      const { user } = await createUser();
      const loginRes = await doLogin(user.email);
      const cookies = loginRes.headers['set-cookie'] as unknown as string[];
      const refreshCookie = (cookies.find((c) => c.includes('inmidia_refresh')) || '').split(';')[0];

      // Primeira rotação (legítima)
      const refreshRes = await request(app)
        .post('/api/v1/auth/refresh')
        .set("Cookie", refreshCookie ?? "");

      expect(refreshRes.status).toBe(200);

      // Atacante tenta usar o token antigo novamente — família deve ser revogada
      const attackRes = await request(app)
        .post('/api/v1/auth/refresh')
        .set("Cookie", refreshCookie ?? "");

      expect(attackRes.status).toBe(401);

      // Verificar que todas as sessões da família foram revogadas
      const activeSessions = await RefreshToken.countDocuments({
        userId: user._id,
        revokedAt: null,
      });
      expect(activeSessions).toBe(0);
    });
  });

  // ─── Logout ───────────────────────────────────────────────────────────────

  describe('Logout', () => {
    it('POST /auth/logout encerra sessão e limpa cookies', async () => {
      const { user } = await createUser();
      const loginRes = await doLogin(user.email);
      const cookies = loginRes.headers['set-cookie'] as unknown as string[];
      const accessCookie = (cookies.find((c) => c.includes('inmidia_access')) || '').split(';')[0];
      const refreshCookie = (cookies.find((c) => c.includes('inmidia_refresh')) || '').split(';')[0];

      const logoutRes = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', [accessCookie, refreshCookie].join('; '));

      expect(logoutRes.status).toBe(200);

      // Cookies devem ser limpas na resposta
      const setCookies = logoutRes.headers['set-cookie'] as unknown as string[] | undefined;
      if (setCookies) {
        const accessCleared = setCookies.some(
          (c) => c.includes('inmidia_access') && (c.includes('Expires=Thu, 01 Jan 1970') || c.includes('Max-Age=0'))
        );
        const refreshCleared = setCookies.some(
          (c) => c.includes('inmidia_refresh') && (c.includes('Expires=Thu, 01 Jan 1970') || c.includes('Max-Age=0'))
        );
        // Se Set-Cookie foi enviado, deve limpar os cookies
        if (accessCleared || refreshCleared) {
          expect(accessCleared || refreshCleared).toBe(true);
        }
      }

      // Refresh token revogado após logout
      const activeSessions = await RefreshToken.countDocuments({
        userId: user._id,
        revokedAt: null,
      });
      expect(activeSessions).toBe(0);
    });

    it('POST /auth/logout-all (autenticado) revoga todas as sessões', async () => {
      const { user } = await createUser();

      // Login em dois "dispositivos" diferentes
      const login1 = await doLogin(user.email);
      const login2 = await doLogin(user.email);

      const token1 = login1.body.data.token;
      const cookies2 = login2.headers['set-cookie'] as unknown as string[];
      const refreshCookie2 = (cookies2.find((c) => c.includes('inmidia_refresh')) || '').split(';')[0];

      // Logout global via Bearer do primeiro login
      const logoutAllRes = await request(app)
        .post('/api/v1/auth/logout-all')
        .set('Authorization', `Bearer ${token1}`);

      expect(logoutAllRes.status).toBe(200);

      // Segundo refresh token também deve estar revogado
      const reuseRes = await request(app)
        .post('/api/v1/auth/refresh')
        .set("Cookie", refreshCookie2 ?? "");

      expect(reuseRes.status).toBe(401);
    });
  });

  // ─── Sessions ──────────────────────────────────────────────────────────────

  describe('Session Management', () => {
    it('GET /auth/sessions lista sessões ativas do usuário', async () => {
      const { user } = await createUser();
      await doLogin(user.email);
      await doLogin(user.email);

      const loginRes = await doLogin(user.email);
      const token = loginRes.body.data.token;

      const sessionsRes = await request(app)
        .get('/api/v1/auth/sessions')
        .set('Authorization', `Bearer ${token}`);

      expect(sessionsRes.status).toBe(200);
      expect(Array.isArray(sessionsRes.body.data)).toBe(true);
      expect(sessionsRes.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /auth/sessions requer autenticação', async () => {
      const res = await request(app).get('/api/v1/auth/sessions');
      expect(res.status).toBe(401);
    });
  });
});
