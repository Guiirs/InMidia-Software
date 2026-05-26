/**
 * Tests for PIService action methods — FASE 2.2
 * Covers: approve, reject, cancel, generateContractFromPI
 */
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import PropostaInterna from '@modules/propostas-internas/PropostaInterna';
import Placa from '@modules/placas/Placa';
import { temporalEngine, TemporalReservation } from '@modules/temporal';
import PIService from '@modules/propostas-internas/pi.service';

const future = (days = 30) => new Date(Date.now() + days * 86_400_000);

describe('PIService — ações de workflow', () => {
  let mongo: MongoMemoryServer;
  let empresaId: string;
  let clienteId: string;
  let userId: string;
  let service: PIService;

  async function createPlate() {
    const regiaoId = new Types.ObjectId();
    return Placa.create({
      numero_placa: `T-${new Types.ObjectId().toString().slice(-6)}`,
      disponivel: true,
      empresaId,
      regiaoId,
    });
  }

  async function createPI(status: string, overrides: Record<string, unknown> = {}) {
    return PropostaInterna.create({
      empresaId,
      clienteId,
      pi_code: `PI-${new Types.ObjectId().toString().slice(-6)}`,
      periodType: 'custom',
      startDate: future(1),
      endDate:   future(30),
      dataInicio: future(1),
      dataFim:   future(30),
      valorTotal: 5000,
      descricao: 'PI de teste',
      status,
      ...overrides,
    });
  }

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    service = new PIService();
  });

  beforeEach(async () => {
    empresaId = new Types.ObjectId().toString();
    clienteId = new Types.ObjectId().toString();
    userId    = new Types.ObjectId().toString();
    await mongoose.connection.dropDatabase();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  // ── approve ──────────────────────────────────────────────────────────────

  describe('approve()', () => {
    it('aprova PI DRAFT e muda status para APPROVED', async () => {
      const pi = await createPI('DRAFT');
      const result = await service.approve(String(pi._id), empresaId, userId);
      expect(result.status).toBe('APPROVED');
    });

    it('aprova PI PENDING_APPROVAL', async () => {
      const pi = await createPI('PENDING_APPROVAL');
      const result = await service.approve(String(pi._id), empresaId, userId);
      expect(result.status).toBe('APPROVED');
    });

    it('lanca erro ao aprovar PI ja APPROVED', async () => {
      const pi = await createPI('APPROVED');
      await expect(service.approve(String(pi._id), empresaId, userId))
        .rejects.toThrow(/400|status atual/i);
    });

    it('lanca erro ao aprovar PI CANCELLED', async () => {
      const pi = await createPI('CANCELLED');
      await expect(service.approve(String(pi._id), empresaId, userId))
        .rejects.toThrow(/400|status atual/i);
    });

    it('lanca erro ao aprovar PI REJECTED', async () => {
      const pi = await createPI('REJECTED');
      await expect(service.approve(String(pi._id), empresaId, userId))
        .rejects.toThrow(/400|status atual/i);
    });

    it('lanca 404 quando PI nao existe', async () => {
      const fakeId = new Types.ObjectId().toString();
      await expect(service.approve(fakeId, empresaId, userId))
        .rejects.toThrow(/404|não encontrada/i);
    });

    it('cria reserva temporal ao aprovar PI com placas', async () => {
      const plate = await createPlate();
      const pi = await createPI('DRAFT', { placas: [plate._id] });

      await service.approve(String(pi._id), empresaId, userId);

      const reservation = await TemporalReservation.findOne({
        sourceType: 'PI',
        sourceId: String(pi._id),
        status: 'RESERVED',
      }).lean();
      expect(reservation).not.toBeNull();
    });

    it('bloqueia aprovacao quando placa ja esta reservada por outra PI', async () => {
      const plate = await createPlate();

      // Reserve the plate with another PI
      await temporalEngine.createTemporalReservation({
        empresaId,
        plateId: String(plate._id),
        sourceType: 'PI',
        sourceId: 'OTHER-PI',
        customerId: clienteId,
        startDate: future(1),
        endDate: future(30),
      });

      const pi = await createPI('DRAFT', { placas: [plate._id] });

      await expect(service.approve(String(pi._id), empresaId, userId))
        .rejects.toThrow();
    });
  });

  // ── reject ───────────────────────────────────────────────────────────────

  describe('reject()', () => {
    it('rejeita PI DRAFT e muda status para REJECTED', async () => {
      const pi = await createPI('DRAFT');
      const result = await service.reject(String(pi._id), empresaId, userId);
      expect(result.status).toBe('REJECTED');
    });

    it('rejeita PI PENDING_APPROVAL', async () => {
      const pi = await createPI('PENDING_APPROVAL');
      const result = await service.reject(String(pi._id), empresaId, userId);
      expect(result.status).toBe('REJECTED');
    });

    it('lanca erro ao rejeitar PI APPROVED', async () => {
      const pi = await createPI('APPROVED');
      await expect(service.reject(String(pi._id), empresaId, userId))
        .rejects.toThrow(/400|status atual/i);
    });

    it('cancela reservas temporais ao rejeitar', async () => {
      const plate = await createPlate();
      const pi = await createPI('DRAFT', { placas: [plate._id] });

      await temporalEngine.createTemporalReservation({
        empresaId,
        plateId: String(plate._id),
        sourceType: 'PI',
        sourceId: String(pi._id),
        customerId: clienteId,
        startDate: future(1),
        endDate: future(30),
      });

      await service.reject(String(pi._id), empresaId, userId);

      const reservation = await TemporalReservation.findOne({
        sourceType: 'PI',
        sourceId: String(pi._id),
      }).lean();
      expect(reservation?.status).toBe('CANCELLED');
    });
  });

  // ── cancel ───────────────────────────────────────────────────────────────

  describe('cancel()', () => {
    it('cancela PI APPROVED e muda status para CANCELLED', async () => {
      const pi = await createPI('APPROVED');
      const result = await service.cancel(String(pi._id), empresaId, userId);
      expect(result.status).toBe('CANCELLED');
    });

    it('cancela PI DRAFT', async () => {
      const pi = await createPI('DRAFT');
      const result = await service.cancel(String(pi._id), empresaId, userId);
      expect(result.status).toBe('CANCELLED');
    });

    it('lanca erro ao cancelar PI CONTRACT_GENERATED', async () => {
      const pi = await createPI('CONTRACT_GENERATED');
      await expect(service.cancel(String(pi._id), empresaId, userId))
        .rejects.toThrow(/400|contrato gerado/i);
    });

    it('lanca erro ao cancelar PI ja CANCELLED', async () => {
      const pi = await createPI('CANCELLED');
      await expect(service.cancel(String(pi._id), empresaId, userId))
        .rejects.toThrow(/400|cancelada/i);
    });

    it('cancela reservas temporais ao cancelar PI APPROVED', async () => {
      const plate = await createPlate();
      const pi = await createPI('APPROVED', { placas: [plate._id] });

      await temporalEngine.createTemporalReservation({
        empresaId,
        plateId: String(plate._id),
        sourceType: 'PI',
        sourceId: String(pi._id),
        customerId: clienteId,
        startDate: future(1),
        endDate: future(30),
      });

      await service.cancel(String(pi._id), empresaId, userId);

      const reservation = await TemporalReservation.findOne({
        sourceType: 'PI',
        sourceId: String(pi._id),
      }).lean();
      expect(reservation?.status).toBe('CANCELLED');
    });
  });

  // ── generateContractFromPI ───────────────────────────────────────────────

  describe('generateContractFromPI()', () => {
    it('gera contrato de PI APPROVED e muda status para CONTRACT_GENERATED', async () => {
      const pi = await createPI('APPROVED');

      const contrato = await service.generateContractFromPI(String(pi._id), empresaId);
      expect(contrato).toBeDefined();

      const updated = await PropostaInterna.findById(pi._id).lean();
      expect(updated?.status).toBe('CONTRACT_GENERATED');
    });

    it('lanca erro quando PI nao e APPROVED', async () => {
      const pi = await createPI('DRAFT');
      await expect(service.generateContractFromPI(String(pi._id), empresaId))
        .rejects.toThrow(/400|APPROVED/i);
    });

    it('lanca 409 quando contrato ja existe para a PI', async () => {
      const pi = await createPI('APPROVED');

      // Generate once
      await service.generateContractFromPI(String(pi._id), empresaId);

      // PI is now CONTRACT_GENERATED, but test the duplicate check
      // by manually setting status back and trying again (simulates race)
      await PropostaInterna.updateOne({ _id: pi._id }, { $set: { status: 'APPROVED' } });

      await expect(service.generateContractFromPI(String(pi._id), empresaId))
        .rejects.toThrow(/409|contrato.*gerado/i);
    });

    it('promove reservas PI -> CONTRACT no Temporal Engine', async () => {
      const plate = await createPlate();
      const pi = await createPI('APPROVED', { placas: [plate._id] });

      // Create PI reservation
      await temporalEngine.createTemporalReservation({
        empresaId,
        plateId: String(plate._id),
        sourceType: 'PI',
        sourceId: String(pi._id),
        customerId: clienteId,
        startDate: future(1),
        endDate: future(30),
      });

      const contrato = await service.generateContractFromPI(String(pi._id), empresaId);

      const contractReservation = await TemporalReservation.findOne({
        sourceType: 'CONTRACT',
        sourceId: String(contrato._id),
        status: 'ACTIVE',
      }).lean();
      expect(contractReservation).not.toBeNull();
    });

    it('contrato gerado herda empresaId, clienteId e piId da PI', async () => {
      const pi = await createPI('APPROVED');
      const contrato = await service.generateContractFromPI(String(pi._id), empresaId);

      // Read raw from DB to avoid populated-object confusion
      const ContratoModel = (await import('@modules/contratos/Contrato')).default;
      const raw = await ContratoModel.findById(contrato._id).lean() as any;
      expect(String(raw.empresaId)).toBe(empresaId);
      expect(String(raw.clienteId)).toBe(clienteId);
      expect(String(raw.piId)).toBe(String(pi._id));
    });
  });
});
