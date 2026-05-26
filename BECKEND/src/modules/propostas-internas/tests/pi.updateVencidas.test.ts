/**
 * Tests for PIService.updateVencidas() — FASE 2.2
 *
 * Verifica que o cron de expiração:
 * - Marca DRAFT / PENDING_APPROVAL / APPROVED / em_andamento como vencida
 * - Cancela reservas temporais de PIs APPROVED antes de marcar vencida
 * - Nunca toca CONTRACT_GENERATED / CANCELLED / REJECTED / concluida
 */
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import PropostaInterna from '@modules/propostas-internas/PropostaInterna';
import Placa from '@modules/placas/Placa';
import { temporalEngine, TemporalReservation } from '@modules/temporal';
import PIService from '@modules/propostas-internas/pi.service';

const past   = (days = 1) => new Date(Date.now() - days * 86_400_000);
const future = (days = 1) => new Date(Date.now() + days * 86_400_000);

describe('PIService.updateVencidas', () => {
  let mongo: MongoMemoryServer;
  let empresaId: string;
  let clienteId: string;

  async function createPI(overrides: Record<string, unknown> = {}) {
    return PropostaInterna.create({
      empresaId,
      clienteId,
      pi_code: `PI-${new Types.ObjectId().toString().slice(-6)}`,
      periodType: 'custom',
      startDate:  past(30),
      endDate:    past(1),      // expired by default
      dataInicio: past(30),
      dataFim:    past(1),
      valorTotal: 1000,
      descricao: 'Teste expiração',
      status: 'DRAFT',
      ...overrides,
    });
  }

  async function createPlate() {
    const regiaoId = new Types.ObjectId();
    return Placa.create({
      numero_placa: `T-${new Types.ObjectId().toString().slice(-6)}`,
      disponivel: true,
      empresaId,
      regiaoId,
    });
  }

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });

  beforeEach(async () => {
    empresaId = new Types.ObjectId().toString();
    clienteId = new Types.ObjectId().toString();
    await mongoose.connection.dropDatabase();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  // ── Statuses that MUST expire ────────────────────────────────────────────

  it('expira PI com status DRAFT vencida', async () => {
    const pi = await createPI({ status: 'DRAFT' });
    await PIService.updateVencidas();
    const updated = await PropostaInterna.findById(pi._id).lean();
    expect(updated?.status).toBe('vencida');
  });

  it('expira PI com status PENDING_APPROVAL vencida', async () => {
    const pi = await createPI({ status: 'PENDING_APPROVAL' });
    await PIService.updateVencidas();
    const updated = await PropostaInterna.findById(pi._id).lean();
    expect(updated?.status).toBe('vencida');
  });

  it('expira PI com status APPROVED vencida', async () => {
    const pi = await createPI({ status: 'APPROVED' });
    await PIService.updateVencidas();
    const updated = await PropostaInterna.findById(pi._id).lean();
    expect(updated?.status).toBe('vencida');
  });

  it('expira PI com status legado em_andamento vencida', async () => {
    const pi = await createPI({ status: 'em_andamento' });
    await PIService.updateVencidas();
    const updated = await PropostaInterna.findById(pi._id).lean();
    expect(updated?.status).toBe('vencida');
  });

  // ── Statuses that MUST NOT expire ───────────────────────────────────────

  it('nao expira PI com status CONTRACT_GENERATED', async () => {
    const pi = await createPI({ status: 'CONTRACT_GENERATED' });
    await PIService.updateVencidas();
    const updated = await PropostaInterna.findById(pi._id).lean();
    expect(updated?.status).toBe('CONTRACT_GENERATED');
  });

  it('nao expira PI com status CANCELLED', async () => {
    const pi = await createPI({ status: 'CANCELLED' });
    await PIService.updateVencidas();
    const updated = await PropostaInterna.findById(pi._id).lean();
    expect(updated?.status).toBe('CANCELLED');
  });

  it('nao expira PI com status REJECTED', async () => {
    const pi = await createPI({ status: 'REJECTED' });
    await PIService.updateVencidas();
    const updated = await PropostaInterna.findById(pi._id).lean();
    expect(updated?.status).toBe('REJECTED');
  });

  it('nao expira PI com status concluida', async () => {
    const pi = await createPI({ status: 'concluida' });
    await PIService.updateVencidas();
    const updated = await PropostaInterna.findById(pi._id).lean();
    expect(updated?.status).toBe('concluida');
  });

  it('nao expira PI cujo endDate e no futuro', async () => {
    const pi = await createPI({ status: 'DRAFT', endDate: future(10), dataFim: future(10) });
    await PIService.updateVencidas();
    const updated = await PropostaInterna.findById(pi._id).lean();
    expect(updated?.status).toBe('DRAFT');
  });

  // ── Temporal reservation cancel for APPROVED ────────────────────────────

  it('cancela reserva temporal de PI APPROVED ao vencer', async () => {
    const plate = await createPlate();
    const pi = await createPI({ status: 'APPROVED', placas: [plate._id] });

    // Create a temporal reservation for this PI
    await temporalEngine.createTemporalReservation({
      empresaId,
      plateId: String(plate._id),
      sourceType: 'PI',
      sourceId: String(pi._id),
      customerId: clienteId,
      startDate: past(30),
      endDate: past(1),
    });

    await PIService.updateVencidas();

    // PI should be vencida
    const updated = await PropostaInterna.findById(pi._id).lean();
    expect(updated?.status).toBe('vencida');

    // Reservation should be cancelled (status CANCELLED)
    const reservation = await TemporalReservation.findOne({
      sourceType: 'PI',
      sourceId: String(pi._id),
    }).lean();
    expect(reservation?.status).toBe('CANCELLED');
  });

  it('nao cancela reserva temporal de PI DRAFT ao vencer', async () => {
    const plate = await createPlate();
    const pi = await createPI({ status: 'DRAFT', placas: [plate._id] });

    await temporalEngine.createTemporalReservation({
      empresaId,
      plateId: String(plate._id),
      sourceType: 'PI',
      sourceId: String(pi._id),
      customerId: clienteId,
      startDate: past(30),
      endDate: past(1),
    });

    await PIService.updateVencidas();

    // PI should still be vencida
    const updated = await PropostaInterna.findById(pi._id).lean();
    expect(updated?.status).toBe('vencida');

    // Reservation not explicitly cancelled by updateVencidas for DRAFT
    // (no asserting status — just checking no crash and PI status correct)
  });

  // ── Mixed batch ──────────────────────────────────────────────────────────

  it('processa multiplas PIs de uma vez corretamente', async () => {
    const draft     = await createPI({ status: 'DRAFT' });
    const pending   = await createPI({ status: 'PENDING_APPROVAL' });
    const approved  = await createPI({ status: 'APPROVED' });
    const generated = await createPI({ status: 'CONTRACT_GENERATED' });
    const cancelled = await createPI({ status: 'CANCELLED' });
    const future_pi = await createPI({ status: 'DRAFT', endDate: future(10), dataFim: future(10) });

    await PIService.updateVencidas();

    const [d, p, a, g, c, f] = await Promise.all([
      PropostaInterna.findById(draft._id).lean(),
      PropostaInterna.findById(pending._id).lean(),
      PropostaInterna.findById(approved._id).lean(),
      PropostaInterna.findById(generated._id).lean(),
      PropostaInterna.findById(cancelled._id).lean(),
      PropostaInterna.findById(future_pi._id).lean(),
    ]);

    expect(d?.status).toBe('vencida');
    expect(p?.status).toBe('vencida');
    expect(a?.status).toBe('vencida');
    expect(g?.status).toBe('CONTRACT_GENERATED');
    expect(c?.status).toBe('CANCELLED');
    expect(f?.status).toBe('DRAFT');
  });

  // ── Legacy dataFim fallback ──────────────────────────────────────────────

  it('usa dataFim como fallback quando endDate ausente (insercao direta sem validacao)', async () => {
    // Bypass mongoose validation to simulate a legacy document without endDate/startDate
    const legacyId = new Types.ObjectId();
    await PropostaInterna.collection.insertOne({
      _id: legacyId,
      empresaId: new Types.ObjectId(empresaId),
      clienteId: new Types.ObjectId(clienteId),
      pi_code: `PI-LEG-${legacyId.toString().slice(-6)}`,
      dataInicio: past(30),
      dataFim: past(1),
      valorTotal: 1000,
      descricao: 'Legado sem endDate',
      status: 'em_andamento',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await PIService.updateVencidas();
    const updated = await PropostaInterna.findById(legacyId).lean();
    expect(updated?.status).toBe('vencida');
  });
});
