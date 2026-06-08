import Placa from '../Placa';
import { PlacaRepository } from '../repositories/placa.repository';

jest.mock('../Placa', () => ({
  __esModule: true,
  default: {
    updateOne: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
}));

jest.mock('@modules/media/plate-media.service', () => ({
  plateMediaService: {
    setActivePlateImage: jest.fn().mockResolvedValue(undefined),
    clearActivePlateImage: jest.fn().mockResolvedValue(undefined),
    getPlateMedia: jest.fn().mockResolvedValue(null),
  },
}));

import { plateMediaService } from '@modules/media/plate-media.service';

const mockedPlaca = Placa as unknown as jest.Mocked<Pick<typeof Placa, 'updateOne' | 'findOne' | 'findOneAndUpdate'>>;
const mockedSetActive = plateMediaService.setActivePlateImage as jest.Mock;
const mockedClear = plateMediaService.clearActivePlateImage as jest.Mock;

describe('PlacaRepository image gallery', () => {
  const repository = new PlacaRepository();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('inicializa galeria ausente antes de marcar imagem principal', async () => {
    const lean = jest.fn().mockResolvedValue({
      _id: 'placa-1',
      empresaId: 'empresa-1',
      imagens: [{
        id: 'image-1',
        storageKey: 'placas/main.webp',
        url: 'https://pub-storage.r2.dev/placas/main.webp',
        isMain: true,
        category: 'MAIN',
      }],
    });
    const populate = jest.fn().mockReturnValue({ lean });

    mockedPlaca.updateOne.mockResolvedValue({ acknowledged: true, matchedCount: 1, modifiedCount: 1 } as never);
    mockedPlaca.findOneAndUpdate.mockReturnValue({ populate } as never);

    const result = await repository.addImage('placa-1', 'empresa-1', {
      url: 'https://pub-storage.r2.dev/placas/main.webp',
      key: 'placas/main.webp',
      storageKey: 'placas/main.webp',
      filename: 'main.webp',
      category: 'MAIN',
      setAsMain: true,
    });

    expect(result.isSuccess).toBe(true);
    // Initializes imagens array before marking isMain
    expect(mockedPlaca.updateOne).toHaveBeenNthCalledWith(
      1,
      { _id: 'placa-1', empresaId: 'empresa-1', imagens: { $exists: false } },
      { $set: { imagens: [] } },
    );
    expect(mockedPlaca.updateOne).toHaveBeenNthCalledWith(
      2,
      { _id: 'placa-1', empresaId: 'empresa-1', imagens: { $type: 'array' } },
      { $set: { 'imagens.$[].isMain': false } },
    );
    // Pushes the new image to the gallery
    expect(mockedPlaca.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'placa-1', empresaId: 'empresa-1' },
      expect.objectContaining({
        $push: {
          imagens: expect.objectContaining({
            url: 'https://pub-storage.r2.dev/placas/main.webp',
            isMain: true,
            source: 'UPLOAD',
          }),
        },
      }),
      { new: true, runValidators: true },
    );
    // Syncs PlateMedia — no legacy imagemPrincipal/imagem writes
    expect(mockedSetActive).toHaveBeenCalledWith('placa-1', 'empresa-1', expect.objectContaining({ key: 'placas/main.webp' }));
    expect(mockedPlaca.findOneAndUpdate).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ $set: expect.objectContaining({ imagemPrincipal: expect.anything() }) }),
      expect.anything(),
    );
  });

  it('troca imagem principal sincrona PlateMedia com storageKey canonica', async () => {
    const leanFind = jest.fn().mockResolvedValue({
      _id: 'placa-1',
      empresaId: 'empresa-1',
      imagens: [
        { id: 'old', storageKey: 'empresas/e1/plates/p1/history/old.jpg', isMain: true },
        { id: 'new', storageKey: 'empresas/e1/plates/p1/main/new.webp' },
      ],
    });
    mockedPlaca.findOne.mockReturnValue({ lean: leanFind } as never);

    const leanUpdate = jest.fn().mockResolvedValue({ _id: 'placa-1' });
    mockedPlaca.findOneAndUpdate.mockReturnValue({ populate: jest.fn().mockReturnValue({ lean: leanUpdate }) } as never);

    const result = await repository.setMainImage('placa-1', 'empresa-1', 'new');

    expect(result.isSuccess).toBe(true);
    // Gallery update: flips isMain flags
    expect(mockedPlaca.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'placa-1', empresaId: 'empresa-1' },
      expect.objectContaining({
        $set: expect.objectContaining({
          imagens: expect.arrayContaining([
            expect.objectContaining({ id: 'old', isMain: false }),
            expect.objectContaining({ id: 'new', isMain: true }),
          ]),
        }),
      }),
      { new: true },
    );
    // PlateMedia synced to the new canonical key
    expect(mockedSetActive).toHaveBeenCalledWith('placa-1', 'empresa-1', expect.objectContaining({
      key: 'empresas/e1/plates/p1/main/new.webp',
    }));
    // No legacy field writes
    expect(mockedPlaca.findOneAndUpdate).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ $set: expect.objectContaining({ imagemPrincipal: expect.anything() }) }),
      expect.anything(),
    );
  });

  it('remove imagem principal e promove fallback via PlateMedia (sem campos legados)', async () => {
    const leanFind = jest.fn().mockResolvedValue({
      _id: 'placa-1',
      empresaId: 'empresa-1',
      imagens: [
        { id: 'current', storageKey: 'empresas/e1/plates/p1/main/current.webp', isMain: true },
        { id: 'fallback', storageKey: 'empresas/e1/plates/p1/history/fallback.jpg' },
      ],
    });
    mockedPlaca.findOne.mockReturnValue({ lean: leanFind } as never);

    const leanUpdate = jest.fn().mockResolvedValue({ _id: 'placa-1' });
    mockedPlaca.findOneAndUpdate.mockReturnValue({ populate: jest.fn().mockReturnValue({ lean: leanUpdate }) } as never);

    const result = await repository.removeImage('placa-1', 'empresa-1', 'current');

    expect(result.isSuccess).toBe(true);
    // Gallery update: remaining image promoted to main
    expect(mockedPlaca.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'placa-1', empresaId: 'empresa-1' },
      expect.objectContaining({
        $set: expect.objectContaining({
          imagens: [expect.objectContaining({ id: 'fallback', isMain: true })],
        }),
      }),
      { new: true },
    );
    // PlateMedia updated with fallback key
    expect(mockedSetActive).toHaveBeenCalledWith('placa-1', 'empresa-1', expect.objectContaining({
      key: 'empresas/e1/plates/p1/history/fallback.jpg',
    }));
    // No legacy field writes
    expect(mockedPlaca.findOneAndUpdate).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ $set: expect.objectContaining({ imagemPrincipal: expect.anything() }) }),
      expect.anything(),
    );
  });

  it('remove ultima imagem: PlateMedia e limpa activeKey', async () => {
    const leanFind = jest.fn().mockResolvedValue({
      _id: 'placa-1',
      empresaId: 'empresa-1',
      imagens: [
        { id: 'only', storageKey: 'empresas/e1/plates/p1/main/only.jpg', isMain: true },
      ],
    });
    mockedPlaca.findOne.mockReturnValue({ lean: leanFind } as never);

    const leanUpdate = jest.fn().mockResolvedValue({ _id: 'placa-1' });
    mockedPlaca.findOneAndUpdate.mockReturnValue({ populate: jest.fn().mockReturnValue({ lean: leanUpdate }) } as never);

    const result = await repository.removeImage('placa-1', 'empresa-1', 'only');

    expect(result.isSuccess).toBe(true);
    expect(mockedClear).toHaveBeenCalledWith('placa-1', 'empresa-1');
    expect(mockedSetActive).not.toHaveBeenCalled();
  });
});
