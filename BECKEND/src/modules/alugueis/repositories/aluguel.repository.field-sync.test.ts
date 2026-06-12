import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import Aluguel from '../Aluguel';
import Placa from '@modules/placas/Placa';
import Cliente from '@modules/clientes/Cliente';
import { AluguelRepository } from './aluguel.repository';

describe('AluguelRepository.update — sincronizacao de campos novos/legados', () => {
  let mongo: MongoMemoryServer;
  let repository: AluguelRepository;
  let empresaId: string;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    repository = new AluguelRepository();
  });

  beforeEach(async () => {
    empresaId = new Types.ObjectId().toString();
    await mongoose.connection.dropDatabase();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  async function createAluguel() {
    const placa = await Placa.create({
      numero_placa: `FS-${new Types.ObjectId().toString().slice(-6)}`,
      empresaId,
      regiaoId: new Types.ObjectId(),
      disponivel: true,
    });
    const cliente = await Cliente.create({
      nome: 'Cliente Field Sync',
      empresaId,
    });

    const aluguel = await Aluguel.create({
      placaId: placa._id,
      clienteId: cliente._id,
      empresaId,
      periodType: 'custom',
      startDate: new Date('2026-06-01T00:00:00.000Z'),
      endDate: new Date('2026-06-30T00:00:00.000Z'),
      data_inicio: new Date('2026-06-01T00:00:00.000Z'),
      data_fim: new Date('2026-06-30T00:00:00.000Z'),
      status: 'ativo',
    });
    return aluguel;
  }

  it('atualizar startDate/endDate via update() sincroniza data_inicio/data_fim no doc persistido', async () => {
    const aluguel = await createAluguel();

    const newStart = new Date('2026-07-01T00:00:00.000Z');
    const newEnd = new Date('2026-07-31T00:00:00.000Z');

    const result = await repository.update(
      String(aluguel._id),
      { startDate: newStart, endDate: newEnd },
      empresaId,
    );

    expect(result.isSuccess).toBe(true);

    const persisted = await Aluguel.findById(aluguel._id).lean();
    expect(persisted?.startDate).toEqual(newStart);
    expect(persisted?.endDate).toEqual(newEnd);
    expect(persisted?.data_inicio).toEqual(newStart);
    expect(persisted?.data_fim).toEqual(newEnd);
  });

  it('atualizar biWeekIds via update() sincroniza bi_week_ids no doc persistido', async () => {
    const aluguel = await createAluguel();

    const result = await repository.update(
      String(aluguel._id),
      { biWeekIds: ['2026-B13', '2026-B14'] },
      empresaId,
    );

    expect(result.isSuccess).toBe(true);

    const persisted = await Aluguel.findById(aluguel._id).lean();
    expect(persisted?.biWeekIds).toEqual(['2026-B13', '2026-B14']);
    expect(persisted?.bi_week_ids).toEqual(['2026-B13', '2026-B14']);
  });
});
