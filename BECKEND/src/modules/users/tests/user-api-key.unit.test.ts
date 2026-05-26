import bcrypt from 'bcrypt';
import UserService from '../user.service';
import User from '../User';
import Empresa from '@modules/empresas/Empresa';
import { publicApiKeyManager } from '@modules/public-api/managers/public-api-key.manager';

jest.mock('../User', () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
}));

jest.mock('@modules/empresas/Empresa', () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
  },
}));

jest.mock('@modules/public-api/managers/public-api-key.manager', () => ({
  publicApiKeyManager: {
    invalidateByEmpresaId: jest.fn(),
  },
}));

const mockedUser = User as jest.Mocked<typeof User>;
const mockedEmpresa = Empresa as jest.Mocked<typeof Empresa>;
const mockedPublicApiKeyManager = publicApiKeyManager as jest.Mocked<typeof publicApiKeyManager>;

describe('UserService.regenerateApiKey', () => {
  let service: UserService;

  beforeEach(() => {
    service = new UserService();
    jest.clearAllMocks();
  });

  function mockFindByIdSequence(userTest: any, userWithPassword: any) {
    mockedUser.findById
      .mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(userTest),
      } as any)
      .mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(userWithPassword),
      } as any);
  }

  it('aceita senha correta quando o hash valido esta no mesmo campo priorizado pelo login', async () => {
    const validPassword = 'Admin123!';
    const currentHash = await bcrypt.hash(validPassword, 10);

    mockFindByIdSequence(
      { _id: 'user-1', empresa: 'empresa-1', email: 'admin@inmidia.com' },
      { _id: 'user-1', empresa: 'empresa-1', email: 'admin@inmidia.com', senha: currentHash, password: currentHash },
    );

    const empresaDoc = {
      nome: 'InMidia',
      save: jest.fn().mockResolvedValue(undefined),
    };

    mockedEmpresa.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue(empresaDoc),
    } as any);

    const result = await service.regenerateApiKey(
      'user-1',
      'empresa-1',
      'admin_empresa',
      validPassword,
      {},
    );

    expect(result.fullApiKey).toContain('_');
    expect(result.newPrefix).toContain('_');
    expect(empresaDoc.save).toHaveBeenCalled();
    expect(mockedPublicApiKeyManager.invalidateByEmpresaId).toHaveBeenCalledWith('empresa-1');
  });

  it('retorna 422 quando a senha esta incorreta', async () => {
    const validHash = await bcrypt.hash('Admin123!', 10);

    mockFindByIdSequence(
      { _id: 'user-1', empresa: 'empresa-1', email: 'admin@inmidia.com' },
      { _id: 'user-1', empresa: 'empresa-1', email: 'admin@inmidia.com', senha: validHash },
    );

    await expect(
      service.regenerateApiKey('user-1', 'empresa-1', 'admin', 'SenhaErrada', {}),
    ).rejects.toMatchObject({
      statusCode: 422,
      message: 'Senha incorreta. Verificação falhou.',
    });
  });
});
