import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Aluguel from '@modules/alugueis/Aluguel';
import Contrato from '@modules/contratos/Contrato';
import Placa from '@modules/placas/Placa';
import PropostaInterna from '@modules/propostas-internas/PropostaInterna';
import { TemporalReservation, temporalBackfillService, temporalSchedulerService } from '@modules/temporal';

describe('Temporal backfill and scheduler', () => {
  let mongo: MongoMemoryServer;
  let empresaId: string;
  let clienteId: string;
  let regiaoId: string;

  const date = (value: string) => new Date(`${value}T00:00:00.000Z`);
  const now = date('2026-06-15');

  async function createPlate(overrides: Record<string, unknown> = {}) {
    return Placa.create({
      numero_placa: `TB-${new Types.ObjectId().toString().slice(-6)}`,
      disponivel: true,
      empresaId,
      regiaoId,
      ...overrides,
    });
  }

  async function createPI(plateIds: unknown[], overrides: Record<string, unknown> = {}) {
    return PropostaInterna.create({
      empresaId,
      clienteId,
      pi_code: `PI-${new Types.ObjectId().toString().slice(-8)}`,
      periodType: 'custom',
      startDate: date('2026-06-01'),
      endDate: date('2026-06-30'),
      dataInicio: date('2026-06-01'),
      dataFim: date('2026-06-30'),
      valorTotal: 1000,
      descricao: 'PI temporal',
      placas: plateIds,
      status: 'em_andamento',
      ...overrides,
    });
  }

  async function createContractWithPI(overrides: Record<string, unknown> = {}) {
    const plate = await createPlate();
    const pi = await createPI([plate._id], overrides.pi as Record<string, unknown> | undefined);
    const contract = await Contrato.create({
      empresaId,
      clienteId,
      piId: pi._id,
      numero: `C-${new Types.ObjectId().toString().slice(-8)}`,
      status: 'ativo',
      ...(overrides.contract as Record<string, unknown> | undefined),
    });
    return { plate, pi, contract };
  }

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });

  beforeEach(async () => {
    empresaId = new Types.ObjectId().toString();
    clienteId = new Types.ObjectId().toString();
    regiaoId = new Types.ObjectId().toString();
    await mongoose.connection.dropDatabase();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  it('backfill cria reserva a partir de contrato ativo', async () => {
    const { contract, plate } = await createContractWithPI();

    const report = await temporalBackfillService.runBackfill({ empresaId, now });
    const reservation = await TemporalReservation.findOne({ sourceType: 'CONTRACT', sourceId: String(contract._id) }).lean();

    expect(report.reservationsCreated).toBe(1);
    expect(reservation?.status).toBe('ACTIVE');
    expect(String(reservation?.plateId)).toBe(String(plate._id));
  });

  it('backfill nao duplica reserva ao rodar duas vezes', async () => {
    await createContractWithPI();

    await temporalBackfillService.runBackfill({ empresaId, now });
    const report = await temporalBackfillService.runBackfill({ empresaId, now });
    const count = await TemporalReservation.countDocuments();

    expect(count).toBe(1);
    expect(report.reservationsSkippedExisting).toBe(1);
  });

  it('backfill ignora contrato sem placa', async () => {
    const pi = await createPI([]);
    await Contrato.create({
      empresaId,
      clienteId,
      piId: pi._id,
      numero: 'SEM-PLACA',
      status: 'ativo',
    });

    const report = await temporalBackfillService.runBackfill({ empresaId, now });

    expect(report.recordsWithoutPlate).toBe(1);
    expect(report.reservationsCreated).toBe(0);
  });

  it('backfill registra erro para contrato sem periodo', async () => {
    const plate = await createPlate();
    const pi = await createPI([plate._id]);
    await PropostaInterna.updateOne({ _id: pi._id }, {
      $unset: { startDate: 1, endDate: 1, dataInicio: 1, dataFim: 1 },
    });
    await Contrato.create({
      empresaId,
      clienteId,
      piId: pi._id,
      numero: 'SEM-PERIODO',
      status: 'ativo',
    });

    const report = await temporalBackfillService.runBackfill({ empresaId, now });

    expect(report.recordsWithoutPeriod).toBe(1);
    expect(report.errors[0]?.reason).toMatch(/periodo/i);
  });

  it('backfill detecta conflito e continua', async () => {
    const plateA = await createPlate();
    const plateB = await createPlate();
    const piA = await createPI([plateA._id]);
    const piB = await createPI([plateA._id]);
    const piC = await createPI([plateB._id]);
    await Contrato.create({ empresaId, clienteId, piId: piA._id, numero: 'CA', status: 'ativo' });
    await Contrato.create({ empresaId, clienteId, piId: piB._id, numero: 'CB', status: 'ativo' });
    await Contrato.create({ empresaId, clienteId, piId: piC._id, numero: 'CC', status: 'ativo' });

    const report = await temporalBackfillService.runBackfill({ empresaId, now });

    expect(report.conflictsFound).toBe(1);
    expect(report.reservationsCreated).toBe(2);
  });

  it('contrato futuro vira RESERVED', async () => {
    const { contract } = await createContractWithPI({
      pi: { startDate: date('2026-07-01'), endDate: date('2026-07-31'), dataInicio: date('2026-07-01'), dataFim: date('2026-07-31') },
    });

    await temporalBackfillService.runBackfill({ empresaId, now });
    const reservation = await TemporalReservation.findOne({ sourceId: String(contract._id) }).lean();

    expect(reservation?.status).toBe('RESERVED');
  });

  it('contrato vigente vira ACTIVE', async () => {
    const { contract } = await createContractWithPI();
    await temporalBackfillService.runBackfill({ empresaId, now });
    const reservation = await TemporalReservation.findOne({ sourceId: String(contract._id) }).lean();
    expect(reservation?.status).toBe('ACTIVE');
  });

  it('contrato encerrado vira EXPIRED', async () => {
    const { contract } = await createContractWithPI({
      pi: { startDate: date('2026-05-01'), endDate: date('2026-05-31'), dataInicio: date('2026-05-01'), dataFim: date('2026-05-31') },
    });
    await temporalBackfillService.runBackfill({ empresaId, now });
    const reservation = await TemporalReservation.findOne({ sourceId: String(contract._id) }).lean();
    expect(reservation?.status).toBe('EXPIRED');
  });

  it('contrato cancelado vira CANCELLED', async () => {
    const { contract } = await createContractWithPI({ contract: { status: 'cancelado' } });
    await temporalBackfillService.runBackfill({ empresaId, now });
    const reservation = await TemporalReservation.findOne({ sourceId: String(contract._id) }).lean();
    expect(reservation?.status).toBe('CANCELLED');
  });

  it('PI aprovada sem contrato vira RESERVED', async () => {
    const plate = await createPlate();
    const pi = await createPI([plate._id], {
      startDate: date('2026-07-01'),
      endDate: date('2026-07-31'),
      dataInicio: date('2026-07-01'),
      dataFim: date('2026-07-31'),
      status: 'concluida',
    });

    await temporalBackfillService.runBackfill({ empresaId, now });
    const reservation = await TemporalReservation.findOne({ sourceType: 'PI', sourceId: String(pi._id) }).lean();

    expect(reservation?.status).toBe('RESERVED');
  });

  it('backfill considera aluguel legado como LEGACY_RENTAL', async () => {
    const plate = await createPlate();
    await Aluguel.create({
      empresaId,
      clienteId,
      placaId: plate._id,
      periodType: 'custom',
      startDate: date('2026-07-01'),
      endDate: date('2026-07-31'),
      status: 'ativo',
      tipo: 'manual',
    });

    await temporalBackfillService.runBackfill({ empresaId, now });
    const reservation = await TemporalReservation.findOne({ sourceType: 'LEGACY_RENTAL' }).lean();

    expect(reservation?.status).toBe('RESERVED');
  });

  it('scheduler expira reserva vencida', async () => {
    const plate = await createPlate();
    await TemporalReservation.create({
      empresaId,
      plateId: plate._id,
      sourceType: 'CONTRACT',
      sourceId: new Types.ObjectId().toString(),
      startDate: date('2026-05-01'),
      endDate: date('2026-05-31'),
      status: 'ACTIVE',
    });

    const result = await temporalSchedulerService.expirePastReservations(now);
    const reservation = await TemporalReservation.findOne().lean();

    expect(result.expiredCount).toBe(1);
    expect(reservation?.status).toBe('EXPIRED');
  });

  it('scheduler nao expira MANUAL_BLOCK', async () => {
    const plate = await createPlate();
    await TemporalReservation.create({
      empresaId,
      plateId: plate._id,
      sourceType: 'MANUAL_BLOCK',
      sourceId: 'BLOCK',
      startDate: date('2026-05-01'),
      endDate: date('2026-05-31'),
      status: 'BLOCKED',
    });

    const result = await temporalSchedulerService.expirePastReservations(now);
    const reservation = await TemporalReservation.findOne().lean();

    expect(result.expiredCount).toBe(0);
    expect(reservation?.status).toBe('BLOCKED');
  });

  it('scheduler detecta contrato vencendo', async () => {
    const plate = await createPlate();
    await TemporalReservation.create({
      empresaId,
      plateId: plate._id,
      sourceType: 'CONTRACT',
      sourceId: 'CONT-END',
      startDate: date('2026-06-01'),
      endDate: date('2026-06-20'),
      status: 'ACTIVE',
    });

    const result = await temporalSchedulerService.detectContractsEndingSoon(10, now);
    expect(result.contractsEndingSoon).toBe(1);
  });

  it('scheduler detecta reserva orfa', async () => {
    const plate = await createPlate();
    await TemporalReservation.create({
      empresaId,
      plateId: plate._id,
      sourceType: 'CONTRACT',
      sourceId: new Types.ObjectId().toString(),
      startDate: date('2026-06-01'),
      endDate: date('2026-06-30'),
      status: 'ACTIVE',
    });

    const result = await temporalSchedulerService.detectOrphanTemporalReservations();
    expect(result.orphanReservations).toBe(1);
  });

  it('integrity report detecta ledger sem contrato', async () => {
    const plate = await createPlate();
    await TemporalReservation.create({
      empresaId,
      plateId: plate._id,
      sourceType: 'CONTRACT',
      sourceId: new Types.ObjectId().toString(),
      startDate: date('2026-06-01'),
      endDate: date('2026-06-30'),
      status: 'ACTIVE',
    });

    const report = await temporalSchedulerService.getTemporalIntegrityReport(now);
    expect(report.ledgerWithoutOriginal).toHaveLength(1);
  });

  it('integrity report detecta contrato sem ledger', async () => {
    await createContractWithPI();

    const report = await temporalSchedulerService.getTemporalIntegrityReport(now);

    expect(report.contractWithoutLedger).toHaveLength(1);
  });
});
