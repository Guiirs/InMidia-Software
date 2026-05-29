import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import Aluguel from '@modules/alugueis/Aluguel';
import Placa from '@modules/placas/Placa';
import { temporalEngine } from '@modules/temporal';
import { commercialAvailabilityProjection } from '../commercial-availability.projection';
import { getProjectionMetricsSnapshot, resetProjectionMetrics } from '@shared/infra/monitoring/projection-metrics';

const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

describe('CommercialAvailabilityProjection', () => {
  let mongo: MongoMemoryServer;
  let empresaId: string;
  let regiaoId: string;

  async function createPlate(overrides: Record<string, unknown> = {}) {
    return Placa.create({
      numero_placa: `CAP-${new Types.ObjectId().toString().slice(-6)}`,
      empresaId,
      regiaoId,
      disponivel: true,
      ...overrides,
    });
  }

  async function resolve(placaId: string) {
    return commercialAvailabilityProjection.resolvePlateCommercialStatus({
      empresaId,
      placaId,
      at: date('2026-06-15'),
    });
  }

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });

  beforeEach(async () => {
    empresaId = new Types.ObjectId().toString();
    regiaoId = new Types.ObjectId().toString();
    resetProjectionMetrics();
    await mongoose.connection.dropDatabase();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  it('resolve placa livre como AVAILABLE', async () => {
    const placa = await createPlate();

    await expect(resolve(String(placa._id))).resolves.toMatchObject({
      status: 'AVAILABLE',
      source: 'temporal',
      isCommerciallyAvailable: true,
      isPhysicallyBlocked: false,
    });
  });

  it('resolve reserva ativa como RESERVED', async () => {
    const placa = await createPlate();
    await temporalEngine.createTemporalReservation({
      empresaId,
      plateId: String(placa._id),
      sourceType: 'PI',
      sourceId: 'PI-1',
      startDate: date('2026-06-01'),
      endDate: date('2026-06-30'),
    });

    await expect(resolve(String(placa._id))).resolves.toMatchObject({
      status: 'RESERVED',
      source: 'temporal',
      isCommerciallyAvailable: false,
    });
  });

  it('resolve contrato ativo como CONTRACTED_ACTIVE', async () => {
    const placa = await createPlate();
    await temporalEngine.createTemporalReservation({
      empresaId,
      plateId: String(placa._id),
      sourceType: 'CONTRACT',
      sourceId: 'CONTRACT-1',
      startDate: date('2026-06-01'),
      endDate: date('2026-06-30'),
      status: 'ACTIVE',
    });

    await expect(resolve(String(placa._id))).resolves.toMatchObject({
      status: 'CONTRACTED_ACTIVE',
      source: 'temporal',
      activeContractId: 'CONTRACT-1',
      isCommerciallyAvailable: false,
    });
  });

  it('resolve reserva futura como FUTURE_RESERVED', async () => {
    const placa = await createPlate();
    await temporalEngine.createTemporalReservation({
      empresaId,
      plateId: String(placa._id),
      sourceType: 'PI',
      sourceId: 'PI-FUTURE',
      startDate: date('2026-07-01'),
      endDate: date('2026-07-31'),
    });

    await expect(resolve(String(placa._id))).resolves.toMatchObject({
      status: 'FUTURE_RESERVED',
      source: 'temporal',
      isCommerciallyAvailable: false,
    });
  });

  it('resolve manutencao fisica sem reserva como MAINTENANCE', async () => {
    const placa = await createPlate({ disponivel: false });

    await expect(resolve(String(placa._id))).resolves.toMatchObject({
      status: 'MAINTENANCE',
      source: 'physical_block',
      isPhysicallyBlocked: true,
      isCommerciallyAvailable: false,
    });
  });

  it('prioriza contrato ativo sobre placa.disponivel=false', async () => {
    const placa = await createPlate({ disponivel: false });
    await temporalEngine.createTemporalReservation({
      empresaId,
      plateId: String(placa._id),
      sourceType: 'CONTRACT',
      sourceId: 'CONTRACT-LOCKED',
      startDate: date('2026-06-01'),
      endDate: date('2026-06-30'),
      status: 'ACTIVE',
    });

    await expect(resolve(String(placa._id))).resolves.toMatchObject({
      status: 'CONTRACTED_ACTIVE',
      source: 'temporal',
      isPhysicallyBlocked: false,
      activeContractId: 'CONTRACT-LOCKED',
    });
  });

  it('usa fallback legado via Aluguel com source auditavel', async () => {
    const placa = await createPlate();
    await Aluguel.create({
      empresaId,
      placaId: placa._id,
      clienteId: new Types.ObjectId(),
      startDate: date('2026-06-01'),
      endDate: date('2026-06-30'),
      data_inicio: date('2026-06-01'),
      data_fim: date('2026-06-30'),
      periodType: 'custom',
      status: 'ativo',
    });

    await expect(resolve(String(placa._id))).resolves.toMatchObject({
      status: 'CONTRACTED_ACTIVE',
      source: 'fallback_legacy',
      isCommerciallyAvailable: false,
      reason: 'Fallback legado via Aluguel',
    });
  });

  it('batch nao chama resolver unitario por placa e mantem mapa estavel', async () => {
    const livre = await createPlate();
    const manutencao = await createPlate({ disponivel: false });
    const spy = jest.spyOn(commercialAvailabilityProjection, 'resolvePlateCommercialStatus');

    const result = await commercialAvailabilityProjection.resolveManyPlateCommercialStatuses({
      empresaId,
      placaIds: [String(livre._id), String(manutencao._id)],
      at: date('2026-06-15'),
    });

    expect(spy).not.toHaveBeenCalled();
    expect(Array.from(result.keys())).toEqual([String(livre._id), String(manutencao._id)]);
    expect(result.get(String(livre._id))).toMatchObject({ status: 'AVAILABLE' });
    expect(result.get(String(manutencao._id))).toMatchObject({ status: 'MAINTENANCE', source: 'physical_block' });
    spy.mockRestore();
  });

  it('batch prioriza temporal sobre fisico e ignora fallback legado concorrente', async () => {
    const placa = await createPlate({ disponivel: false });
    await temporalEngine.createTemporalReservation({
      empresaId,
      plateId: String(placa._id),
      sourceType: 'CONTRACT',
      sourceId: 'CONTRACT-BATCH',
      startDate: date('2026-06-01'),
      endDate: date('2026-06-30'),
      status: 'ACTIVE',
    });
    await Aluguel.create({
      empresaId,
      placaId: placa._id,
      clienteId: new Types.ObjectId(),
      startDate: date('2026-06-01'),
      endDate: date('2026-06-30'),
      data_inicio: date('2026-06-01'),
      data_fim: date('2026-06-30'),
      periodType: 'custom',
      status: 'ativo',
    });

    const result = await commercialAvailabilityProjection.resolveManyPlateCommercialStatuses({
      empresaId,
      placaIds: [String(placa._id)],
      at: date('2026-06-15'),
    });

    expect(result.get(String(placa._id))).toMatchObject({
      status: 'CONTRACTED_ACTIVE',
      source: 'temporal',
      activeContractId: 'CONTRACT-BATCH',
    });
  });

  it('batch exige empresaId valido', async () => {
    const placa = await createPlate();

    await expect(commercialAvailabilityProjection.resolveManyPlateCommercialStatuses({
      empresaId: '',
      placaIds: [String(placa._id)],
      at: date('2026-06-15'),
    })).rejects.toThrow(/empresaId obrigatorio/i);
  });

  it('registra metricas internas de projection', async () => {
    const livre = await createPlate();
    const legado = await createPlate();
    await Aluguel.create({
      empresaId,
      placaId: legado._id,
      clienteId: new Types.ObjectId(),
      startDate: date('2026-06-01'),
      endDate: date('2026-06-30'),
      data_inicio: date('2026-06-01'),
      data_fim: date('2026-06-30'),
      periodType: 'custom',
      status: 'ativo',
    });

    await commercialAvailabilityProjection.resolveManyPlateCommercialStatuses({
      empresaId,
      placaIds: [String(livre._id), String(legado._id)],
      at: date('2026-06-15'),
    });

    expect(getProjectionMetricsSnapshot()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        projection: 'commercial',
        calls: 1,
        totalPlates: 2,
        fallbackCount: 1,
        fallbackRate: 0.5,
      }),
    ]));
  });
});
