import { Types } from 'mongoose';

jest.mock('./Aluguel', () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
    deleteOne: jest.fn(),
  },
}));

jest.mock('./aluguel-notification.service', () => ({
  __esModule: true,
  default: {
    notifyAluguelCancelado: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@shared/container/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() },
}));

import Aluguel from './Aluguel';
import AluguelService from './aluguel.service';

const mockedFindOne = Aluguel.findOne as jest.Mock;
const mockedDeleteOne = Aluguel.deleteOne as jest.Mock;

function findOneChain(value: unknown) {
  return {
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    session: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(value),
  };
}

describe('AluguelService legacy delete tenant hardening', () => {
  let service: AluguelService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AluguelService();
  });

  it('tenant A nao consegue deletar aluguel do tenant B', async () => {
    const aluguelId = new Types.ObjectId().toString();
    const tenantA = new Types.ObjectId().toString();

    mockedFindOne.mockReturnValue(findOneChain(null));

    await expect(service.deleteAluguel(aluguelId, tenantA)).rejects.toHaveProperty('statusCode', 404);
    expect(mockedFindOne).toHaveBeenCalledWith({ _id: aluguelId, empresaId: tenantA });
    expect(mockedDeleteOne).not.toHaveBeenCalled();
  });

  it('delete chama model com _id + empresaId', async () => {
    const aluguelId = new Types.ObjectId().toString();
    const empresaId = new Types.ObjectId().toString();

    mockedFindOne.mockReturnValue(findOneChain({
      _id: new Types.ObjectId(aluguelId),
      empresaId: new Types.ObjectId(empresaId),
      placaId: new Types.ObjectId(),
    }));
    mockedDeleteOne.mockResolvedValue({ deletedCount: 1 });

    await expect(service.deleteAluguel(aluguelId, empresaId)).resolves.toEqual({
      success: true,
      message: 'Aluguel cancelado com sucesso.',
    });

    expect(mockedDeleteOne).toHaveBeenCalledWith(
      { _id: aluguelId, empresaId },
      {},
    );
  });
});
