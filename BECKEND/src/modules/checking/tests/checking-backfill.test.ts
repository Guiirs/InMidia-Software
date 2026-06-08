import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import Checking from '../Checking';
import Aluguel from '@modules/alugueis/Aluguel';
import { runCheckingBackfill } from '../checking-backfill';

let mongoServer: MongoMemoryServer;

async function createLegacyChecking(aluguelId?: Types.ObjectId | null) {
  return Checking.collection.insertOne({
    aluguelId: aluguelId ?? new Types.ObjectId(),
    placaId: new Types.ObjectId(),
    installerId: new Types.ObjectId(),
    photoUrl: 'https://example.com/photo.jpg',
    gpsCoordinates: { latitude: -23.5, longitude: -46.6 },
    installedAt: new Date(),
  });
}

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Checking.deleteMany({});
  await Aluguel.deleteMany({});
});

describe('checking empresaId backfill', () => {
  it('dry-run nao persiste empresaId', async () => {
    const empresaId = new Types.ObjectId();
    const aluguel = await Aluguel.create({
      empresaId,
      placaId: new Types.ObjectId(),
      clienteId: new Types.ObjectId(),
      periodType: 'custom',
      valor_mensal: 1000,
      startDate: new Date(),
      endDate: new Date(Date.now() + 86400000),
    });
    const inserted = await createLegacyChecking(aluguel._id as Types.ObjectId);

    const report = await runCheckingBackfill();
    const reread = await Checking.collection.findOne({ _id: inserted.insertedId });

    expect(report.mode).toBe('DRY_RUN');
    expect(report.wouldUpdate).toBe(1);
    expect(reread?.empresaId).toBeUndefined();
  });

  it('fix persiste empresaId corretamente', async () => {
    const empresaId = new Types.ObjectId();
    const aluguel = await Aluguel.create({
      empresaId,
      placaId: new Types.ObjectId(),
      clienteId: new Types.ObjectId(),
      periodType: 'custom',
      valor_mensal: 1000,
      startDate: new Date(),
      endDate: new Date(Date.now() + 86400000),
    });
    const inserted = await createLegacyChecking(aluguel._id as Types.ObjectId);

    const report = await runCheckingBackfill({ fix: true });
    const reread = await Checking.collection.findOne({ _id: inserted.insertedId });

    expect(report.mode).toBe('FIX');
    expect(report.updated).toBe(1);
    expect(String(reread?.empresaId)).toBe(String(empresaId));
  });

  it('lista checkings orfaos sem inferencia', async () => {
    await createLegacyChecking(new Types.ObjectId());

    const report = await runCheckingBackfill();

    expect(report.scanned).toBe(1);
    expect(report.unresolved).toHaveLength(1);
    expect(report.unresolved[0]?.reason).toBe('ALUGUEL_WITHOUT_EMPRESA_ID');
  });

  it('aborta com fix e dry-run juntos', async () => {
    await expect(runCheckingBackfill({ fix: true, dryRun: true }))
      .rejects
      .toThrow('never both');
  });
});
