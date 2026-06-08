import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import queueRoutes from './queue.routes';
import config from '@config/config';
import Empresa from '@modules/empresas/Empresa';
import PiGenJob from '../../../models/PiGenJob';

let mongo: MongoMemoryServer;
let app: express.Application;

const tenantA = new Types.ObjectId().toString();
const tenantB = new Types.ObjectId().toString();

function bearer(token: string) {
  return `Bearer ${token}`;
}

function token(input: { empresaId?: string; role?: string; email?: string }) {
  return jwt.sign(
    {
      id: new Types.ObjectId().toString(),
      empresaId: input.empresaId,
      role: input.role ?? 'admin_empresa',
      email: input.email ?? 'queue@inmidia.com',
      username: 'queue-test',
    },
    config.jwtSecret,
    { expiresIn: '1h' },
  );
}

async function ensureEmpresa(id: string) {
  await Empresa.create({
    _id: new Types.ObjectId(id),
    nome: `Empresa ${id.slice(-4)}`,
    cnpj: `${Date.now()}${id.slice(-6)}`.slice(0, 14).padEnd(14, '0'),
  });
}

describe('queue routes tenant/RBAC hardening', () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());

    app = express();
    app.use(express.json());
    app.use('/api/v1/queue', queueRoutes);
    app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(err.statusCode ?? 500).json({ success: false, message: err.message });
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  beforeEach(async () => {
    await Empresa.deleteMany({});
    await PiGenJob.deleteMany({});
    await ensureEmpresa(tenantA);
    await ensureEmpresa(tenantB);
  });

  it('rota sem tenant falha', async () => {
    const res = await request(app)
      .get('/api/v1/queue/jobs')
      .set('Authorization', bearer(token({ empresaId: undefined, role: 'admin_empresa' })));

    expect([401, 403]).toContain(res.status);
  });

  it('rota sem permissao de export falha', async () => {
    const contratoId = new Types.ObjectId().toString();

    const res = await request(app)
      .post(`/api/v1/queue/contratos/${contratoId}/generate-pdf`)
      .set('Authorization', bearer(token({ empresaId: tenantA, role: 'visualizador' })));

    expect(res.status).toBe(403);
  });

  it('tenant A nao acessa job/output do tenant B', async () => {
    await PiGenJob.create({
      jobId: 'job-tenant-b',
      type: 'pi',
      empresaId: new Types.ObjectId(tenantB),
      status: 'done',
      resultPath: 'G:/tmp/outro-tenant.pdf',
      resultUrl: '/private/outro-tenant.pdf',
    });

    const tokenA = bearer(token({ empresaId: tenantA, role: 'admin_empresa' }));

    const statusRes = await request(app)
      .get('/api/v1/queue/jobs/job-tenant-b')
      .set('Authorization', tokenA);
    expect(statusRes.status).toBe(404);

    const downloadRes = await request(app)
      .get('/api/v1/queue/jobs/job-tenant-b/download')
      .set('Authorization', tokenA);
    expect(downloadRes.status).toBe(404);

    const listRes = await request(app)
      .get('/api/v1/queue/jobs')
      .set('Authorization', tokenA);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(0);
  });
});
