import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Placa from '@modules/placas/Placa';
import {
  diffPlateNormalizedName,
  reconcilePlateNormalizedNames,
} from '../reconcile-placa-normalized-names';

describe('reconcile-placa-normalized-names', () => {
  let mongo: MongoMemoryServer;
  let empresaId: Types.ObjectId;
  let regiaoId: Types.ObjectId;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri(), { autoIndex: false });
  });

  beforeEach(async () => {
    await mongoose.connection.dropDatabase();
    empresaId = new Types.ObjectId();
    regiaoId = new Types.ObjectId();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  async function insertPlate(numero_placa: string, extra: Record<string, unknown> = {}) {
    return Placa.collection.insertOne({
      numero_placa,
      empresaId,
      regiaoId,
      ...extra,
    });
  }

  it('detecta divergencia usando numero_placa como campo canonico', () => {
    expect(diffPlateNormalizedName({
      _id: new Types.ObjectId(),
      empresaId,
      numero_placa: ' Pláca  07 ',
      numeroPlacaNormalizado: 'valor-antigo',
    })?.after).toBe('placa 07');
  });

  it('dry-run reporta sem escrever e --fix faz backfill idempotente', async () => {
    const inserted = await insertPlate(' Pláca  07 ');

    const dryRun = await reconcilePlateNormalizedNames({ empresaId: String(empresaId) });
    expect(dryRun.divergent).toBe(1);
    expect(dryRun.fixed).toBe(0);

    const fixed = await reconcilePlateNormalizedNames({ empresaId: String(empresaId), fix: true });
    expect(fixed.fixed).toBe(1);
    expect((await Placa.collection.findOne({ _id: inserted.insertedId }))?.numeroPlacaNormalizado).toBe('placa 07');

    const secondRun = await reconcilePlateNormalizedNames({ empresaId: String(empresaId), fix: true });
    expect(secondRun.divergent).toBe(0);
  });

  it('detecta conflito inclusive com placa arquivada e recusa backfill', async () => {
    await insertPlate('PLÁCA 07');
    await insertPlate(' placa   07 ', { archivedAt: new Date(), statusOperacional: 'ARCHIVED' });

    const report = await reconcilePlateNormalizedNames({ empresaId: String(empresaId), fix: true });
    expect(report.conflicts).toHaveLength(1);
    expect(report.conflicts[0]?.plates).toHaveLength(2);
    expect(report.fixed).toBe(0);
    expect(report.errors).toBe(1);
  });

  it('cria o indice unico somente depois do backfill sem conflitos', async () => {
    await insertPlate('PLACA 07');
    const report = await reconcilePlateNormalizedNames({
      fix: true,
      createIndex: true,
    });

    expect(report.indexCreated).toBe(true);
    const indexes = await Placa.collection.indexes();
    expect(indexes.some((index) => index.name === 'idx_placa_nome_normalizado_empresa_unique')).toBe(true);
  });

  it('recusa criar indice depois de auditoria parcial', async () => {
    await expect(reconcilePlateNormalizedNames({
      empresaId: String(empresaId),
      createIndex: true,
    })).rejects.toThrow('auditoria global');
  });
});
