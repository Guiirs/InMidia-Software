import request from 'supertest';
import { Types } from 'mongoose';
import {
  app,
  setupIntegrationDb,
  clearDatabase,
  teardownIntegrationDb,
  createTestRegiao,
  generateTestToken,
  TEST_EMPRESA_ID,
} from './setup';
import AuditLog from '../../modules/audit/audit.model';
import { defaultAuditService } from '../../modules/audit/audit.service';

const EMPRESA_B_ID = new Types.ObjectId().toString();
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function findAuditLogWithRetry(filter: Record<string, unknown>) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const audit = await AuditLog.findOne(filter).lean();
    if (audit) return audit;
    await wait(25);
  }

  return AuditLog.findOne(filter).lean();
}

let gestorToken: string;
let vendedorToken: string;
let adminToken: string;
let superadminToken: string;

beforeAll(async () => {
  await setupIntegrationDb();
  gestorToken = generateTestToken({ role: 'gestor', email: 'gestor@inmidia.com' });
  vendedorToken = generateTestToken({ role: 'vendedor', email: 'vendedor@inmidia.com' });
  adminToken = generateTestToken({ role: 'admin_empresa', email: 'admin@inmidia.com' });
  superadminToken = generateTestToken({ role: 'superadmin', email: 'root@inmidia.com' });
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await teardownIntegrationDb();
});

describe('Audit integration', () => {
  it('cria audit log em acao de placa', async () => {
    const regiao = await createTestRegiao();

    const res = await request(app)
      .post('/api/v1/placas')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        numero_placa: 'AUD-001',
        regiao: regiao._id.toString(),
        regiaoId: regiao._id.toString(),
        localizacao: 'Rua Audit, 123',
      });

    expect(res.status).toBe(201);

    const audit = await findAuditLogWithRetry({
      module: 'placas',
      action: 'entity.created',
      entityLabel: 'AUD-001',
      empresaId: TEST_EMPRESA_ID,
    });

    expect(audit).toBeTruthy();
    expect(audit?.actorEmail).toBe('admin@inmidia.com');
  });

  it('isola auditoria por empresa e permite leitura global para superadmin', async () => {
    await defaultAuditService.recordAuditEvent({
      empresaId: TEST_EMPRESA_ID,
      action: 'entity.created',
      module: 'placas',
      entityType: 'placa',
      entityId: 'placa-a',
      entityLabel: 'A-ONLY',
    });
    await defaultAuditService.recordAuditEvent({
      empresaId: EMPRESA_B_ID,
      action: 'entity.created',
      module: 'placas',
      entityType: 'placa',
      entityId: 'placa-b',
      entityLabel: 'B-ONLY',
    });

    const tenantRes = await request(app)
      .get('/api/v1/audit')
      .set('Authorization', `Bearer ${gestorToken}`);

    expect(tenantRes.status).toBe(200);
    expect(tenantRes.body.data.map((event: any) => event.entityLabel)).toContain('A-ONLY');
    expect(tenantRes.body.data.map((event: any) => event.entityLabel)).not.toContain('B-ONLY');

    const superRes = await request(app)
      .get('/api/v1/audit')
      .set('Authorization', `Bearer ${superadminToken}`);

    expect(superRes.status).toBe(200);
    expect(superRes.body.data.map((event: any) => event.entityLabel)).toEqual(
      expect.arrayContaining(['A-ONLY', 'B-ONLY'])
    );
  });

  it('redige dados sensiveis antes de persistir', async () => {
    await defaultAuditService.recordAuditEvent({
      empresaId: TEST_EMPRESA_ID,
      action: 'entity.updated',
      module: 'admin',
      entityType: 'user',
      entityId: 'user-1',
      before: { email: 'user@inmidia.com', password: 'old-secret' },
      after: { email: 'user@inmidia.com', refreshToken: 'refresh-secret' },
      metadata: { authorization: 'Bearer jwt', reason: 'test' },
    });

    const res = await request(app)
      .get('/api/v1/audit?module=admin')
      .set('Authorization', `Bearer ${gestorToken}`);

    expect(res.status).toBe(200);
    const event = res.body.data[0];
    expect(JSON.stringify(event)).not.toContain('old-secret');
    expect(JSON.stringify(event)).not.toContain('refresh-secret');
    expect(JSON.stringify(event)).not.toContain('Bearer jwt');
    expect(event.after.email).toBe('user@inmidia.com');
  });

  it('exige permissao audit.read e registra acesso negado', async () => {
    const res = await request(app)
      .get('/api/v1/audit')
      .set('Authorization', `Bearer ${vendedorToken}`);

    expect(res.status).toBe(403);

    const denied = await AuditLog.findOne({
      action: 'permission.denied',
      entityId: 'audit.read',
      empresaId: TEST_EMPRESA_ID,
    }).lean();

    expect(denied).toBeTruthy();
  });

  it('aplica filtros de consulta e busca por entidade', async () => {
    await defaultAuditService.recordAuditEvent({
      empresaId: TEST_EMPRESA_ID,
      action: 'entity.updated',
      module: 'contratos',
      entityType: 'contrato',
      entityId: 'contrato-1',
      severity: 'warning',
    });
    await defaultAuditService.recordAuditEvent({
      empresaId: TEST_EMPRESA_ID,
      action: 'entity.created',
      module: 'placas',
      entityType: 'placa',
      entityId: 'placa-1',
      severity: 'info',
    });

    const filtered = await request(app)
      .get('/api/v1/audit?module=contratos&severity=warning')
      .set('Authorization', `Bearer ${gestorToken}`);

    expect(filtered.status).toBe(200);
    expect(filtered.body.data).toHaveLength(1);
    expect(filtered.body.data[0].entityId).toBe('contrato-1');

    const byEntity = await request(app)
      .get('/api/v1/audit/entity/contrato/contrato-1')
      .set('Authorization', `Bearer ${gestorToken}`);

    expect(byEntity.status).toBe(200);
    expect(byEntity.body.data).toHaveLength(1);
    expect(byEntity.body.data[0].module).toBe('contratos');
  });

  it('busca por entidade nao vaza evento da empresa B com mesmo entityId', async () => {
    await defaultAuditService.recordAuditEvent({
      empresaId: TEST_EMPRESA_ID,
      action: 'entity.updated',
      module: 'placas',
      entityType: 'placa',
      entityId: 'shared-placa',
      entityLabel: 'Placa A',
    });
    await defaultAuditService.recordAuditEvent({
      empresaId: EMPRESA_B_ID,
      action: 'entity.updated',
      module: 'placas',
      entityType: 'placa',
      entityId: 'shared-placa',
      entityLabel: 'Placa B',
    });

    const res = await request(app)
      .get('/api/v1/audit/entity/placa/shared-placa')
      .set('Authorization', `Bearer ${gestorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.map((event: any) => event.entityLabel)).toContain('Placa A');
    expect(res.body.data.map((event: any) => event.entityLabel)).not.toContain('Placa B');
  });
});
