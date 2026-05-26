import Placa from '../Placa';
import { PlacaRepository } from '../repositories/placa.repository';

jest.mock('../Placa', () => ({
  __esModule: true,
  default: {
    updateOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
}));

const mockedPlaca = Placa as unknown as jest.Mocked<Pick<typeof Placa, 'updateOne' | 'findOneAndUpdate'>>;

describe('PlacaRepository image gallery', () => {
  const repository = new PlacaRepository();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('inicializa galeria ausente antes de marcar imagem principal', async () => {
    const lean = jest.fn().mockResolvedValue({
      _id: 'placa-1',
      empresaId: 'empresa-1',
      imagemPrincipal: 'https://cdn.example.com/placas/main.webp',
      imagem: 'https://cdn.example.com/placas/main.webp',
      imagens: [{
        id: 'image-1',
        url: 'https://cdn.example.com/placas/main.webp',
        isMain: true,
        category: 'MAIN',
      }],
    });
    const populate = jest.fn().mockReturnValue({ lean });

    mockedPlaca.updateOne.mockResolvedValue({ acknowledged: true, matchedCount: 1, modifiedCount: 1 } as never);
    mockedPlaca.findOneAndUpdate.mockReturnValue({ populate } as never);

    const result = await repository.addImage('placa-1', 'empresa-1', {
      url: 'https://cdn.example.com/placas/main.webp',
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
            url: 'https://cdn.example.com/placas/main.webp',
            isMain: true,
            source: 'UPLOAD',
          }),
        },
        $set: {
          imagemPrincipal: 'https://cdn.example.com/placas/main.webp',
          imagem: 'https://cdn.example.com/placas/main.webp',
        },
      }),
      { new: true, runValidators: true },
    );
  });
});
