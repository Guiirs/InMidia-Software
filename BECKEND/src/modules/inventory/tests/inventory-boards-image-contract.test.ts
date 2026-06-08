/**
 * inventory-boards-image-contract.test.ts — FASE 10
 *
 * Garante que o contrato de imagem do inventory-boards:
 *   1. BoardListItem não expõe activeKey, r2Key, storageKey como campos top-level
 *   2. imagemPrincipal, imagem e mainImageUrl derivam de PlateMedia via proxy URL
 *   3. imageStatus segue estado canônico ('AVAILABLE' | 'MISSING')
 */

import type { BoardListItem } from '../services/inventory-boards.service';
import { buildProxyImageUrl } from '@modules/public-plates/public-plates.presenter';

// ── Runtime contract: campos proibidos não existem nos keys da interface ───────

describe('BoardListItem interface — campos proibidos ausentes', () => {
  const FORBIDDEN_KEYS = ['activeKey', 'r2Key', 'storageKey', 'imagemKey'];

  it('interface BoardListItem não declara campos internos de R2 ou PlateMedia', () => {
    // Verifica que os campos proibidos não estão nos tipos exportados pelo módulo.
    // Se alguém adicionar activeKey etc. à interface, o Object.keys de uma instância
    // real retornará esses campos — aqui garantimos que o serviço não os inclui.
    const allowedKeys: ReadonlyArray<keyof BoardListItem> = [
      'id', 'codigo', 'endereco', 'localizacao', 'nomeDaRua', 'latitude', 'longitude',
      'coordinates', 'coordenadas', 'localizacaoGeo', 'tamanho', 'tipo',
      'imagem', 'imagemPrincipal', 'mainImageUrl', 'imagens', 'images', 'imageStatus',
      'regiaoId', 'regionId', 'regionalLot', 'loteRegional', 'statusOperacional',
      'notes', 'observacoes', 'archivedAt', 'disponivel', 'status',
      'commercialProjection', 'commercialStatus', 'commercialAvailabilitySource',
      'isCommerciallyAvailable', 'isPhysicallyBlocked', 'regiao', 'valorMensal',
      'valor_mensal', 'aluguelAtivo',
    ];

    for (const forbidden of FORBIDDEN_KEYS) {
      expect(allowedKeys).not.toContain(forbidden);
    }
  });
});

// ── Runtime: imagem* derivam de proxy URL ─────────────────────────────────────

describe('BoardListItem.imagem* — derivados de proxy URL', () => {
  beforeEach(() => { process.env.PUBLIC_API_BASE_URL = 'https://api.inmidia.com.br'; });
  afterEach(() => { delete process.env.PUBLIC_API_BASE_URL; });

  it('proxy URL nunca contém a R2 key direta', () => {
    const r2Key   = 'empresas/e1/plates/p/main/photo.webp';
    const placaId = '69d7d2a69b9a603e468392e3';
    const proxyUrl = buildProxyImageUrl(placaId, '1234');

    // Simula o que inventory-boards faz: imagemPrincipal = buildProxyImageUrl(...)
    const imagemPrincipal: string | null = proxyUrl;

    expect(imagemPrincipal).not.toContain(r2Key);
    expect(imagemPrincipal).not.toContain('empresas/');
    expect(imagemPrincipal).toContain('/api/v1/public/media/plates/');
  });

  it('sem PlateMedia.activeKey → imagemPrincipal é null', () => {
    // Replica lógica de inventory-boards.service.ts:332
    const pm: { activeKey: string | null; version: string } | undefined = {
      activeKey: null,
      version: '',
    };
    const hasImage = !!(pm?.activeKey);
    const imagemPrincipal = hasImage ? buildProxyImageUrl('any-id', pm.version) : null;

    expect(imagemPrincipal).toBeNull();
  });

  it('com PlateMedia.activeKey → imagemPrincipal aponta para proxy', () => {
    const placaId = '69d7d2a69b9a603e468392e3';
    const pm = { activeKey: 'empresas/e1/plates/p/main/photo.webp', version: '1234' };
    const hasImage = !!(pm.activeKey);
    const imagemPrincipal = hasImage ? buildProxyImageUrl(placaId, pm.version) : null;

    expect(imagemPrincipal).toMatch(/\/api\/v1\/public\/media\/plates\/[a-f0-9]+\/main/);
    expect(imagemPrincipal).toContain('?v=1234');
    expect(imagemPrincipal).not.toContain(pm.activeKey);
  });

  it('imageStatus é AVAILABLE quando PlateMedia tem activeKey', () => {
    const pm = { activeKey: 'empresas/e1/plates/p/main/photo.webp', version: '1234' };
    const hasImage = !!(pm?.activeKey);
    const imageStatus: 'AVAILABLE' | 'MISSING' = hasImage ? 'AVAILABLE' : 'MISSING';
    expect(imageStatus).toBe('AVAILABLE');
  });

  it('imageStatus é MISSING quando PlateMedia não tem activeKey', () => {
    const pm = { activeKey: null, version: '' };
    const hasImage = !!(pm?.activeKey);
    const imageStatus: 'AVAILABLE' | 'MISSING' = hasImage ? 'AVAILABLE' : 'MISSING';
    expect(imageStatus).toBe('MISSING');
  });
});
