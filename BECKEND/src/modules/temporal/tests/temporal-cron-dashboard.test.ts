import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Contrato from '@modules/contratos/Contrato';
import Placa from '@modules/placas/Placa';
import PropostaInterna from '@modules/propostas-internas/PropostaInterna';
import {
  TemporalEvent,
  TemporalReservation,
  temporalCronService,
  temporalEngine,
  temporalSchedulerService,
} from '@modules/temporal';
import { TemporalController } from '../temporal.controller';

describe('Temporal cron and dashboard summary', () => {
  let mongo: MongoMemoryServer;
  let empresaId: string;
  let clienteId: string;
  let regiaoA: string;
  let regiaoB: string;
  const date = (value: string) => new Date(`${value}T00:00:00.000Z`);
  const now = date('2026-06-15');

  async function createPlate(regiaoId = regiaoA, overrides: Record<string, unknown> = {}) {
    return Placa.create({
      numero_placa: `TC-${new Types.ObjectId().toString().slice(-6)}`,
      disponivel: true,
      empresaId,
      regiaoId,
      ...overrides,
    });
  }

  async function createPI(plateIds: unknown[], valorTotal = 0, overrides: Record<string, unknown> = {}) {
    return PropostaInterna.create({
      empresaId,
      clienteId,
      pi_code: `PI-${new Types.ObjectId().toString().slice(-8)}`,
      periodType: 'custom',
      startDate: date('2026-06-01'),
      endDate: date('2026-06-30'),
      dataInicio: date('2026-06-01'),
      dataFim: date('2026-06-30'),
      valorTotal,
      descricao: 'PI temporal cron',
      placas: plateIds,
      status: 'em_andamento',
      ...overrides,
    });
  }

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });

  beforeEach(async () => {
    jest.restoreAllMocks();
    temporalCronService.resetForTests();
    empresaId = new Types.ObjectId().toString();
    clienteId = new Types.ObjectId().toString();
    regiaoA = new Types.ObjectId().toString();
    regiaoB = new Types.ObjectId().toString();
    await mongoose.connection.dropDatabase();
  });

  afterAll(async () => {
    temporalCronService.resetForTests();
    await mongoose.disconnect();
    await mongo.stop();
  });

  it('scheduler nao inicia sem feature flag', () => {
    const status = temporalCronService.start({
      ...process.env,
      NODE_ENV: 'production',
      TEMPORAL_SCHEDULER_ENABLED: undefined,
    });

    expect(status.enabled).toBe(false);
  });

  it('scheduler nao inicia em test', () => {
    const status = temporalCronService.start({
      ...process.env,
      NODE_ENV: 'test',
      TEMPORAL_SCHEDULER_ENABLED: 'true',
    });

    expect(status.enabled).toBe(false);
  });

  it('scheduler inicia quando flag esta ativa', () => {
    const status = temporalCronService.start({
      ...process.env,
      NODE_ENV: 'production',
      TEMPORAL_SCHEDULER_ENABLED: 'true',
      TEMPORAL_SCHEDULER_CRON: '0 3 * * *',
      TEMPORAL_SCHEDULER_DAYS_BEFORE_END: '9',
    });

    expect(status.enabled).toBe(true);
    expect(status.cronExpression).toBe('0 3 * * *');
    expect(status.daysBeforeEnd).toBe(9);
  });

  it('lock impede execucao concorrente', async () => {
    let release!: () => void;
    const pending = new Promise((resolve) => {
      release = () => resolve({ expiredCount: 1 });
    });
    jest.spyOn(temporalSchedulerService, 'runDailyTemporalMaintenance').mockReturnValue(pending as any);

    const first = temporalCronService.runNow('manual');
    const second = await temporalCronService.runNow('manual');
    release();
    const firstResult = await first;

    expect(second.status).toBe('SKIPPED_ALREADY_RUNNING');
    expect(firstResult.status).toBe('SUCCESS');
  });

  it('execucao manual retorna resumo', async () => {
    jest.spyOn(temporalSchedulerService, 'runDailyTemporalMaintenance').mockResolvedValue({
      expiredCount: 2,
      contractsEndingSoon: 1,
      expiredPendingRelease: 0,
      orphanReservations: 0,
      integrityIssues: 0,
    });

    const result = await temporalCronService.runNow('manual');

    expect(result).toMatchObject({ status: 'SUCCESS', expiredCount: 2, contractsEndingSoon: 1 });
  });

  it('falha no job nao derruba processo', async () => {
    jest.spyOn(temporalSchedulerService, 'runDailyTemporalMaintenance').mockRejectedValue(new Error('boom temporal'));

    const result = await temporalCronService.runNow('manual');
    const status = temporalCronService.getStatus();

    expect(result.status).toBe('FAILED');
    expect(status.lastErrorMessage).toBe('boom temporal');
  });

  it('status endpoint retorna ultima execucao', async () => {
    jest.spyOn(temporalSchedulerService, 'runDailyTemporalMaintenance').mockResolvedValue({ expiredCount: 1 });
    await temporalCronService.runNow('manual');

    const controller = new TemporalController();
    const json = jest.fn();
    const res = { json } as any;

    await controller.getSchedulerStatus({} as any, res, jest.fn());

    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({
        running: false,
        lastSummary: expect.objectContaining({ status: 'SUCCESS', expiredCount: 1 }),
      }),
    }));
  });

  it('dashboard calcula placas disponiveis', async () => {
    await createPlate();
    await createPlate();

    const summary = await temporalEngine.getTemporalDashboardSummary(empresaId, now);

    expect(summary.totalPlates).toBe(2);
    expect(summary.availablePlates).toBe(2);
  });

  it('dashboard calcula placas contratadas e ocupacao', async () => {
    const plate = await createPlate();
    await createPlate();
    await TemporalReservation.create({
      empresaId,
      plateId: plate._id,
      sourceType: 'CONTRACT',
      sourceId: new Types.ObjectId().toString(),
      startDate: date('2026-06-01'),
      endDate: date('2026-06-30'),
      status: 'ACTIVE',
    });

    const summary = await temporalEngine.getTemporalDashboardSummary(empresaId, now);

    expect(summary.contractedPlates).toBe(1);
    expect(summary.occupancyRate).toBe(50);
    expect(summary.availablePlates).toBe(1);
  });

  it('dashboard agrupa ocupacao por regiao', async () => {
    const plateA = await createPlate(regiaoA);
    await createPlate(regiaoA);
    await createPlate(regiaoB);
    await TemporalReservation.create({
      empresaId,
      plateId: plateA._id,
      sourceType: 'CONTRACT',
      sourceId: new Types.ObjectId().toString(),
      startDate: date('2026-06-01'),
      endDate: date('2026-06-30'),
      status: 'ACTIVE',
    });

    const summary = await temporalEngine.getTemporalDashboardSummary(empresaId, now);
    const regionA = summary.occupancyByRegion.find((region: any) => region.regionId === regiaoA);
    const regionB = summary.occupancyByRegion.find((region: any) => region.regionId === regiaoB);

    expect(regionA).toMatchObject({ total: 2, occupied: 1, available: 1, occupancyRate: 50 });
    expect(regionB).toMatchObject({ total: 1, occupied: 0, available: 1, occupancyRate: 0 });
  });

  it('dashboard nao inventa receita sem valor', async () => {
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

    const summary = await temporalEngine.getTemporalDashboardSummary(empresaId, now);

    expect(summary.activeRevenue).toBe(0);
  });

  it('dashboard calcula receita ativa quando valor existe', async () => {
    const plate = await createPlate();
    const pi = await createPI([plate._id], 2500);
    const contract = await Contrato.create({
      empresaId,
      clienteId,
      piId: pi._id,
      numero: 'DASH-REVENUE',
      status: 'ativo',
    });
    await TemporalReservation.create({
      empresaId,
      plateId: plate._id,
      sourceType: 'CONTRACT',
      sourceId: String(contract._id),
      startDate: date('2026-06-01'),
      endDate: date('2026-06-30'),
      status: 'ACTIVE',
    });

    const summary = await temporalEngine.getTemporalDashboardSummary(empresaId, now);

    expect(summary.activeRevenue).toBe(2500);
    expect(summary.revenueByRegion.find((region: any) => region.regionId === regiaoA)?.activeRevenue).toBe(2500);
  });

  it('dashboard inclui conflitos e integridade', async () => {
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
    await TemporalEvent.create({
      empresaId,
      plateId: plate._id,
      eventType: 'TEMPORAL_RESERVATION_CONFLICT',
      message: 'Conflito',
      metadata: {},
    });

    const summary = await temporalEngine.getTemporalDashboardSummary(empresaId, now);

    expect(summary.conflictsCount).toBe(1);
    expect(summary.orphanReservationsCount).toBe(1);
    expect(summary.integrityIssuesCount).toBeGreaterThanOrEqual(1);
  });
});
