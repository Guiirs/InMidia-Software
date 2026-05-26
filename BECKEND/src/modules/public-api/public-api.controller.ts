import type { NextFunction, Response } from 'express';
import logger from '@shared/container/logger';
import { publicApiService } from './public-api.service';
import { PublicErrorPresenter } from './presenters/public-error.presenter';
import type { PublicApiError, PublicApiQueryOptions } from './contracts/public-api.contracts';
import type { PublicApiRequest } from './middlewares/public-api-auth.middleware';

function optionsFromRequest(req: PublicApiRequest): PublicApiQueryOptions {
  const rawLimit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
  return {
    limit: Number.isFinite(rawLimit) ? rawLimit : undefined,
    regionId: typeof req.query.regionId === 'string' ? req.query.regionId : undefined,
  };
}

function asPublicApiError(error: unknown): PublicApiError {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    'message' in error &&
    'status' in error
  ) {
    return error as PublicApiError;
  }

  return {
    code: 'PUBLIC_API_INTERNAL_ERROR',
    message: 'Erro controlado ao processar recurso publico.',
    status: 500,
  };
}

async function handle<T>(
  req: PublicApiRequest,
  res: Response,
  _next: NextFunction,
  callback: () => Promise<T>,
  count: (data: T) => number | undefined = (data) => Array.isArray(data) ? data.length : undefined,
): Promise<void> {
  const context = req.publicApi;
  if (!context) {
    res.status(401).json(PublicErrorPresenter.error({
      code: 'PUBLIC_API_KEY_INVALID',
      message: 'Contexto da API publica ausente.',
      status: 401,
    }));
    return;
  }

  try {
    const data = await callback();
    const itemCount = count(data);
    publicApiService.registerUsage({
      partnerId: context.partner.id,
      empresaId: context.key.empresaId,
      scopes: context.key.scopes,
      endpoint: req.originalUrl,
      method: req.method,
      status: 200,
      timestamp: new Date().toISOString(),
      itemCount,
      requestId: context.requestId,
    });
    res.status(200).json(publicApiService.buildPublicResponse(data, itemCount, context.requestId));
  } catch (error) {
    const publicError = asPublicApiError(error);
    publicApiService.registerUsage({
      partnerId: context.partner.id,
      empresaId: context.key.empresaId,
      scopes: context.key.scopes,
      endpoint: req.originalUrl,
      method: req.method,
      status: publicError.status,
      timestamp: new Date().toISOString(),
      errorCode: publicError.code,
      requestId: context.requestId,
    });
    logger.warn('[PublicAPI] Request failed', {
      endpoint: req.originalUrl,
      status: publicError.status,
      code: publicError.code,
      requestId: context.requestId,
    });
    res.status(publicError.status).json(PublicErrorPresenter.error(publicError, context.requestId));
  }
}

export async function getCatalog(req: PublicApiRequest, res: Response, next: NextFunction): Promise<void> {
  await handle(req, res, next, async () => ({
    inventory: await publicApiService.getPublicInventory(req.publicApi!, optionsFromRequest(req)),
    geo: await publicApiService.getPublicGeoCatalog(req.publicApi!, optionsFromRequest(req)),
  }), (data) => data.inventory.length);
}

export async function getInventory(req: PublicApiRequest, res: Response, next: NextFunction): Promise<void> {
  await handle(req, res, next, () => publicApiService.getPublicInventory(req.publicApi!, optionsFromRequest(req)));
}

export async function getInventoryItem(req: PublicApiRequest, res: Response, next: NextFunction): Promise<void> {
  await handle(req, res, next, async () => {
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    const item = await publicApiService.getPublicInventoryItem(req.publicApi!, id);
    if (!item) {
      throw {
        code: 'PUBLIC_API_NOT_FOUND',
        message: 'Item publico nao encontrado.',
        status: 404,
      } satisfies PublicApiError;
    }
    return item;
  });
}

export async function getAvailability(req: PublicApiRequest, res: Response, next: NextFunction): Promise<void> {
  await handle(req, res, next, () => publicApiService.getPublicAvailability(req.publicApi!, optionsFromRequest(req)), (data) => data.total);
}

export async function getMedia(req: PublicApiRequest, res: Response, next: NextFunction): Promise<void> {
  await handle(req, res, next, async () => {
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    const media = await publicApiService.getPublicMedia(req.publicApi!, id);
    if (!media) {
      throw {
        code: 'PUBLIC_API_NOT_FOUND',
        message: 'Midia publica nao encontrada.',
        status: 404,
      } satisfies PublicApiError;
    }
    return media;
  });
}

export async function getGeo(req: PublicApiRequest, res: Response, next: NextFunction): Promise<void> {
  await handle(req, res, next, () => publicApiService.getPublicGeoCatalog(req.publicApi!, optionsFromRequest(req)), (data) => data.points.length);
}

export async function getAvailablePlacas(req: PublicApiRequest, res: Response, next: NextFunction): Promise<void> {
  await handle(req, res, next, async () => {
    const inventory = await publicApiService.getPublicInventory(req.publicApi!, optionsFromRequest(req));
    return inventory.filter((item) => item.availability.status === 'available');
  });
}

export default {
  getCatalog,
  getInventory,
  getInventoryItem,
  getAvailability,
  getMedia,
  getGeo,
  getAvailablePlacas,
};
