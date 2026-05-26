import Placa from '@modules/placas/Placa';
import Regiao from '@modules/regioes/Regiao';
import { comparePublicPlacasNaturally, listPlacas } from './public-plates.service';

jest.mock('@modules/placas/Placa', () => ({
  __esModule: true,
  default: {
    countDocuments: jest.fn(),
    find: jest.fn(),
  },
}));

jest.mock('@modules/regioes/Regiao', () => ({
  __esModule: true,
  default: {
    find: jest.fn(),
  },
}));

const mockedPlaca = Placa as jest.Mocked<typeof Placa>;
const mockedRegiao = Regiao as jest.Mocked<typeof Regiao>;

describe('public-plates natural sort', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRegiao.find.mockResolvedValue([] as any);
  });

  it('ordena naturalmente nomes como Placa 1, Placa 2, Placa 10', () => {
    const values = [
      { codigo: 'Placa 10', slug: 'placa-10', nome: 'Placa 10' },
      { codigo: 'Placa 2', slug: 'placa-2', nome: 'Placa 2' },
      { codigo: 'Placa 1', slug: 'placa-1', nome: 'Placa 1' },
    ];

    const sorted = [...values].sort(comparePublicPlacasNaturally);

    expect(sorted.map((item) => item.codigo)).toEqual(['Placa 1', 'Placa 2', 'Placa 10']);
  });

  it('ordena naturalmente codigos como CE-1, CE-2, CE-10', () => {
    const values = [
      { codigo: 'CE-10', slug: 'ce-10', nome: 'CE-10' },
      { codigo: 'CE-2', slug: 'ce-2', nome: 'CE-2' },
      { codigo: 'CE-1', slug: 'ce-1', nome: 'CE-1' },
    ];

    const sorted = [...values].sort(comparePublicPlacasNaturally);

    expect(sorted.map((item) => item.codigo)).toEqual(['CE-1', 'CE-2', 'CE-10']);
  });

  it('aplica ordenacao natural antes da paginacao final', async () => {
    mockedPlaca.countDocuments.mockResolvedValue(3 as any);
    mockedPlaca.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([
        { numero_placa: 'Placa 10', regiaoId: null, statusComercial: 'AVAILABLE', updatedAt: new Date().toISOString() },
        { numero_placa: 'Placa 2', regiaoId: null, statusComercial: 'AVAILABLE', updatedAt: new Date().toISOString() },
        { numero_placa: 'Placa 1', regiaoId: null, statusComercial: 'AVAILABLE', updatedAt: new Date().toISOString() },
      ]),
    } as any);

    const page1 = await listPlacas('empresa-1', {}, { page: 1, limit: 2 });
    const page2 = await listPlacas('empresa-1', {}, { page: 2, limit: 2 });

    expect(page1.data.map((item) => item.codigo)).toEqual(['Placa 1', 'Placa 2']);
    expect(page2.data.map((item) => item.codigo)).toEqual(['Placa 10']);
    expect(page1.pagination.total).toBe(3);
    expect(page1.pagination.pages).toBe(2);
  });
});
