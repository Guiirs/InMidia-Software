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

const mockedPlaca = Placa as unknown as jest.Mocked<Pick<typeof Placa, 'updateOne' | 'findOne' | 'findOneAndUpdate'>>;

describe('PlacaRepository image gallery', () => {
  const repository = new PlacaRepository();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('inicializa galeria ausente antes de marcar imagem principal', async () => {
    const lean = jest.fn().mockResolvedValue({
      _id: 'placa-1',
      empresaId: 'empresa-1',
      imagemPrincipal: 'https://pub-storage.r2.dev/placas/main.webp',
      imagem: 'https://pub-storage.r2.dev/placas/main.webp',
      imagens: [{
        id: 'image-1',
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
      filename: 'main.webp',
      category: 'MAIN',
      setAsMain: true,
    });

    expect(result.isSuccess).toBe(true);
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
        $set: {
          imagemPrincipal: 'placas/main.webp',
          imagem: 'placas/main.webp',
        },
      }),
      { new: true, runValidators: true },
    );
  });

  it('troca imagem principal usando key canonica da galeria', async () => {
    const leanFind = jest.fn().mockResolvedValue({
      _id: 'placa-1',
      empresaId: 'empresa-1',
      imagens: [
        { id: 'old', storageKey: 'empresas/e1/plates/p1/history/old.jpg', isMain: true },
        { id: 'new', publicUrl: 'https://pub-storage.r2.dev/empresas/e1/plates/p1/main/new.webp' },
      ],
    });
    mockedPlaca.findOne.mockReturnValue({ lean: leanFind } as never);

    const leanUpdate = jest.fn().mockResolvedValue({ _id: 'placa-1' });
    mockedPlaca.findOneAndUpdate.mockReturnValue({ populate: jest.fn().mockReturnValue({ lean: leanUpdate }) } as never);

    const result = await repository.setMainImage('placa-1', 'empresa-1', 'new');

    expect(result.isSuccess).toBe(true);
    expect(mockedPlaca.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'placa-1', empresaId: 'empresa-1' },
      expect.objectContaining({
        $set: expect.objectContaining({
          imagemPrincipal: 'empresas/e1/plates/p1/main/new.webp',
          imagem: 'empresas/e1/plates/p1/main/new.webp',
          imagens: expect.arrayContaining([
            expect.objectContaining({ id: 'old', isMain: false }),
            expect.objectContaining({ id: 'new', isMain: true }),
          ]),
        }),
      }),
      { new: true },
    );
  });

  it('remove imagem principal e promove fallback canonico sem quebrar galeria parcial', async () => {
    const leanFind = jest.fn().mockResolvedValue({
      _id: 'placa-1',
      empresaId: 'empresa-1',
      imagemPrincipal: 'empresas/e1/plates/p1/main/current.webp',
      imagem: 'empresas/e1/plates/p1/main/current.webp',
      imagens: [
        { id: 'current', storageKey: 'empresas/e1/plates/p1/main/current.webp', isMain: true },
        { id: 'fallback', r2Key: 'empresas/e1/plates/p1/history/fallback.jpg' },
      ],
    });
    mockedPlaca.findOne.mockReturnValue({ lean: leanFind } as never);

    const leanUpdate = jest.fn().mockResolvedValue({ _id: 'placa-1' });
    mockedPlaca.findOneAndUpdate.mockReturnValue({ populate: jest.fn().mockReturnValue({ lean: leanUpdate }) } as never);

    const result = await repository.removeImage('placa-1', 'empresa-1', 'current');

    expect(result.isSuccess).toBe(true);
    expect(mockedPlaca.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'placa-1', empresaId: 'empresa-1' },
      expect.objectContaining({
        $set: expect.objectContaining({
          imagemPrincipal: 'empresas/e1/plates/p1/history/fallback.jpg',
          imagem: 'empresas/e1/plates/p1/history/fallback.jpg',
          imagens: [expect.objectContaining({ id: 'fallback', isMain: true })],
        }),
      }),
      { new: true },
    );
  });
});
