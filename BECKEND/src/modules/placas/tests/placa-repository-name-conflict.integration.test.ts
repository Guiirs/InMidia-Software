import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Placa from '../Placa';
import Regiao from '@modules/regioes/Regiao';
import { PlacaRepository } from '../repositories/placa.repository';
import type { CreatePlacaDTO } from '../dtos/placa.dto';

describe('PlacaRepository normalized name conflict', () => {
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

  function payload(numero_placa: string): CreatePlacaDTO {
    return {
      numero_placa,
      regiaoId,
      disponivel: true,
    } as CreatePlacaDTO;
  }

  it('bloqueia criacao normalizada no mesmo tenant e permite em outro tenant', async () => {
    expect((await repository.create(payload('Pláca   01'), empresaId)).isSuccess).toBe(true);

    const duplicate = await repository.create(payload(' placa 01 '), empresaId);
    expect(duplicate.isFailure).toBe(true);
    expect(duplicate.error.code).toBe('PLATE_NAME_CONFLICT');

    const otherTenant = await repository.create(payload('PLACA 01'), new Types.ObjectId().toString());
    expect(otherTenant.isSuccess).toBe(true);
  });

  it('permite manter o proprio numero e bloqueia renomear para outra placa', async () => {
    const first = await repository.create(payload('Placa 01'), empresaId);
    const second = await repository.create(payload('Placa 02'), empresaId);
    expect(first.isSuccess && second.isSuccess).toBe(true);

    const firstId = String(first.value._id);
    const secondId = String(second.value._id);
    expect((await repository.update(firstId, { numero_placa: ' PLACA 01 ' }, empresaId)).isSuccess).toBe(true);

    const conflict = await repository.update(secondId, { numero_placa: 'placa 01' }, empresaId);
    expect(conflict.isFailure).toBe(true);
    expect(conflict.error.code).toBe('PLATE_NAME_CONFLICT');
  });
});
