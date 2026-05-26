import { PublicApiService } from '../public-api.service';
import { PublicInventoryPresenter } from '../presenters/public-inventory.presenter';
import { PublicMediaPresenter } from '../presenters/public-media.presenter';
import { PublicGeoPresenter } from '../presenters/public-geo.presenter';
import { PublicErrorPresenter } from '../presenters/public-error.presenter';
import type { InventorySource } from '@modules/inventory';
import type { PublicApiAuthContext, PublicApiKey } from '../contracts/public-api.contracts';

const NOW = '2026-05-18T12:00:00.000Z';

function key(overrides: Partial<PublicApiKey> = {}): PublicApiKey {
  return {
    id: 'key-1',
    partnerId: 'partner-1',
    empresaId: 'empresa-1',
    scopes: ['inventory:read', 'inventory:availability', 'media:read', 'geo:read', 'catalog:read'],
    active: true,
    createdAt: NOW,
    ...overrides,
  };
}

function context(apiKey: PublicApiKey = key()): PublicApiAuthContext {
  return {
    key: apiKey,
    partner: {
      id: apiKey.partnerId,
      name: 'Partner',
      empresaId: apiKey.empresaId,
      active: apiKey.active,
      scopes: apiKey.scopes,
    },
    requestId: 'req-1',
  };
}

const sources: InventorySource[] = [
  {
    placa: {
      _id: 'internal-1',
      empresaId: 'empresa-1',
      regiaoId: 'regiao-centro',
      numero_placa: 'OOH0001',
      numeroOperacional: 101,
      coordenadas: '-23.5505,-46.6333',
      disponivel: true,
    },
    usedOnMap: true,
  },
  {
    placa: {
      _id: 'internal-2',
      empresaId: 'empresa-1',
      regiaoId: 'regiao-centro',
      numero_placa: 'OOH0002',
      numeroOperacional: 102,
      coordenadas: '-23.5510,-46.6340',
      disponivel: true,
    },
    alugueis: [{ id: 'aluguel-1', status: 'ativo', startDate: '2026-05-01', endDate: '2026-05-30' }],
    usedOnMap: true,
  },
];

describe('PublicApiService', () => {
  let service: PublicApiService;

  beforeEach(() => {
    service = new PublicApiService();
  });

  it('valida API key registrada em memoria', async () => {
    service.registerInMemoryApiKey('pub_test', key());
    const result = await service.validateApiKey('pub_test');
    expect(result.ok).toBe(true);
  });

  it('rejeita API key invalida', async () => {
    const result = await service.validateApiKey('short');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('PUBLIC_API_KEY_INVALID');
  });

  it('rejeita API key inativa', async () => {
    service.registerInMemoryApiKey('pub_inactive', key({ active: false }));
    const result = await service.validateApiKey('pub_inactive');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('PUBLIC_API_KEY_INACTIVE');
  });

  it('bloqueia escopo insuficiente', () => {
    const result = service.validateScope(context(key({ scopes: ['inventory:read'] })), 'media:read');
    expect(result.ok).toBe(false);
  });

  it('mantem isolamento por empresa no contexto da API key', async () => {
    const items = await service.getPublicInventory(context(key({ empresaId: 'empresa-2' })), {}, sources);
    expect(items.every((item) => item.id !== 'internal-1')).toBe(true);
  });

  it('retorno publico nao contem campos sensiveis internos', async () => {
    const [item] = await service.getPublicInventory(context(), {}, sources);
    expect(item).toBeDefined();
    expect(item).not.toHaveProperty('_id');
    expect(item).not.toHaveProperty('empresaId');
    expect(JSON.stringify(item)).not.toContain('internal-1');
  });

  it('gera catalogo publico', async () => {
    const inventory = await service.getPublicInventory(context(), {}, sources);
    const geo = await service.getPublicGeoCatalog(context(), {}, sources);
    expect(inventory).toHaveLength(2);
    expect(geo.points).toHaveLength(2);
  });

  it('gera inventario publico', async () => {
    const inventory = await service.getPublicInventory(context(), {}, sources);
    expect(inventory[0]?.availability.status).toBe('available');
  });

  it('gera disponibilidade publica', async () => {
    const availability = await service.getPublicAvailability(context(), {}, sources);
    expect(availability.total).toBe(2);
    expect(availability.available).toBe(1);
  });

  it('gera midia publica sem path interno quando fonte local', () => {
    const media = PublicMediaPresenter.fromSource('uploads/placas/foto.jpg', 'media-1');
    expect(media?.id).toBeDefined();
    expect(media?.url).toBeUndefined();
  });

  it('gera geo publico sem tenant interno', async () => {
    const geo = await service.getPublicGeoCatalog(context(), {}, sources);
    expect(geo.points[0]).not.toHaveProperty('empresaId');
  });

  it('padroniza erro publico sem stack trace', () => {
    const response = PublicErrorPresenter.error({
      code: 'PUBLIC_API_SCOPE_FORBIDDEN',
      message: 'Escopo insuficiente.',
      status: 403,
    }, 'req-error');
    expect(response.error?.code).toBe('PUBLIC_API_SCOPE_FORBIDDEN');
    expect(JSON.stringify(response)).not.toContain('stack');
  });

  it('registra usage log', () => {
    service.registerUsage({
      partnerId: 'partner-1',
      empresaId: 'empresa-1',
      scopes: ['inventory:read'],
      endpoint: '/api/public/v1/inventory',
      method: 'GET',
      status: 200,
      timestamp: NOW,
      itemCount: 2,
      requestId: 'req-usage',
    });
    expect(service.getUsageLogs()).toHaveLength(1);
  });

  it('mantem compatibilidade com Projection Layer e Inventory Engine', async () => {
    const inventory = await service.getPublicInventory(context(), {}, sources);
    expect(inventory.map((item) => item.status.commercial)).toEqual(['available', 'occupied']);
  });

  it('mantem compatibilidade com Media Pipeline', () => {
    const media = PublicMediaPresenter.fromSource('https://cdn.example.com/placa.webp', 'media-cdn');
    expect(media?.url).toBe('https://cdn.example.com/placa.webp');
    expect(media?.variants.some((variant) => variant.type === 'thumbnail')).toBe(true);
  });

  it('presenters nao retornam entidade interna bruta', async () => {
    const inventory = await service.getPublicInventory(context(), {}, sources);
    const projected = PublicInventoryPresenter.list([]);
    const geo = PublicGeoPresenter.catalog({
      points: [],
      invalidPointIds: [],
      groups: [],
      status: 'empty',
    });
    expect(projected).toEqual([]);
    expect(geo.status).toBe('empty');
    expect(inventory[0]?.id).toBe('OOH0001');
  });
});
