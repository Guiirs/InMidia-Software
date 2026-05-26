import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Placa from '@modules/placas/Placa';
import PropostaInterna from '@modules/propostas-internas/PropostaInterna';
import { temporalEngine, TemporalReservation } from '@modules/temporal';

describe('TemporalEngineService', () => {
  let mongo: MongoMemoryServer;
  let empresaId: string;
  let regiaoId: string;
  let clienteId: string;

  const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

  async function createPlate(overrides: Record<string, unknown> = {}) {
    return Placa.create({
      numero_placa: `T-${new Types.ObjectId().toString().slice(-6)}`,
      disponivel: true,
      empresaId,
      regiaoId,
      ...overrides,
    });
  }

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });

  beforeEach(async () => {
    empresaId = new Types.ObjectId().toString();
    regiaoId = new Types.ObjectId().toString();
    clienteId = new Types.ObjectId().toString();
    await mongoose.connection.dropDatabase();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  it('permite reserva sem conflito', async () => {
    const plate = await createPlate();

    const reservation = await temporalEngine.createTemporalReservation({
      empresaId,
      plateId: String(plate._id),
      sourceType: 'PI',
      sourceId: 'PI-1',
      customerId: clienteId,
      startDate: date('2026-06-01'),
      endDate: date('2026-06-30'),
    });

    expect(reservation.status).toBe('RESERVED');
  });

  it('bloqueia reserva com sobreposicao', async () => {
    const plate = await createPlate();
    await temporalEngine.createTemporalReservation({
      empresaId,
      plateId: String(plate._id),
      sourceType: 'PI',
      sourceId: 'PI-1',
      startDate: date('2026-06-01'),
      endDate: date('2026-06-30'),
    });

    await expect(temporalEngine.createTemporalReservation({
      empresaId,
      plateId: String(plate._id),
      sourceType: 'PI',
      sourceId: 'PI-2',
      startDate: date('2026-06-15'),
      endDate: date('2026-07-10'),
    })).rejects.toThrow(/conflito|indisponivel/i);
  });

  it('permite reserva depois do fim de outra', async () => {
    const plate = await createPlate();
    await temporalEngine.createTemporalReservation({
      empresaId,
      plateId: String(plate._id),
      sourceType: 'PI',
      sourceId: 'PI-1',
      startDate: date('2026-06-01'),
      endDate: date('2026-06-30'),
    });

    const result = await temporalEngine.checkPlateAvailability(
      String(plate._id),
      date('2026-07-01'),
      date('2026-07-31'),
      { empresaId },
    );

    expect(result.available).toBe(true);
  });

  it('bloqueia alteracao critica de placa contratada', async () => {
    const plate = await createPlate();
    await temporalEngine.createTemporalReservation({
      empresaId,
      plateId: String(plate._id),
      sourceType: 'CONTRACT',
      sourceId: 'CONT-1',
      startDate: date('2026-05-01'),
      endDate: date('2026-06-30'),
      status: 'ACTIVE',
    });

    await expect(temporalEngine.assertPlateCanBeEdited(
      String(plate._id),
      ['numero_placa'],
      { empresaId },
    )).rejects.toThrow(/campos criticos/i);
  });

  it('permite alteracao nao critica', async () => {
    const plate = await createPlate();
    await temporalEngine.createTemporalReservation({
      empresaId,
      plateId: String(plate._id),
      sourceType: 'CONTRACT',
      sourceId: 'CONT-1',
      startDate: date('2026-05-01'),
      endDate: date('2026-06-30'),
      status: 'ACTIVE',
    });

    await expect(temporalEngine.assertPlateCanBeEdited(
      String(plate._id),
      ['tamanho'],
      { empresaId },
    )).resolves.toBeUndefined();
  });

  it('cancela reserva', async () => {
    const plate = await createPlate();
    await temporalEngine.createTemporalReservation({
      empresaId,
      plateId: String(plate._id),
      sourceType: 'PI',
      sourceId: 'PI-1',
      startDate: date('2026-06-01'),
      endDate: date('2026-06-30'),
    });

    const result = await temporalEngine.cancelTemporalReservation('PI', 'PI-1', empresaId);
    const availability = await temporalEngine.checkPlateAvailability(
      String(plate._id),
      date('2026-06-15'),
      date('2026-06-20'),
      { empresaId },
    );

    expect(result.cancelledCount).toBe(1);
    expect(availability.available).toBe(true);
  });

  it('converte reserva de PI em contrato', async () => {
    const plate = await createPlate();
    const pi = await PropostaInterna.create({
      empresaId,
      clienteId,
      pi_code: 'PI-PROMOTE',
      periodType: 'custom',
      startDate: date('2026-06-01'),
      endDate: date('2026-06-30'),
      dataInicio: date('2026-06-01'),
      dataFim: date('2026-06-30'),
      valorTotal: 1000,
      descricao: 'Teste',
      placas: [plate._id],
      status: 'em_andamento',
    });

    await temporalEngine.createTemporalReservation({
      empresaId,
      plateId: String(plate._id),
      sourceType: 'PI',
      sourceId: String(pi._id),
      startDate: date('2026-06-01'),
      endDate: date('2026-06-30'),
    });

    const result = await temporalEngine.promotePiReservationToContract(String(pi._id), 'CONT-1', empresaId);
    const active = await TemporalReservation.findOne({ sourceType: 'CONTRACT', sourceId: 'CONT-1' }).lean();

    expect(result.promotedCount).toBe(1);
    expect(active?.status).toBe('ACTIVE');
  });

  it('resolve status AVAILABLE', async () => {
    const plate = await createPlate();
    await expect(temporalEngine.resolvePlateTemporalStatus(String(plate._id), date('2026-06-15'), empresaId))
      .resolves.toBe('AVAILABLE');
  });

  it('resolve status RESERVED_FUTURE', async () => {
    const plate = await createPlate();
    await temporalEngine.createTemporalReservation({
      empresaId,
      plateId: String(plate._id),
      sourceType: 'PI',
      sourceId: 'PI-1',
      startDate: date('2026-07-01'),
      endDate: date('2026-07-31'),
    });

    await expect(temporalEngine.resolvePlateTemporalStatus(String(plate._id), date('2026-06-15'), empresaId))
      .resolves.toBe('RESERVED_FUTURE');
  });

  it('resolve status CONTRACTED_ACTIVE', async () => {
    const plate = await createPlate();
    await temporalEngine.createTemporalReservation({
      empresaId,
      plateId: String(plate._id),
      sourceType: 'CONTRACT',
      sourceId: 'CONT-1',
      startDate: date('2026-06-01'),
      endDate: date('2026-06-30'),
      status: 'ACTIVE',
    });

    await expect(temporalEngine.resolvePlateTemporalStatus(String(plate._id), date('2026-06-15'), empresaId))
      .resolves.toBe('CONTRACTED_ACTIVE');
  });

  it('detecta contrato vencendo', async () => {
    const plate = await createPlate();
    await temporalEngine.createTemporalReservation({
      empresaId,
      plateId: String(plate._id),
      sourceType: 'CONTRACT',
      sourceId: 'CONT-1',
      startDate: date('2026-05-01'),
      endDate: date('2026-06-10'),
      status: 'ACTIVE',
    });

    const summary = await temporalEngine.getTemporalDashboardSummary(empresaId, date('2026-06-01'));
    expect(summary.contractsExpiring).toBe(1);
  });

  it('garante que contrato cancelado nao bloqueia placa', async () => {
    const plate = await createPlate();
    await TemporalReservation.create({
      empresaId,
      plateId: plate._id,
      sourceType: 'CONTRACT',
      sourceId: 'CONT-CANCELADO',
      startDate: date('2026-06-01'),
      endDate: date('2026-06-30'),
      status: 'CANCELLED',
    });

    const availability = await temporalEngine.checkPlateAvailability(
      String(plate._id),
      date('2026-06-15'),
      date('2026-06-20'),
      { empresaId },
    );

    expect(availability.available).toBe(true);
  });

  it('garante que manual block bloqueia contratacao', async () => {
    const plate = await createPlate();
    await temporalEngine.createTemporalReservation({
      empresaId,
      plateId: String(plate._id),
      sourceType: 'MANUAL_BLOCK',
      sourceId: 'BLOCK-1',
      startDate: date('2026-06-01'),
      endDate: date('2026-06-30'),
      status: 'BLOCKED',
      reason: 'Manutencao',
    });

    const availability = await temporalEngine.checkPlateAvailability(
      String(plate._id),
      date('2026-06-15'),
      date('2026-06-20'),
      { empresaId },
    );

    expect(availability.available).toBe(false);
  });
});
