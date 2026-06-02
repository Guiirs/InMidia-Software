import { Types } from 'mongoose';
import Placa from '@modules/placas/Placa';
import { safeUploadBufferToR2 } from '@shared/infra/http/middlewares/upload.middleware';
import { MediaService } from '../media.service';

jest.mock('@modules/placas/Placa', () => ({
  __esModule: true,
  default: {
    updateOne: jest.fn(),
    findOne: jest.fn(),
  },
}));

jest.mock('@shared/infra/http/middlewares/upload.middleware', () => ({
  safeUploadBufferToR2: jest.fn(),
  safeDeleteFromR2: jest.fn(),
}));

const mockedPlaca = Placa as unknown as jest.Mocked<Pick<typeof Placa, 'updateOne' | 'findOne'>>;
const mockedUpload = safeUploadBufferToR2 as jest.MockedFunction<typeof safeUploadBufferToR2>;

function makeRepository(overrides: Record<string, jest.Mock> = {}) {
  return {
    create: jest.fn(async (data: any) => ({ ...data, toObject: () => ({ ...data }) })),
    findMain: jest.fn().mockResolvedValue(null),
    updateMany: jest.fn().mockResolvedValue({ acknowledged: true }),
    updateOne: jest.fn().mockResolvedValue({ acknowledged: true }),
    findById: jest.fn(),
    findDocumentById: jest.fn(),
    findByOwner: jest.fn(),
    findDeletePending: jest.fn(),
    findOrphans: jest.fn(),
    ...overrides,
  } as any;
}

function makeFile(): Express.Multer.File {
  return {
    buffer: Buffer.from('image'),
    mimetype: 'image/webp',
    originalname: 'placa.webp',
    size: 5,
  } as Express.Multer.File;
}

describe('MediaService upload/sync hardening', () => {
  const empresaId = new Types.ObjectId().toString();
  const ownerId = new Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUpload.mockResolvedValue(undefined as never);
    mockedPlaca.updateOne.mockResolvedValue({ acknowledged: true } as never);
  });

  it('upload interrompido antes do R2 nao cria asset nem sincroniza placa', async () => {
    const repository = makeRepository();
    mockedUpload.mockRejectedValue(new Error('R2 offline') as never);
    const service = new MediaService(repository);

    await expect(service.uploadMedia(makeFile(), {
      ownerType: 'PLATE',
      ownerId,
      category: 'MAIN',
      source: 'UPLOAD',
      setAsMain: true,
      preservePreviousMain: false,
      version: 1,
    }, empresaId)).rejects.toThrow('R2 offline');

    expect(repository.create).not.toHaveBeenCalled();
    expect(mockedPlaca.updateOne).not.toHaveBeenCalled();
  });

  it('salva storageKey canonica, origem e compatibilidade legada no sync de upload', async () => {
    const repository = makeRepository();
    const service = new MediaService(repository);

    const asset = await service.uploadMedia(makeFile(), {
      ownerType: 'PLATE',
      ownerId,
      category: 'MAIN',
      source: 'UPLOAD',
      setAsMain: true,
      preservePreviousMain: true,
      version: 1,
    }, empresaId);

    expect(asset.storageKey).toMatch(new RegExp(`^empresas/${empresaId}/plates/${ownerId}/main/`));
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({
      r2Key: asset.storageKey,
      source: 'UPLOAD',
      isMain: true,
    }));
    expect(mockedPlaca.updateOne).toHaveBeenLastCalledWith(
      { _id: expect.any(Types.ObjectId), empresaId: expect.any(Types.ObjectId) },
      expect.objectContaining({
        $set: expect.objectContaining({
          imagemPrincipal: asset.storageKey,
          imagem: asset.storageKey,
          'imagens.$[img].isMain': true,
        }),
      }),
      expect.objectContaining({ arrayFilters: expect.any(Array) }),
    );
  });

  it('sync parcial nao duplica imagem existente na galeria', async () => {
    const repository = makeRepository();
    const service = new MediaService(repository);

    await service.uploadMedia(makeFile(), {
      ownerType: 'PLATE',
      ownerId,
      category: 'OTHER',
      source: 'UPLOAD',
      setAsMain: false,
      preservePreviousMain: false,
      version: 1,
    }, empresaId);

    expect(mockedPlaca.updateOne).toHaveBeenCalledWith(
      {
        _id: expect.any(Types.ObjectId),
        empresaId: expect.any(Types.ObjectId),
        'imagens.id': { $ne: expect.any(String) },
      },
      { $push: { imagens: expect.objectContaining({ source: 'UPLOAD', storageKey: expect.any(String) }) } },
    );
  });
});
