/**
 * plate-media-migration.test.ts
 *
 * Testa o contrato da arquitetura canônica de imagem (ARCH-3):
 *   PlateMedia.activeKey é a ÚNICA fonte de verdade.
 *
 * Cobre:
 *   - Upload → PlateMedia.activeKey atualizado
 *   - Troca de imagem → version incrementada
 *   - Remoção → activeKey limpo ou substituído pelo fallback da galeria
 *   - API pública → imagemUrl usa proxyUrl com ?v=
 *   - Cache busting → version muda após troca
 *   - Presenter → não usa campos legados
 *   - Service batch → retorna dados de PlateMedia
 */

import { PlateMediaService } from './plate-media.service';
import { toPublicPlaca, buildProxyImageUrl } from '../public-plates/public-plates.presenter';
import type { PlateMediaResolved } from '../public-plates/public-plates.presenter';

// ── Mocks ──────────────────────────────────────────────────────────────────────

jest.mock('./PlateMedia', () => {
  const store: Record<string, any> = {};

  return {
    __esModule: true,
    default: {
      findOne: jest.fn(({ plateId }) => ({
        lean: () => Promise.resolve(store[String(plateId)] ?? null),
      })),
      findOneAndUpdate: jest.fn(({ plateId }, update) => {
        const id = String(plateId);
        const existing = store[id] ?? { plateId: id, history: [] };
        const setFields = update.$set ?? {};
        const pushHistory = update.$push?.history?.$each?.[0] ?? null;
        const history = pushHistory
          ? [pushHistory, ...(existing.history ?? [])].slice(0, 50)
          : existing.history ?? [];
        store[id] = { ...existing, ...setFields, history };
        return Promise.resolve(store[id]);
      }),
      find: jest.fn(({ plateId: { $in: ids } }) => ({
        lean: () => Promise.resolve(ids.map((id: any) => store[String(id)]).filter(Boolean)),
      })),
    },
    _store: store,
  };
});

// ── Helpers ────────────────────────────────────────────────────────────────────

function makePlateId(n = 1) {
  return `507f1f77bcf86cd79943901${n}`;
}

function makeEmpresaId() {
  return '507f1f77bcf86cd799439010';
}

const R2_KEY_1 = 'empresas/emp1/plates/plate1/main/img1.jpg';
const R2_KEY_2 = 'empresas/emp1/plates/plate1/main/img2.jpg';

// ── Suite: PlateMediaService ───────────────────────────────────────────────────

describe('PlateMediaService', () => {
  let service: PlateMediaService;

  beforeEach(() => {
    service = new PlateMediaService();
    // Limpa o store entre testes
    const mod = jest.requireMock('./PlateMedia');
    Object.keys(mod._store).forEach((k) => delete mod._store[k]);
  });

  describe('setActivePlateImage', () => {
    it('cria documento PlateMedia com activeKey e version', async () => {
      const plateId = makePlateId(1);
      const empresaId = makeEmpresaId();

      await service.setActivePlateImage(plateId, empresaId, {
        key: R2_KEY_1,
        mimeType: 'image/jpeg',
        size: 100000,
        source: 'upload',
      });

      const result = await service.resolvePlateMainImage(plateId);
      expect(result.hasImage).toBe(true);
      expect(result.activeKey).toBe(R2_KEY_1);
      expect(result.version).toBeTruthy();
      expect(result.source).toBe('plate-media');
    });

    it('incrementa version quando imagem é trocada', async () => {
      const plateId = makePlateId(2);
      const empresaId = makeEmpresaId();

      await service.setActivePlateImage(plateId, empresaId, { key: R2_KEY_1, source: 'upload' });
      const first = await service.resolvePlateMainImage(plateId);

      // Pequeno delay para garantir timestamp diferente
      await new Promise((r) => setTimeout(r, 2));

      await service.setActivePlateImage(plateId, empresaId, { key: R2_KEY_2, source: 'upload' });
      const second = await service.resolvePlateMainImage(plateId);

      expect(second.activeKey).toBe(R2_KEY_2);
      expect(second.version).not.toBe(first.version);
    });

    it('mantém histórico após troca (history cresce)', async () => {
      const plateId = makePlateId(3);
      const empresaId = makeEmpresaId();
      const mod = jest.requireMock('./PlateMedia');

      await service.setActivePlateImage(plateId, empresaId, { key: R2_KEY_1, source: 'upload' });
      await service.setActivePlateImage(plateId, empresaId, { key: R2_KEY_2, source: 'upload' });

      const stored = mod._store[plateId];
      expect(stored.history.length).toBe(2);
      expect(stored.history[0].key).toBe(R2_KEY_2);
      expect(stored.history[1].key).toBe(R2_KEY_1);
    });

    it('ignora plateId inválido silenciosamente', async () => {
      await expect(
        service.setActivePlateImage('invalid-id', makeEmpresaId(), { key: R2_KEY_1 }),
      ).resolves.toBeUndefined();
    });
  });

  describe('clearActivePlateImage', () => {
    it('seta activeKey=null e status=missing', async () => {
      const plateId = makePlateId(4);
      const empresaId = makeEmpresaId();
      const mod = jest.requireMock('./PlateMedia');

      // Primeiro seta uma imagem
      mod._store[plateId] = { plateId, empresaId, activeKey: R2_KEY_1, status: 'active', version: '111', history: [] };

      await service.clearActivePlateImage(plateId, empresaId);

      const stored = mod._store[plateId];
      expect(stored.activeKey).toBeNull();
      expect(stored.status).toBe('missing');
    });
  });

  describe('resolvePlateMainImage', () => {
    it('retorna hasImage=false quando PlateMedia não existe', async () => {
      const result = await service.resolvePlateMainImage(makePlateId(99));
      expect(result.hasImage).toBe(false);
      expect(result.activeKey).toBeNull();
      expect(result.source).toBe('none');
    });

    it('retorna hasImage=false quando activeKey é null', async () => {
      const plateId = makePlateId(5);
      const mod = jest.requireMock('./PlateMedia');
      mod._store[plateId] = { plateId, activeKey: null, version: '', history: [] };

      const result = await service.resolvePlateMainImage(plateId);
      expect(result.hasImage).toBe(false);
    });

    it('retorna hasImage=true e activeKey quando existe', async () => {
      const plateId = makePlateId(6);
      const mod = jest.requireMock('./PlateMedia');
      mod._store[plateId] = { plateId, activeKey: R2_KEY_1, version: '1234567890', mimeType: 'image/jpeg', history: [] };

      const result = await service.resolvePlateMainImage(plateId);
      expect(result.hasImage).toBe(true);
      expect(result.activeKey).toBe(R2_KEY_1);
      expect(result.version).toBe('1234567890');
      expect(result.mimeType).toBe('image/jpeg');
      expect(result.source).toBe('plate-media');
    });
  });

  describe('batchResolvePlateMedia', () => {
    it('retorna mapa vazio para lista vazia', async () => {
      const result = await service.batchResolvePlateMedia([]);
      expect(result.size).toBe(0);
    });

    it('retorna dados de PlateMedia para os ids fornecidos', async () => {
      const plateId1 = makePlateId(7);
      const plateId2 = makePlateId(8);
      const mod = jest.requireMock('./PlateMedia');
      mod._store[plateId1] = { plateId: plateId1, activeKey: R2_KEY_1, version: '111', history: [] };
      mod._store[plateId2] = { plateId: plateId2, activeKey: R2_KEY_2, version: '222', history: [] };

      const result = await service.batchResolvePlateMedia([plateId1, plateId2]);
      expect(result.size).toBe(2);
      expect(result.get(plateId1)?.activeKey).toBe(R2_KEY_1);
      expect(result.get(plateId2)?.activeKey).toBe(R2_KEY_2);
    });
  });
});

// ── Suite: Presenter ───────────────────────────────────────────────────────────

describe('toPublicPlaca', () => {
  const baseDoc = {
    _id: '507f1f77bcf86cd799439001',
    numero_placa: 'INM-001',
    statusComercial: 'AVAILABLE',
    tipo: null,
    tamanho: null,
    latitude: null,
    longitude: null,
    endereco: 'Rua Teste, 123',
    updatedAt: new Date('2024-01-01'),
  };

  describe('com PlateMedia', () => {
    it('gera imagemUrl com ?v= para cache-busting', () => {
      const pm: PlateMediaResolved = { activeKey: R2_KEY_1, version: '1704067200000' };
      const result = toPublicPlaca(baseDoc, pm);

      expect(result.imagemUrl).toContain('/api/v1/public/media/plates/');
      expect(result.imagemUrl).toContain('?v=1704067200000');
      expect(result.hasImage).toBe(true);
    });

    it('aliases (imagem, jetImageUrl, image.url) apontam para o mesmo proxyUrl', () => {
      const pm: PlateMediaResolved = { activeKey: R2_KEY_1, version: '1704067200000' };
      const result = toPublicPlaca(baseDoc, pm);

      expect(result.imagem).toBe(result.imagemUrl);
      expect(result.jetImageUrl).toBe(result.imagemUrl);
      expect(result.jet_image_url).toBe(result.imagemUrl);
      expect(result.image?.url).toBe(result.imagemUrl);
      expect(result.jetImage?.url).toBe(result.imagemUrl);
    });

    it('URL do proxy muda quando version muda (cache-busting)', () => {
      const pm1: PlateMediaResolved = { activeKey: R2_KEY_1, version: '1000' };
      const pm2: PlateMediaResolved = { activeKey: R2_KEY_2, version: '2000' };

      const url1 = toPublicPlaca(baseDoc, pm1).imagemUrl;
      const url2 = toPublicPlaca(baseDoc, pm2).imagemUrl;

      expect(url1).not.toBe(url2);
      expect(url1).toContain('?v=1000');
      expect(url2).toContain('?v=2000');
    });
  });

  describe('sem PlateMedia', () => {
    it('retorna hasImage=false e imagemUrl=null', () => {
      const result = toPublicPlaca(baseDoc, null);
      expect(result.hasImage).toBe(false);
      expect(result.imagemUrl).toBeNull();
      expect(result.imagem).toBeNull();
      expect(result.jetImageUrl).toBeNull();
      expect(result.image).toBeNull();
    });

    it('nunca consulta campos legados do raw doc', () => {
      const docWithLegacy = {
        ...baseDoc,
        imagemPrincipal: 'should-be-ignored',
        imagem: 'should-be-ignored',
        foto: 'should-be-ignored',
      };
      const result = toPublicPlaca(docWithLegacy, null);
      expect(result.imagemUrl).toBeNull();
      expect(result.hasImage).toBe(false);
    });
  });

  describe('buildProxyImageUrl', () => {
    it('inclui ?v= quando version fornecida', () => {
      const url = buildProxyImageUrl('abc123', '1234567890');
      expect(url).toContain('?v=1234567890');
    });

    it('não inclui ?v= quando version vazia', () => {
      const url = buildProxyImageUrl('abc123', '');
      expect(url).not.toContain('?v=');
    });

    it('não inclui ?v= quando version undefined', () => {
      const url = buildProxyImageUrl('abc123');
      expect(url).not.toContain('?v=');
    });
  });
});

// ── Suite: Fluxo de upload end-to-end (integração leve) ───────────────────────

describe('Upload flow — PlateMedia como fonte única', () => {
  let service: PlateMediaService;

  beforeEach(() => {
    service = new PlateMediaService();
    const mod = jest.requireMock('./PlateMedia');
    Object.keys(mod._store).forEach((k) => delete mod._store[k]);
  });

  it('upload gera PlateMedia, troca gera nova version, proxy URL muda', async () => {
    // Usar ObjectId válido (24 hex chars) — makePlateId(n>9) gera strings inválidas
    const { Types: T } = jest.requireActual('mongoose') as typeof import('mongoose');
    const plateId = new T.ObjectId().toString();
    const empresaId = makeEmpresaId();

    // Simula upload inicial
    await service.setActivePlateImage(plateId, empresaId, {
      key: R2_KEY_1,
      mimeType: 'image/jpeg',
      source: 'upload',
    });

    const pm1 = await service.resolvePlateMainImage(plateId);
    const url1 = buildProxyImageUrl(plateId, pm1.version);

    // Pequeno delay para garantir timestamp diferente
    await new Promise((r) => setTimeout(r, 2));
    await service.setActivePlateImage(plateId, empresaId, {
      key: R2_KEY_2,
      mimeType: 'image/webp',
      source: 'upload',
    });

    const pm2 = await service.resolvePlateMainImage(plateId);
    const url2 = buildProxyImageUrl(plateId, pm2.version);

    expect(pm2.activeKey).toBe(R2_KEY_2);
    expect(pm2.version).not.toBe(pm1.version);
    expect(url1).not.toBe(url2);
    expect(url2).toContain(`?v=${pm2.version}`);
  });

  it('após remoção sem fallback, proxy retorna hasImage=false', async () => {
    const { Types: T } = jest.requireActual('mongoose') as typeof import('mongoose');
    const plateId = new T.ObjectId().toString();
    const empresaId = makeEmpresaId();

    await service.setActivePlateImage(plateId, empresaId, { key: R2_KEY_1, source: 'upload' });
    await service.clearActivePlateImage(plateId, empresaId);

    const result = await service.resolvePlateMainImage(plateId);
    expect(result.hasImage).toBe(false);
    expect(result.activeKey).toBeNull();

    const presenter = toPublicPlaca({ _id: plateId, numero_placa: 'X' }, null);
    expect(presenter.imagemUrl).toBeNull();
    expect(presenter.hasImage).toBe(false);
  });

  it('[REGRESSION] setActivePlateImage após upload não apaga nova key (anti-double-delete)', async () => {
    // Garante que após setActivePlateImage com nova key, uma segunda chamada a
    // clearActivePlateImage limpa corretamente — sem regredir nem deletar key errada.
    const { Types: T } = jest.requireActual('mongoose') as typeof import('mongoose');
    const plateId = new T.ObjectId().toString();
    const empresaId = makeEmpresaId();

    // Upload inicial: PlateMedia com key1
    await service.setActivePlateImage(plateId, empresaId, { key: R2_KEY_1, source: 'upload' });
    const pm1 = await service.resolvePlateMainImage(plateId);
    expect(pm1.activeKey).toBe(R2_KEY_1);

    // Troca de imagem: PlateMedia com key2 (simula o que uploadMedia/syncPlateMedia faz)
    await service.setActivePlateImage(plateId, empresaId, { key: R2_KEY_2, source: 'upload' });
    const pm2 = await service.resolvePlateMainImage(plateId);
    expect(pm2.activeKey).toBe(R2_KEY_2);

    // Clear: activeKey deve ser null
    await service.clearActivePlateImage(plateId, empresaId);
    const pm3 = await service.resolvePlateMainImage(plateId);
    expect(pm3.hasImage).toBe(false);
    expect(pm3.activeKey).toBeNull();

    // Reativação funciona normalmente após o clear
    await service.setActivePlateImage(plateId, empresaId, { key: R2_KEY_1, source: 'repair' });
    const pm4 = await service.resolvePlateMainImage(plateId);
    expect(pm4.hasImage).toBe(true);
    expect(pm4.activeKey).toBe(R2_KEY_1);
  });

  it('[REGRESSION] proxy URL não expõe activeKey nem r2Key na resposta pública', async () => {
    const { Types: T } = jest.requireActual('mongoose') as typeof import('mongoose');
    const plateId = new T.ObjectId().toString();
    const empresaId = makeEmpresaId();

    await service.setActivePlateImage(plateId, empresaId, { key: R2_KEY_1, source: 'upload' });
    const pm = await service.resolvePlateMainImage(plateId);

    // buildProxyImageUrl retorna URL do proxy, nunca a R2 key
    const proxyUrl = buildProxyImageUrl(plateId, pm.version);
    expect(proxyUrl).toContain('/api/v1/public/media/plates/');
    expect(proxyUrl).not.toContain(R2_KEY_1);
    expect(proxyUrl).not.toContain('empresas/');

    // toPublicPlaca nunca expõe activeKey ou r2Key
    const pmResolved = pm.hasImage ? { activeKey: pm.activeKey, version: pm.version } : null;
    const publicPayload = toPublicPlaca({ _id: plateId, numero_placa: 'INM-TEST' }, pmResolved);
    const payloadJson = JSON.stringify(publicPayload);
    expect(payloadJson).not.toContain(R2_KEY_1);
    expect(payloadJson).not.toContain('activeKey');
    expect(payloadJson).not.toContain('r2Key');
    expect(publicPayload.imagemUrl).toContain('/api/v1/public/media/plates/');
  });
});
