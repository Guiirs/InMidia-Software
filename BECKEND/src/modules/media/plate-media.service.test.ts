/**
 * Testes do PlateMediaService — fonte canônica de imagem para placas.
 *
 * Cobre:
 *   1. getPlateMedia retorna documento quando existe
 *   2. getPlateMedia retorna null quando não existe
 *   3. getPlateMedia é resiliente a erros (retorna null, não lança)
 *   4. setActivePlateImage cria documento com activeKey e status=active
 *   5. setActivePlateImage atualiza key ativa via upsert
 *   6. setActivePlateImage é resiliente a erros (não lança)
 *   7. clearActivePlateImage seta activeKey=null e status=missing
 *   8. clearActivePlateImage é resiliente a erros (não lança)
 *   9. resolvePlateMainImage retorna hasImage=true quando PlateMedia tem activeKey
 *  10. resolvePlateMainImage retorna hasImage=false quando não há documento
 *  11. resolvePlateMainImage retorna hasImage=false quando activeKey é null
 *  12. resolvePlateMainImage é resiliente a erros (retorna hasImage=false)
 *  13. batchResolvePlateMedia retorna Map vazia para lista vazia
 *  14. batchResolvePlateMedia retorna Map com documentos encontrados
 *  15. setActivePlateImage rejeita plateId inválido (sem lançar)
 *  16. Apenas uma imagem ativa por placa (upsert, não duplica)
 */

jest.mock('./PlateMedia');
jest.mock('@shared/container/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() },
}));

import { Types } from 'mongoose';
import PlateMedia from './PlateMedia';
import { PlateMediaService } from './plate-media.service';

const mockedFindOne        = PlateMedia.findOne as jest.Mock;
const mockedFindOneUpdate  = PlateMedia.findOneAndUpdate as jest.Mock;
const mockedFind           = PlateMedia.find as jest.Mock;

// ── helpers ───────────────────────────────────────────────────────────────────

const PLATE_ID   = new Types.ObjectId().toString();
const EMPRESA_ID = new Types.ObjectId().toString();
const ACTIVE_KEY = 'empresas/emp1/plates/abc/main/img.jpg';

function makePlateMediaDoc(overrides: Record<string, unknown> = {}) {
  return {
    plateId:   new Types.ObjectId(PLATE_ID),
    empresaId: new Types.ObjectId(EMPRESA_ID),
    activeKey: ACTIVE_KEY,
    status:    'active',
    version:   '1700000000000',
    mimeType:  'image/jpeg',
    size:      12345,
    width:     null,
    height:    null,
    history:   [],
    ...overrides,
  };
}

function leanMock(value: unknown) {
  return { lean: () => Promise.resolve(value) };
}

let service: PlateMediaService;

beforeEach(() => {
  jest.clearAllMocks();
  service = new PlateMediaService();
});

// ── 1. getPlateMedia — documento existe ──────────────────────────────────────

describe('getPlateMedia', () => {
  it('retorna documento quando existe', async () => {
    const doc = makePlateMediaDoc();
    mockedFindOne.mockReturnValue(leanMock(doc));
    const result = await service.getPlateMedia(PLATE_ID, EMPRESA_ID);
    expect(result).toMatchObject({ activeKey: ACTIVE_KEY, status: 'active' });
    expect(mockedFindOne).toHaveBeenCalledWith(expect.objectContaining({
      plateId: expect.any(Types.ObjectId),
      empresaId: expect.any(Types.ObjectId),
    }));
  });

  it('retorna null quando não existe', async () => {
    mockedFindOne.mockReturnValue(leanMock(null));
    const result = await service.getPlateMedia(PLATE_ID);
    expect(result).toBeNull();
  });

  it('retorna null quando plateId inválido', async () => {
    const result = await service.getPlateMedia('not-a-valid-id');
    expect(result).toBeNull();
    expect(mockedFindOne).not.toHaveBeenCalled();
  });

  it('retorna null sem lançar quando PlateMedia.findOne lança', async () => {
    mockedFindOne.mockReturnValue({ lean: () => Promise.reject(new Error('DB error')) });
    await expect(service.getPlateMedia(PLATE_ID)).resolves.toBeNull();
  });
});

// ── 4–6. setActivePlateImage ─────────────────────────────────────────────────

describe('setActivePlateImage', () => {
  it('chama findOneAndUpdate com activeKey e status=active', async () => {
    mockedFindOneUpdate.mockResolvedValue(makePlateMediaDoc());
    await service.setActivePlateImage(PLATE_ID, EMPRESA_ID, { key: ACTIVE_KEY });
    expect(mockedFindOneUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ plateId: expect.any(Types.ObjectId), empresaId: expect.any(Types.ObjectId) }),
      expect.objectContaining({
        $set: expect.objectContaining({ activeKey: ACTIVE_KEY, status: 'active' }),
      }),
      expect.objectContaining({ upsert: true }),
    );
  });

  it('usa upsert=true (não duplica documento)', async () => {
    mockedFindOneUpdate.mockResolvedValue(makePlateMediaDoc());
    await service.setActivePlateImage(PLATE_ID, EMPRESA_ID, { key: ACTIVE_KEY });
    const [, , options] = mockedFindOneUpdate.mock.calls[0];
    expect(options.upsert).toBe(true);
  });

  it('inclui entry no history com isActive=true', async () => {
    mockedFindOneUpdate.mockResolvedValue(makePlateMediaDoc());
    await service.setActivePlateImage(PLATE_ID, EMPRESA_ID, {
      key: ACTIVE_KEY,
      source: 'upload',
    });
    const [, update] = mockedFindOneUpdate.mock.calls[0];
    expect(update.$push.history.$each[0]).toMatchObject({
      key: ACTIVE_KEY,
      isActive: true,
      source: 'upload',
    });
  });

  it('não lança quando findOneAndUpdate lança', async () => {
    mockedFindOneUpdate.mockRejectedValue(new Error('DB error'));
    await expect(
      service.setActivePlateImage(PLATE_ID, EMPRESA_ID, { key: ACTIVE_KEY }),
    ).resolves.toBeUndefined();
  });

  it('ignora quando plateId inválido', async () => {
    await service.setActivePlateImage('invalid', EMPRESA_ID, { key: ACTIVE_KEY });
    expect(mockedFindOneUpdate).not.toHaveBeenCalled();
  });
});

// ── 7–8. clearActivePlateImage ───────────────────────────────────────────────

describe('clearActivePlateImage', () => {
  it('seta activeKey=null e status=missing', async () => {
    mockedFindOneUpdate.mockResolvedValue(null);
    await service.clearActivePlateImage(PLATE_ID, EMPRESA_ID);
    expect(mockedFindOneUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ plateId: expect.any(Types.ObjectId), empresaId: expect.any(Types.ObjectId) }),
      expect.objectContaining({
        $set: expect.objectContaining({ activeKey: null, status: 'missing' }),
      }),
      expect.objectContaining({ upsert: false }),
    );
  });

  it('não lança quando findOneAndUpdate lança', async () => {
    mockedFindOneUpdate.mockRejectedValue(new Error('DB error'));
    await expect(service.clearActivePlateImage(PLATE_ID, EMPRESA_ID)).resolves.toBeUndefined();
  });
});

// ── 9–12. resolvePlateMainImage ──────────────────────────────────────────────

describe('resolvePlateMainImage', () => {
  it('retorna hasImage=true quando PlateMedia tem activeKey', async () => {
    const doc = makePlateMediaDoc({ activeKey: ACTIVE_KEY, version: '1700000000000' });
    mockedFindOne.mockReturnValue(leanMock(doc));
    const result = await service.resolvePlateMainImage(PLATE_ID, EMPRESA_ID);
    expect(result.hasImage).toBe(true);
    expect(result.activeKey).toBe(ACTIVE_KEY);
    expect(result.source).toBe('plate-media');
    expect(result.version).toBe('1700000000000');
    expect(mockedFindOne).toHaveBeenCalledWith(expect.objectContaining({
      plateId: expect.any(Types.ObjectId),
      empresaId: expect.any(Types.ObjectId),
    }));
  });

  it('tenant A nao resolve PlateMedia de tenant B', async () => {
    mockedFindOne.mockReturnValue(leanMock(null));
    const result = await service.resolvePlateMainImage(PLATE_ID, new Types.ObjectId().toString());
    expect(result.hasImage).toBe(false);
    expect(mockedFindOne).toHaveBeenCalledWith(expect.objectContaining({
      plateId: expect.any(Types.ObjectId),
      empresaId: expect.any(Types.ObjectId),
    }));
  });

  it('retorna hasImage=false quando não há documento PlateMedia', async () => {
    mockedFindOne.mockReturnValue(leanMock(null));
    const result = await service.resolvePlateMainImage(PLATE_ID);
    expect(result.hasImage).toBe(false);
    expect(result.activeKey).toBeNull();
    expect(result.source).toBe('none');
  });

  it('retorna hasImage=false quando PlateMedia existe mas activeKey é null', async () => {
    const doc = makePlateMediaDoc({ activeKey: null, status: 'missing' });
    mockedFindOne.mockReturnValue(leanMock(doc));
    const result = await service.resolvePlateMainImage(PLATE_ID);
    expect(result.hasImage).toBe(false);
  });

  it('retorna hasImage=false sem lançar quando DB lança', async () => {
    mockedFindOne.mockReturnValue({ lean: () => Promise.reject(new Error('DB error')) });
    const result = await service.resolvePlateMainImage(PLATE_ID);
    expect(result.hasImage).toBe(false);
    expect(result.source).toBe('none');
  });

  it('retorna hasImage=false para plateId inválido', async () => {
    const result = await service.resolvePlateMainImage('not-a-valid-id');
    expect(result.hasImage).toBe(false);
    expect(mockedFindOne).not.toHaveBeenCalled();
  });
});

// ── 13–14. batchResolvePlateMedia ────────────────────────────────────────────

describe('batchResolvePlateMedia', () => {
  it('retorna Map vazia para lista vazia', async () => {
    const result = await service.batchResolvePlateMedia([]);
    expect(result.size).toBe(0);
    expect(mockedFind).not.toHaveBeenCalled();
  });

  it('retorna Map com documentos encontrados', async () => {
    const id1 = new Types.ObjectId().toString();
    const id2 = new Types.ObjectId().toString();
    const doc1 = makePlateMediaDoc({ plateId: new Types.ObjectId(id1), activeKey: 'key1' });
    const doc2 = makePlateMediaDoc({ plateId: new Types.ObjectId(id2), activeKey: 'key2' });
    mockedFind.mockReturnValue({ lean: () => Promise.resolve([doc1, doc2]) });

    const result = await service.batchResolvePlateMedia([id1, id2], EMPRESA_ID);
    expect(result.size).toBe(2);
    expect(result.get(id1)?.activeKey).toBe('key1');
    expect(result.get(id2)?.activeKey).toBe('key2');
    expect(mockedFind).toHaveBeenCalledWith(expect.objectContaining({
      plateId: expect.any(Object),
      empresaId: expect.any(Types.ObjectId),
    }));
  });

  it('batchResolvePlateMedia filtra por empresa e nao cruza tenants', async () => {
    const id1 = new Types.ObjectId().toString();
    const id2 = new Types.ObjectId().toString();
    const doc1 = makePlateMediaDoc({ plateId: new Types.ObjectId(id1), activeKey: 'tenant-a-key' });
    mockedFind.mockReturnValue({ lean: () => Promise.resolve([doc1]) });

    const result = await service.batchResolvePlateMedia([id1, id2], EMPRESA_ID);
    expect(result.size).toBe(1);
    expect(result.has(id1)).toBe(true);
    expect(result.has(id2)).toBe(false);
    expect(mockedFind).toHaveBeenCalledWith(expect.objectContaining({
      empresaId: expect.any(Types.ObjectId),
    }));
  });

  it('retorna Map vazia sem lançar quando DB lança', async () => {
    mockedFind.mockReturnValue({ lean: () => Promise.reject(new Error('DB error')) });
    const result = await service.batchResolvePlateMedia([PLATE_ID]);
    expect(result.size).toBe(0);
  });

  it('ignora IDs inválidos sem lançar', async () => {
    mockedFind.mockReturnValue({ lean: () => Promise.resolve([]) });
    const result = await service.batchResolvePlateMedia(['invalid-id', PLATE_ID]);
    expect(result.size).toBe(0);
  });
});

// ── 16. Keyspace isolado da imagem ───────────────────────────────────────────

describe('isolamento por tenant', () => {
  it('setActivePlateImage usa plateId + empresaId como filtro de upsert', async () => {
    mockedFindOneUpdate.mockResolvedValue(makePlateMediaDoc());
    await service.setActivePlateImage(PLATE_ID, EMPRESA_ID, { key: 'key-1' });
    await service.setActivePlateImage(PLATE_ID, EMPRESA_ID, { key: 'key-2' });
    const call1Filter = mockedFindOneUpdate.mock.calls[0][0];
    const call2Filter = mockedFindOneUpdate.mock.calls[1][0];
    expect(call1Filter.plateId.toString()).toBe(new Types.ObjectId(PLATE_ID).toString());
    expect(call1Filter.empresaId.toString()).toBe(new Types.ObjectId(EMPRESA_ID).toString());
    expect(call2Filter.plateId.toString()).toBe(new Types.ObjectId(PLATE_ID).toString());
    expect(call2Filter.empresaId.toString()).toBe(new Types.ObjectId(EMPRESA_ID).toString());
  });
});
