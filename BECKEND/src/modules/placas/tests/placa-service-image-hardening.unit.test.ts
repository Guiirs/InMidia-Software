import { PlacaService } from '../services/placa.service';
import { mediaService } from '@modules/media/media.service';

jest.mock('@modules/regioes/Regiao', () => ({
  __esModule: true,
  default: { findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ _id: 'regiao-1' }) }) },
}));

jest.mock('@modules/alugueis/Aluguel', () => ({
  __esModule: true,
  default: { find: jest.fn() },
}));

jest.mock('@modules/commercial-projection/commercial-projection.service', () => ({
  commercialProjectionService: { resolve: jest.fn(), resolveBatch: jest.fn() },
}));

jest.mock('@modules/inventory', () => ({
  inventoryService: { buildInventorySummary: jest.fn().mockReturnValue({ diagnostics: [] }) },
}));

jest.mock('@modules/projections', () => ({
  projectionService: { rebuildProjection: jest.fn().mockReturnValue({ ok: true }) },
}));

jest.mock('@modules/media', () => ({
  mediaPipelineService: { processMediaAsset: jest.fn().mockReturnValue({ warnings: [] }) },
}));

jest.mock('@modules/media/media.service', () => ({
  mediaService: { uploadMedia: jest.fn(), setMain: jest.fn(), deleteMedia: jest.fn() },
}));

jest.mock('@modules/temporal', () => ({
  temporalEngine: {
    recordEvent: jest.fn().mockResolvedValue(undefined),
    assertPlateCanBeEdited: jest.fn().mockResolvedValue(undefined),
    getPlateTimeline: jest.fn(),
    checkPlateAvailability: jest.fn(),
    resolvePlateTemporalStatus: jest.fn(),
  },
}));

jest.mock('@modules/commercial-availability', () => ({
  commercialAvailabilityProjection: { resolvePlateCommercialStatus: jest.fn() },
}));

jest.mock('@shared/infra/http/middlewares/upload.middleware', () => ({
  safeDeleteFromR2: jest.fn().mockResolvedValue(undefined),
}));

const mockedMediaService = mediaService as jest.Mocked<typeof mediaService>;

function ok<T>(value: T) {
  return { isSuccess: true, isFailure: false, value };
}

function makeRepository(overrides: Record<string, jest.Mock> = {}) {
  return {
    findById: jest.fn().mockResolvedValue(ok({
      _id: 'placa-1',
      numero_placa: 'P-1',
      imagemPrincipal: 'empresas/e1/plates/p1/main/current.webp',
      imagem: 'empresas/e1/plates/p1/main/current.webp',
      imagens: [],
    })),
    update: jest.fn().mockResolvedValue(ok({ _id: 'placa-1', numero_placa: 'P-1' })),
    ...overrides,
  } as any;
}

function makeFile(overrides: Record<string, unknown> = {}): any {
  return {
    key: 'empresas/e1/plates/p1/main/upload.webp',
    location: '',
    bucket: 'bucket',
    mimetype: 'image/webp',
    originalname: 'upload.webp',
    size: 100,
    buffer: Buffer.from('image'),
    ...overrides,
  };
}

describe('PlacaService image edit hardening', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('nao sobrescreve imagem atual com valor vazio durante edicao', async () => {
    const repository = makeRepository();
    const service = new PlacaService(repository);

    const result = await service.updatePlaca('placa-1', { nomeDaRua: 'Rua Nova', imagem: '' }, undefined, 'empresa-1');

    expect(result.isSuccess).toBe(true);
    expect(repository.update).toHaveBeenCalledWith(
      'placa-1',
      expect.not.objectContaining({ imagem: expect.anything(), imagemPrincipal: expect.anything() }),
      'empresa-1',
      undefined,
    );
  });

  it('remove imagem quando edicao pede remocao explicita', async () => {
    const repository = makeRepository();
    const service = new PlacaService(repository);

    const result = await service.updatePlaca('placa-1', { imagem: null }, undefined, 'empresa-1');

    expect(result.isSuccess).toBe(true);
    // Campos legados não devem ser passados ao repositório — nem como null nem como undefined.
    const updatePayload = (repository.update as jest.Mock).mock.calls[0]![1];
    expect(updatePayload).not.toHaveProperty('imagem');
    expect(updatePayload).not.toHaveProperty('imagemPrincipal');
  });

  it('faz rollback de edicao quando upload centralizado e interrompido', async () => {
    const repository = makeRepository();
    mockedMediaService.uploadMedia.mockRejectedValue(new Error('upload interrupted'));
    const service = new PlacaService(repository);

    const result = await service.updatePlaca('placa-1', { nomeDaRua: 'Rua Nova' }, makeFile(), 'empresa-1');

    expect(result.isFailure).toBe(true);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('upload bem-sucedido retorna isSuccess sem validar storageKey separadamente', async () => {
    // After Phase 1 fix: uploadMedia is self-contained (handles R2 upload + PlateMedia sync).
    // The service no longer validates storageKey from the returned asset separately.
    const repository = makeRepository();
    mockedMediaService.uploadMedia.mockResolvedValue({ storageKey: 'upload.webp', url: 'upload.webp' } as any);
    const service = new PlacaService(repository);

    const result = await service.updatePlaca('placa-1', { nomeDaRua: 'Rua Nova' }, makeFile(), 'empresa-1');

    expect(result.isSuccess).toBe(true);
  });

  it('upload bem-sucedido nao grava imagem/imagemPrincipal no repositorio', async () => {
    // The repository.update is called for non-image fields only.
    // Image sync happens via mediaService.uploadMedia → syncPlateMedia → plateMediaService.
    const repository = makeRepository();
    mockedMediaService.uploadMedia.mockResolvedValue({
      storageKey: 'empresas/e1/plates/p1/main/upload.webp',
      url: 'https://pub-storage.r2.dev/empresas/e1/plates/p1/main/upload.webp',
    } as any);
    const service = new PlacaService(repository);

    const result = await service.updatePlaca('placa-1', { nomeDaRua: 'Rua Nova' }, makeFile(), 'empresa-1');

    expect(result.isSuccess).toBe(true);
    if (repository.update.mock.calls.length > 0) {
      expect(repository.update).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ imagem: expect.any(String) }),
        expect.anything(),
        expect.anything(),
      );
      expect(repository.update).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ imagemPrincipal: expect.any(String) }),
        expect.anything(),
        expect.anything(),
      );
    }
  });
});
