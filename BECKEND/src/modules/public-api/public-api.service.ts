import bcrypt from 'bcryptjs';
import Empresa from '@modules/empresas/Empresa';
import Placa from '@modules/placas/Placa';
import { inventoryService, type InventorySource } from '@modules/inventory';
import { projectionService, type ProjectionSnapshot } from '@modules/projections';
import logger from '@shared/container/logger';
import type {
  PublicApiAuthContext,
  PublicApiError,
  PublicApiKey,
  PublicApiQueryOptions,
  PublicApiResponse,
  PublicApiScope,
  PublicApiUsageLog,
} from './contracts/public-api.contracts';
import { PublicErrorPresenter } from './presenters/public-error.presenter';
import { PublicGeoPresenter } from './presenters/public-geo.presenter';
import { PublicInventoryPresenter, type PublicInventorySourceView } from './presenters/public-inventory.presenter';

const DEFAULT_SCOPES: PublicApiScope[] = [
  'inventory:read',
  'inventory:availability',
  'media:read',
  'geo:read',
  'catalog:read',
];

const MAX_PUBLIC_LIMIT = 100;

type PlacaPublicDoc = {
  _id?: unknown;
  id?: unknown;
  empresaId?: unknown;
  regiaoId?: unknown;
  regiao?: { nome?: string };
  numero_placa?: string;
  numeroOperacional?: number | null;
  coordenadas?: string | null;
  nomeDaRua?: string;
  tamanho?: string;
  imagem?: unknown;
  disponivel?: boolean | null;
};

function publicApiError(
  code: PublicApiError['code'],
  message: string,
  status: number,
): PublicApiError {
  return { code, message, status };
}

function sourceFromPlaca(placa: PlacaPublicDoc): InventorySource {
  return {
    placa: {
      _id: placa._id ?? placa.id,
      empresaId: placa.empresaId,
      regiaoId: placa.regiaoId,
      numero_placa: placa.numero_placa,
      numeroOperacional: placa.numeroOperacional ?? undefined,
      coordenadas: placa.coordenadas ?? null,
      disponivel: placa.disponivel ?? null,
    },
    usedOnMap: true,
  };
}

function viewFromSource(source: InventorySource, snapshot: ProjectionSnapshot, raw?: PlacaPublicDoc): PublicInventorySourceView | null {
  const placaId = String(source.placa._id ?? source.placa.id ?? '');
  const item = snapshot.inventory.items.find((candidate) => candidate.placaId === placaId);
  if (!item) return null;

  return {
    item,
    source: {
      nomeDaRua: raw?.nomeDaRua,
      tamanho: raw?.tamanho,
      imagem: raw?.imagem,
      regiaoNome: raw?.regiao?.nome,
    },
  };
}

export class PublicApiService {
  private readonly registeredKeys = new Map<string, PublicApiKey>();
  private readonly usageLogs: PublicApiUsageLog[] = [];

  registerInMemoryApiKey(key: string, apiKey: PublicApiKey): void {
    this.registeredKeys.set(key, apiKey);
  }

  clearInMemoryApiKeys(): void {
    this.registeredKeys.clear();
    this.usageLogs.length = 0;
  }

  getUsageLogs(): PublicApiUsageLog[] {
    return [...this.usageLogs];
  }

  async validateApiKey(rawKey: string | undefined): Promise<{ ok: true; context: PublicApiAuthContext } | { ok: false; error: PublicApiError }> {
    if (!rawKey) {
      return { ok: false, error: publicApiError('PUBLIC_API_KEY_MISSING', 'API key ausente.', 401) };
    }

    const registered = this.registeredKeys.get(rawKey);
    if (registered) {
      if (!registered.active) {
        return { ok: false, error: publicApiError('PUBLIC_API_KEY_INACTIVE', 'API key inativa.', 403) };
      }

      return {
        ok: true,
        context: {
          key: registered,
          partner: {
            id: registered.partnerId,
            name: registered.partnerId,
            empresaId: registered.empresaId,
            active: true,
            scopes: registered.scopes,
          },
          requestId: cryptoRandomId(),
        },
      };
    }

    const parts = rawKey.split('_');
    if (parts.length < 2) {
      return { ok: false, error: publicApiError('PUBLIC_API_KEY_INVALID', 'API key invalida.', 403) };
    }

    const secret = parts.pop()!;
    const prefix = parts.join('_');
    const empresa = await Empresa.findOne({ api_key_prefix: prefix }).select('_id nome ativo api_key_hash api_key_prefix').exec();

    if (!empresa || !empresa.api_key_hash) {
      return { ok: false, error: publicApiError('PUBLIC_API_KEY_INVALID', 'API key invalida.', 403) };
    }

    if (empresa.ativo === false) {
      return { ok: false, error: publicApiError('PUBLIC_API_KEY_INACTIVE', 'API key inativa.', 403) };
    }

    const match = await bcrypt.compare(secret, empresa.api_key_hash);
    if (!match) {
      return { ok: false, error: publicApiError('PUBLIC_API_KEY_INVALID', 'API key invalida.', 403) };
    }

    const empresaId = empresa._id.toString();
    const key: PublicApiKey = {
      id: prefix,
      keyPrefix: prefix,
      partnerId: `empresa-${empresaId}`,
      empresaId,
      scopes: DEFAULT_SCOPES,
      active: true,
      createdAt: new Date().toISOString(),
    };

    return {
      ok: true,
      context: {
        key,
        partner: {
          id: key.partnerId,
          name: empresa.nome,
          empresaId,
          active: true,
          scopes: key.scopes,
        },
        requestId: cryptoRandomId(),
      },
    };
  }

  validateScope(context: PublicApiAuthContext, scope: PublicApiScope): { ok: true } | { ok: false; error: PublicApiError } {
    if (!context.key.scopes.includes(scope)) {
      return {
        ok: false,
        error: publicApiError('PUBLIC_API_SCOPE_FORBIDDEN', 'Escopo insuficiente para este recurso.', 403),
      };
    }
    return { ok: true };
  }

  registerUsage(log: PublicApiUsageLog): void {
    this.usageLogs.push(log);
    logger.info('[PublicAPI] Usage registered', {
      partnerId: log.partnerId,
      empresaId: log.empresaId,
      endpoint: log.endpoint,
      status: log.status,
      scopes: log.scopes,
      itemCount: log.itemCount,
      requestId: log.requestId,
    });
  }

  async getPublicInventory(
    context: PublicApiAuthContext,
    options: PublicApiQueryOptions = {},
    sources?: InventorySource[],
  ) {
    const prepared = await this.prepareInventory(context.key.empresaId, options, sources);
    return PublicInventoryPresenter.list(prepared.views);
  }

  async getPublicInventoryItem(
    context: PublicApiAuthContext,
    id: string,
    sources?: InventorySource[],
  ) {
    const prepared = await this.prepareInventory(context.key.empresaId, {}, sources);
    const normalizedId = id.toLowerCase();
    const view = prepared.views.find((candidate) => {
      const item = PublicInventoryPresenter.item(candidate);
      return [item.id, item.boardNumber, item.operationalNumber?.toString()]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase() === normalizedId);
    });

    return view ? PublicInventoryPresenter.item(view) : null;
  }

  async getPublicAvailability(
    context: PublicApiAuthContext,
    options: PublicApiQueryOptions = {},
    sources?: InventorySource[],
  ) {
    const items = await this.getPublicInventory(context, options, sources);
    return {
      total: items.length,
      available: items.filter((item) => item.availability.status === 'available').length,
      reserved: items.filter((item) => item.availability.status === 'reserved').length,
      occupied: items.filter((item) => item.availability.status === 'occupied').length,
      unavailable: items.filter((item) => item.availability.status === 'unavailable').length,
      unknown: items.filter((item) => item.availability.status === 'unknown').length,
      items: items.map((item) => ({
        id: item.id,
        availability: item.availability,
      })),
    };
  }

  async getPublicMedia(context: PublicApiAuthContext, id: string, sources?: InventorySource[]) {
    const item = await this.getPublicInventoryItem(context, id, sources);
    return item?.media ?? null;
  }

  async getPublicGeoCatalog(
    context: PublicApiAuthContext,
    options: PublicApiQueryOptions = {},
    sources?: InventorySource[],
  ) {
    const prepared = await this.prepareInventory(context.key.empresaId, options, sources);
    return PublicGeoPresenter.catalog(prepared.snapshot.spatial);
  }

  buildPublicResponse<T>(data: T, count?: number, requestId?: string): PublicApiResponse<T> {
    return PublicErrorPresenter.response(data, count, requestId);
  }

  private async prepareInventory(
    empresaId: string,
    options: PublicApiQueryOptions,
    sources?: InventorySource[],
  ): Promise<{ snapshot: ProjectionSnapshot; views: PublicInventorySourceView[] }> {
    const limit = Math.min(Math.max(options.limit ?? MAX_PUBLIC_LIMIT, 1), MAX_PUBLIC_LIMIT);
    const inventorySources = sources
      ? sources.filter((source) => String(source.placa.empresaId ?? '') === empresaId)
      : await this.loadInventorySources(empresaId, options, limit);
    const selectedSources = inventorySources.slice(0, limit);

    const snapshotResult = projectionService.buildProjectionSnapshot(
      { inventorySources: selectedSources },
      { tenantId: empresaId, source: 'public-api' },
    );

    if (!snapshotResult.ok || !snapshotResult.projection) {
      throw publicApiError('PUBLIC_API_INTERNAL_ERROR', 'Falha ao gerar catalogo publico.', 500);
    }

    const rawById = new Map<string, PlacaPublicDoc>();
    if (!sources) {
      const rawDocs = await this.loadRawPlacas(empresaId, options, limit);
      rawDocs.forEach((doc) => rawById.set(String(doc._id ?? doc.id ?? ''), doc));
    }

    const views = selectedSources
      .map((source) => viewFromSource(source, snapshotResult.projection!, rawById.get(String(source.placa._id ?? source.placa.id ?? ''))))
      .filter((view): view is PublicInventorySourceView => Boolean(view));

    return { snapshot: snapshotResult.projection, views };
  }

  private async loadInventorySources(empresaId: string, options: PublicApiQueryOptions, limit: number): Promise<InventorySource[]> {
    const rawDocs = await this.loadRawPlacas(empresaId, options, limit);
    return rawDocs.map((placa) => inventoryService.normalizeInventorySource(sourceFromPlaca(placa)));
  }

  private async loadRawPlacas(empresaId: string, options: PublicApiQueryOptions, limit: number): Promise<PlacaPublicDoc[]> {
    const filter: Record<string, unknown> = { empresaId };
    if (options.regionId) filter.regiaoId = options.regionId;

    return Placa.find(filter)
      .populate('regiaoId', 'nome')
      .select('_id empresaId regiaoId numero_placa numeroOperacional coordenadas nomeDaRua tamanho imagem disponivel')
      .limit(limit)
      .lean()
      .then((docs: any[]) => docs.map((doc) => ({
        ...doc,
        regiao: typeof doc.regiaoId === 'object' ? { nome: doc.regiaoId?.nome } : undefined,
        regiaoId: typeof doc.regiaoId === 'object' ? doc.regiaoId?._id : doc.regiaoId,
      })));
  }
}

function cryptoRandomId(): string {
  return `pub_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export const publicApiService = new PublicApiService();
export default PublicApiService;
