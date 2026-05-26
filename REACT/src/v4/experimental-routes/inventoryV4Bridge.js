import { QUERY_KEYS } from '../../constants/queryKeys';
import { mapPlacasToBoardCards } from '../adapters/boards';

export const INVENTORY_V4_ITEMS_PER_PAGE = 10;

const DEFAULT_PAGINATION = {
  totalDocs: 0,
  totalPages: 1,
  currentPage: 1,
  limit: INVENTORY_V4_ITEMS_PER_PAGE,
  hasNextPage: false,
  hasPrevPage: false
};

export function buildInventoryV4QueryKey(filters, page) {
  return QUERY_KEYS.placas.list({
    ...filters,
    page,
    limit: INVENTORY_V4_ITEMS_PER_PAGE,
    view: 'inventory-v4-readonly'
  });
}

export function buildInventoryV4SearchParams(filters, page) {
  const params = new URLSearchParams({
    page: String(page || 1),
    limit: String(INVENTORY_V4_ITEMS_PER_PAGE),
    sortBy: 'createdAt',
    order: 'asc'
  });

  if (filters?.regiao_id && filters.regiao_id !== 'todas') {
    params.append('regiaoId', filters.regiao_id);
  }

  if (filters?.search) {
    params.append('search', String(filters.search));
  }

  if (filters?.disponibilidade === 'true') {
    params.append('ativa', 'true');
  }

  if (filters?.disponibilidade === 'false' || filters?.disponibilidade === 'manutencao') {
    params.append('ativa', 'false');
  }

  return params;
}

export function bridgePlacasToInventoryPayload(placasResponse) {
  const rawPayload = placasResponse?.data ?? [];
  const pagination = placasResponse?.pagination ?? DEFAULT_PAGINATION;
  const mappedPayload = mapPlacasToBoardCards(Array.isArray(rawPayload) ? rawPayload : []);

  return {
    inventoryPayload: mappedPayload,
    pagination: {
      ...DEFAULT_PAGINATION,
      ...pagination
    }
  };
}

export function isInventoryV4RouteEnabled() {
  const envEnabled = String(import.meta.env.VITE_FEATURE_INVENTORY_V4_ROUTE || '').toLowerCase() === 'true';

  let localEnabled = false;
  try {
    localEnabled = String(localStorage.getItem('feature.inventoryV4Route') || '').toLowerCase() === 'true';
  } catch {
    localEnabled = false;
  }

  return envEnabled || localEnabled;
}
