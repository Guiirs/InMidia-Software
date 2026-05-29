import type { NextFunction, Request, Response } from 'express';
import { publicApiKeyManager } from '@modules/public-api/managers/public-api-key.manager';
import { PublicErrorPresenter } from '@modules/public-api/presenters/public-error.presenter';
import type { PublicApiAuthContext } from '@modules/public-api/contracts/public-api.contracts';
import * as service from './public-plates.service';

// private: tenant-specific data must never be served by a shared CDN cache.
// Vary: x-api-key is set by publicApiCacheSafetyMiddleware before this runs;
// calling res.vary() here is a defence-in-depth fallback.
const CACHE_CONTROL = 'private, max-age=60';

export interface PublicPlatesRequest extends Request {
  publicApi?: PublicApiAuthContext;
}

function setCacheHeaders(res: Response): void {
  res.set('Cache-Control', CACHE_CONTROL);
  res.vary('x-api-key');
}

function empresaId(req: PublicPlatesRequest): string {
  return req.publicApi!.key.empresaId;
}

function requestId(req: PublicPlatesRequest): string {
  return req.publicApi?.requestId ?? 'unknown';
}

/** Middleware: valida API key e injeta contexto no request. */
export async function requirePublicKey(
  req: PublicPlatesRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const rawKey = req.header('x-api-key') ?? req.header('authorization');
  const result = await publicApiKeyManager.validate(rawKey);

  if (!result.ok) {
    res.status(result.error.status).json(
      PublicErrorPresenter.error(result.error, req.header('x-request-id') ?? undefined),
    );
    return;
  }

  req.publicApi = result.context;
  next();
}

/** GET /api/public/placas */
export async function getPlacas(
  req: PublicPlatesRequest,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  try {
    setCacheHeaders(res);

    const filters: service.PlacasFilter = {
      cidade: strParam(req.query.cidade),
      regiao: strParam(req.query.regiao),
      categoria: strParam(req.query.categoria),
      disponibilidade: strParam(req.query.disponibilidade),
    };

    const pagination: service.PlacasPagination = {
      page: numParam(req.query.page),
      limit: numParam(req.query.limit),
    };

    const result = await service.listPlacas(empresaId(req), filters, pagination);

    res.status(200).json({
      success: true,
      ...result,
      meta: { requestId: requestId(req), timestamp: new Date().toISOString() },
    });
  } catch {
    res.status(500).json(
      PublicErrorPresenter.error(
        { code: 'PUBLIC_API_INTERNAL_ERROR', message: 'Erro ao listar placas.', status: 500 },
        requestId(req),
      ),
    );
  }
}

/** GET /api/public/placas/:slug */
export async function getPlacaBySlug(
  req: PublicPlatesRequest,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  try {
    const slug = typeof req.params.slug === 'string' ? req.params.slug.toLowerCase().trim() : '';

    if (!slug) {
      res.status(400).json(
        PublicErrorPresenter.error(
          { code: 'PUBLIC_API_KEY_INVALID', message: 'Slug invalido.', status: 400 },
          requestId(req),
        ),
      );
      return;
    }

    setCacheHeaders(res);
    const placa = await service.getPlacaBySlug(empresaId(req), slug);

    if (!placa) {
      res.status(404).json(
        PublicErrorPresenter.error(
          { code: 'PUBLIC_API_NOT_FOUND', message: 'Placa não encontrada.', status: 404 },
          requestId(req),
        ),
      );
      return;
    }

    res.status(200).json({
      success: true,
      data: placa,
      meta: { requestId: requestId(req), timestamp: new Date().toISOString() },
    });
  } catch {
    res.status(500).json(
      PublicErrorPresenter.error(
        { code: 'PUBLIC_API_INTERNAL_ERROR', message: 'Erro ao buscar placa.', status: 500 },
        requestId(req),
      ),
    );
  }
}

/** GET /api/public/placas/:id */
export async function getPlacaById(
  req: PublicPlatesRequest,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id.trim() : '';

    if (!id) {
      res.status(400).json(
        PublicErrorPresenter.error(
          { code: 'PUBLIC_API_KEY_INVALID', message: 'Identificador invalido.', status: 400 },
          requestId(req),
        ),
      );
      return;
    }

    setCacheHeaders(res);
    const placa = await service.getPlacaByIdOrSlug(empresaId(req), id);

    if (!placa) {
      res.status(404).json(
        PublicErrorPresenter.error(
          { code: 'PUBLIC_API_NOT_FOUND', message: 'Placa nÃ£o encontrada.', status: 404 },
          requestId(req),
        ),
      );
      return;
    }

    res.status(200).json({
      success: true,
      data: placa,
      meta: { requestId: requestId(req), timestamp: new Date().toISOString() },
    });
  } catch {
    res.status(500).json(
      PublicErrorPresenter.error(
        { code: 'PUBLIC_API_INTERNAL_ERROR', message: 'Erro ao buscar placa.', status: 500 },
        requestId(req),
      ),
    );
  }
}

/** GET /api/public/regioes */
export async function getRegioes(
  req: PublicPlatesRequest,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  try {
    setCacheHeaders(res);
    const regioes = await service.listRegioes(empresaId(req));

    res.status(200).json({
      success: true,
      data: regioes,
      meta: {
        requestId: requestId(req),
        timestamp: new Date().toISOString(),
        count: regioes.length,
      },
    });
  } catch {
    res.status(500).json(
      PublicErrorPresenter.error(
        { code: 'PUBLIC_API_INTERNAL_ERROR', message: 'Erro ao listar regiões.', status: 500 },
        requestId(req),
      ),
    );
  }
}

/** GET /api/public/disponibilidade */
export async function getDisponibilidade(
  req: PublicPlatesRequest,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  try {
    setCacheHeaders(res);
    const summary = await service.getDisponibilidade(empresaId(req));

    res.status(200).json({
      success: true,
      data: summary,
      meta: { requestId: requestId(req), timestamp: new Date().toISOString() },
    });
  } catch {
    res.status(500).json(
      PublicErrorPresenter.error(
        { code: 'PUBLIC_API_INTERNAL_ERROR', message: 'Erro ao buscar disponibilidade.', status: 500 },
        requestId(req),
      ),
    );
  }
}

function strParam(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function numParam(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : undefined;
}
