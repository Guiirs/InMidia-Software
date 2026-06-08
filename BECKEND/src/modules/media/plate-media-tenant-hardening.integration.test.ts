import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import PlateMedia from './PlateMedia';
import { PlateMediaService } from './plate-media.service';

jest.mock('@shared/container/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() },
}));

let mongo: MongoMemoryServer;
let service: PlateMediaService;

const tenantA = new Types.ObjectId().toString();
const tenantB = new Types.ObjectId().toString();

async function createPlateMedia(input: {
  plateId: string;
  empresaId: string;
  activeKey: string;
}) {
  return PlateMedia.create({
    plateId: new Types.ObjectId(input.plateId),
    empresaId: new Types.ObjectId(input.empresaId),
    activeKey: input.activeKey,
    status: 'active',
    version: '1700000000000',
    mimeType: 'image/jpeg',
    size: 100,
    width: null,
    height: null,
    history: [],
  });
}

describe('PlateMediaService tenant hardening', () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    await PlateMedia.syncIndexes();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  beforeEach(async () => {
    service = new PlateMediaService();
    await PlateMedia.deleteMany({});
  });

  it('tenant A nao resolve PlateMedia de tenant B', async () => {
    const plateB = new Types.ObjectId().toString();
    await createPlateMedia({ plateId: plateB, empresaId: tenantB, activeKey: 'tenant-b/main.jpg' });

    const result = await service.resolvePlateMainImage(plateB, tenantA);

    expect(result.hasImage).toBe(false);
    expect(result.activeKey).toBeNull();
  });

  it('tenant A nao atualiza PlateMedia de tenant B', async () => {
    const plateB = new Types.ObjectId().toString();
    await createPlateMedia({ plateId: plateB, empresaId: tenantB, activeKey: 'tenant-b/original.jpg' });

    await service.setActivePlateImage(plateB, tenantA, { key: 'tenant-a/evil.jpg' });

    const persisted = await PlateMedia.findOne({ plateId: plateB, empresaId: tenantB }).lean();
    expect(persisted?.activeKey).toBe('tenant-b/original.jpg');
  });

  it('tenant A nao limpa PlateMedia de tenant B', async () => {
    const plateB = new Types.ObjectId().toString();
    await createPlateMedia({ plateId: plateB, empresaId: tenantB, activeKey: 'tenant-b/original.jpg' });

    await service.clearActivePlateImage(plateB, tenantA);

    const persisted = await PlateMedia.findOne({ plateId: plateB, empresaId: tenantB }).lean();
    expect(persisted?.activeKey).toBe('tenant-b/original.jpg');
    expect(persisted?.status).toBe('active');
  });

  it('batchResolvePlateMedia nao cruza tenants', async () => {
    const plateA = new Types.ObjectId().toString();
    const plateB = new Types.ObjectId().toString();
    await createPlateMedia({ plateId: plateA, empresaId: tenantA, activeKey: 'tenant-a/main.jpg' });
    await createPlateMedia({ plateId: plateB, empresaId: tenantB, activeKey: 'tenant-b/main.jpg' });

    const result = await service.batchResolvePlateMedia([plateA, plateB], tenantA);

    expect(result.size).toBe(1);
    expect(result.get(plateA)?.activeKey).toBe('tenant-a/main.jpg');
    expect(result.has(plateB)).toBe(false);
  });
});
