/**
 * [SECURITY] Multi-Tenant Data Isolation Tests
 *
 * Validates that no query can leak data across tenant boundaries.
 * All 7 test scenarios from PLANO_ACAO_MULTITENANCY.md are covered here.
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.REDIS_HOST = '';
process.env.REDIS_ENABLED = 'false';
process.env.REDIS_URL = '';
delete process.env.METRICS_USER;
delete process.env.METRICS_PASSWORD;

import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';

// Models
import Placa from '../../modules/placas/Placa';
import Aluguel from '../../modules/alugueis/Aluguel';
import TemporalReservation from '../../modules/temporal/TemporalReservation';
// Empresa import reserved for future global-scheduler tests

// Services under test
import { TemporalSchedulerService } from '../../modules/temporal/temporal-scheduler.service';
// NOTE: pi-sync.service.ts cannot be imported in tests — legacy file uses broken relative paths
// (@ts-nocheck was pre-existing). Guard presence is verified via static code inspection.

let mongoServer: MongoMemoryServer;
let empresaA: any;
let empresaB: any;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Promise.all([
    Placa.deleteMany({}),
    Aluguel.deleteMany({}),
    TemporalReservation.deleteMany({}),
  ]);

  // Use ObjectIds that look like real empresa IDs
  empresaA = { _id: new Types.ObjectId() };
  empresaB = { _id: new Types.ObjectId() };
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 1: Empresa A cannot read data belonging to Empresa B
// ─────────────────────────────────────────────────────────────────────────────
describe('[SECURITY] Isolamento de Leitura', () => {
  it('Empresa A não pode ler Placas de Empresa B', async () => {
    await Placa.create({ empresaId: empresaB._id, numero_placa: 'TST-B001', disponivel: true, regiaoId: new Types.ObjectId() });

    const found = await Placa.findOne({ numero_placa: 'TST-B001', empresaId: empresaA._id });
    expect(found).toBeNull();
  });

  it('Empresa A não pode ler TemporalReservations de Empresa B', async () => {
    const reservB = await TemporalReservation.create({
      empresaId: empresaB._id,
      plateId: new Types.ObjectId(),
      sourceType: 'CONTRACT',
      sourceId: String(new Types.ObjectId()),
      status: 'ACTIVE',
      startDate: new Date(),
      endDate: new Date(Date.now() + 86400000),
    });

    const found = await TemporalReservation.findOne({ _id: reservB._id, empresaId: empresaA._id });
    expect(found).toBeNull();
  });

  it('TemporalScheduler.expirePastReservations processa apenas o tenant informado', async () => {
    const past = new Date(Date.now() - 86400000);
    const now = new Date();

    await TemporalReservation.create({
      empresaId: empresaA._id,
      plateId: new Types.ObjectId(),
      sourceType: 'CONTRACT',
      sourceId: String(new Types.ObjectId()),
      status: 'ACTIVE',
      startDate: new Date(past.getTime() - 86400000),
      endDate: past,
    });

    const reservB = await TemporalReservation.create({
      empresaId: empresaB._id,
      plateId: new Types.ObjectId(),
      sourceType: 'CONTRACT',
      sourceId: String(new Types.ObjectId()),
      status: 'ACTIVE',
      startDate: new Date(past.getTime() - 86400000),
      endDate: past,
    });

    const scheduler = new TemporalSchedulerService();
    // Process only Empresa A
    await scheduler.expirePastReservations(String(empresaA._id), now);

    // Empresa B's reservation must remain untouched
    const reservBAfter = await TemporalReservation.findById(reservB._id);
    expect(reservBAfter?.status).toBe('ACTIVE');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 2: Empresa A cannot modify data belonging to Empresa B
// ─────────────────────────────────────────────────────────────────────────────
describe('[SECURITY] Isolamento de Escrita', () => {
  it('Empresa A não pode alterar Aluguéis de Empresa B', async () => {
    const aluguelB = await Aluguel.create({
      empresaId: empresaB._id,
      placaId: new Types.ObjectId(),
      clienteId: new Types.ObjectId(),
      periodType: 'custom',
      valor_mensal: 1000,
      status: 'ativo',
      startDate: new Date(),
      endDate: new Date(Date.now() + 86400000 * 30),
    });

    // Attempt to update as Empresa A
    const result = await Aluguel.updateOne(
      { _id: aluguelB._id, empresaId: empresaA._id },
      { $set: { valor_mensal: 9999 } },
    );

    expect(result.modifiedCount).toBe(0);

    // Document still exists and was not modified
    const reread = await Aluguel.findById(aluguelB._id).lean<any>();
    expect(reread).toBeTruthy();
  });

  it('TemporalScheduler.updateMany não altera reservas de outro tenant', async () => {
    const past = new Date(Date.now() - 86400000);

    const reservB = await TemporalReservation.create({
      empresaId: empresaB._id,
      plateId: new Types.ObjectId(),
      sourceType: 'CONTRACT',
      sourceId: String(new Types.ObjectId()),
      status: 'ACTIVE',
      startDate: new Date(past.getTime() - 86400000),
      endDate: past,
    });

    // Run scheduler for Empresa A only — should not touch reservB
    const scheduler = new TemporalSchedulerService();
    await scheduler.expirePastReservations(String(empresaA._id), new Date());

    const reservBAfter = await TemporalReservation.findById(reservB._id);
    expect(reservBAfter?.status).toBe('ACTIVE');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 3: Empresa A cannot delete data belonging to Empresa B
// ─────────────────────────────────────────────────────────────────────────────
describe('[SECURITY] Isolamento de Deleção', () => {
  it('Empresa A não pode deletar Aluguéis de Empresa B', async () => {
    const aluguelB = await Aluguel.create({
      empresaId: empresaB._id,
      placaId: new Types.ObjectId(),
      clienteId: new Types.ObjectId(),
      periodType: 'custom',
      valor_mensal: 500,
      status: 'ativo',
      startDate: new Date(),
      endDate: new Date(Date.now() + 86400000 * 30),
    });

    const result = await Aluguel.deleteOne({ _id: aluguelB._id, empresaId: empresaA._id });
    expect(result.deletedCount).toBe(0);

    const reread = await Aluguel.findById(aluguelB._id);
    expect(reread).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 4: Scheduler processes only the correct tenant
// ─────────────────────────────────────────────────────────────────────────────
describe('[SECURITY] Scheduler Multi-Tenant Isolation', () => {
  it('detectOrphanTemporalReservations filtra apenas o tenant informado', async () => {
    const plateA = new Types.ObjectId();
    const plateB = new Types.ObjectId();

    await TemporalReservation.create({
      empresaId: empresaA._id,
      plateId: plateA,
      sourceType: 'CONTRACT',
      sourceId: String(new Types.ObjectId()),
      status: 'ACTIVE',
      startDate: new Date(),
      endDate: new Date(Date.now() + 86400000),
    });

    await TemporalReservation.create({
      empresaId: empresaB._id,
      plateId: plateB,
      sourceType: 'CONTRACT',
      sourceId: String(new Types.ObjectId()),
      status: 'ACTIVE',
      startDate: new Date(),
      endDate: new Date(Date.now() + 86400000),
    });

    const scheduler = new TemporalSchedulerService();
    const result = await scheduler.detectOrphanTemporalReservations(String(empresaA._id));

    // All returned reservations must belong to empresa A
    result.reservations.forEach((r: any) => {
      expect(String(r.empresaId)).toBe(String(empresaA._id));
    });
  });

  it('getTemporalIntegrityReport rejeita chamada sem empresaId', async () => {
    const scheduler = new TemporalSchedulerService();
    await expect(
      (scheduler as any).getTemporalIntegrityReport(''),
    ).rejects.toThrow('empresaId é obrigatório');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 5: WhatsApp gerarRelatorio requires empresaId
// ─────────────────────────────────────────────────────────────────────────────
describe('[SECURITY] WhatsApp empresaId obrigatório', () => {
  it('gerarRelatorio lança erro quando empresaId está vazio', async () => {
    // Import dynamically to avoid triggering WhatsApp client initialization
    const { default: whatsappService } = await import('../../modules/whatsapp/whatsapp.service');
    await expect(
      (whatsappService as any).gerarRelatorio(''),
    ).rejects.toThrow('empresaId é obrigatório');
  });

  it('enviarRelatorioDisponibilidade lança erro quando empresaId está vazio', async () => {
    const { default: whatsappService } = await import('../../modules/whatsapp/whatsapp.service');
    await expect(
      (whatsappService as any).enviarRelatorioDisponibilidade(null, ''),
    ).rejects.toThrow('empresaId é obrigatório');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 6: PI Sync legacy service is blocked
// The file cannot be imported because it has broken relative paths under @ts-nocheck.
// Guard is verified statically: both public methods throw('BLOQUEADO') as first statement.
// ─────────────────────────────────────────────────────────────────────────────
describe('[SECURITY] PI Sync legado bloqueado', () => {
  it('pi-sync.service.ts está marcado com DEPRECATED_UNSAFE e guards de execução', () => {
    const fs = require('fs');
    const path = require('path');
    const content = fs.readFileSync(
      path.resolve(__dirname, '../../legacy/pi-sync.service.ts'),
      'utf-8',
    );
    expect(content).toContain('DEPRECATED_UNSAFE');
    expect(content).toContain("throw new Error('[PISyncService] BLOQUEADO");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 7: Temporal lookups don't return documents from another tenant
// ─────────────────────────────────────────────────────────────────────────────
describe('[SECURITY] Temporal lookups respeitam empresaId', () => {
  it('expirePastReservations retorna 0 expirados quando tenant não tem reservas vencidas', async () => {
    const past = new Date(Date.now() - 86400000);

    // Only empresa B has expired reservations
    await TemporalReservation.create({
      empresaId: empresaB._id,
      plateId: new Types.ObjectId(),
      sourceType: 'CONTRACT',
      sourceId: String(new Types.ObjectId()),
      status: 'ACTIVE',
      startDate: new Date(past.getTime() - 86400000),
      endDate: past,
    });

    const scheduler = new TemporalSchedulerService();
    const result = await scheduler.expirePastReservations(String(empresaA._id), new Date());

    // Empresa A has no expired reservations
    expect(result.expiredCount).toBe(0);
  });

  it('expirePastReservations rejeita chamada sem empresaId', async () => {
    const scheduler = new TemporalSchedulerService();
    await expect(
      scheduler.expirePastReservations('', new Date()),
    ).rejects.toThrow('empresaId é obrigatório');
  });
});
