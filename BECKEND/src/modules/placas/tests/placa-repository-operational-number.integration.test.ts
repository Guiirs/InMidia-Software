import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Placa from '../Placa';
import Regiao from '@modules/regioes/Regiao';
import { PlacaRepository } from '../repositories/placa.repository';
import type { CreatePlacaDTO } from '../dtos/placa.dto';

describe('PlacaRepository operational numbering', () => {
  let mongo: MongoMemoryServer;
  let repository: PlacaRepository;
  let empresaId: string;
  let regiaoId: string;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    await Placa.init();
  });

  beforeEach(async () => {
    await mongoose.connection.dropDatabase();
    await Placa.syncIndexes();
    repository = new PlacaRepository();
    empresaId = new Types.ObjectId().toString();
    regiaoId = new Types.ObjectId().toString();
    await Regiao.create({
      _id: regiaoId,
      empresaId,
      nome: 'Regiao Teste',
      codigo: `RT-${new Types.ObjectId().toString().slice(-6)}`,
      ativo: true,
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  function payload(numero_placa: string, numeroOperacional: number): CreatePlacaDTO {
    return {
      numero_placa,
      numeroOperacional,
      regiaoId,
      disponivel: true,
    } as CreatePlacaDTO;
  }

  it('compacta a sequencia quando existe buraco apos apagar placa', async () => {
    const first = await repository.create(payload('OP-001', 1), empresaId);
    const second = await repository.create(payload('OP-002', 2), empresaId);
    const third = await repository.create(payload('OP-003', 3), empresaId);
    expect(first.isSuccess && second.isSuccess && third.isSuccess).toBe(true);

    await repository.delete(String(second.value._id), empresaId);
    const compacted = await repository.compactOperationalNumbers(empresaId);

    expect(compacted.isSuccess).toBe(true);
    expect(compacted.value.map((placa) => placa.numero_placa)).toEqual(['OP-001', 'OP-003']);
    expect(compacted.value.map((placa) => placa.numeroOperacional)).toEqual([1, 2]);
  });

  it('move uma placa para uma numeracao ocupada e empurra as demais', async () => {
    const first = await repository.create(payload('MOV-001', 1), empresaId);
    const second = await repository.create(payload('MOV-002', 2), empresaId);
    const third = await repository.create(payload('MOV-003', 3), empresaId);
    const fourth = await repository.create(payload('MOV-004', 4), empresaId);
    expect(first.isSuccess && second.isSuccess && third.isSuccess && fourth.isSuccess).toBe(true);

    const moved = await repository.moveOperationalNumber(empresaId, String(fourth.value._id), 2);

    expect(moved.isSuccess).toBe(true);
    expect(moved.value.map((placa) => placa.numero_placa)).toEqual(['MOV-001', 'MOV-004', 'MOV-002', 'MOV-003']);
    expect(moved.value.map((placa) => placa.numeroOperacional)).toEqual([1, 2, 3, 4]);
  });
});
