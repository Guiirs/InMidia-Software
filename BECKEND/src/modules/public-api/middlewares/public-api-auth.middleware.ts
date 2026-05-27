import type { NextFunction, Request, Response } from 'express';
import { publicApiKeyManager } from '../managers/public-api-key.manager';
import { publicApiService } from '../public-api.service';
import { PublicErrorPresenter } from '../presenters/public-error.presenter';
import type { PublicApiAuthContext, PublicApiScope } from '../contracts/public-api.contracts';

export interface PublicApiRequest extends Request {
  publicApi?: PublicApiAuthContext;
}

// Read API key from x-api-key header or Authorization: Bearer <key>.
function extractRawKey(req: Request): string | undefined {
  const headerKey = req.header('x-api-key');
  if (headerKey) return headerKey;
  const auth = req.header('authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim();
  return undefined;
}

export function requirePublicApiScope(scope: PublicApiScope) {
  return async (req: PublicApiRequest, res: Response, next: NextFunction): Promise<void> => {
    const rawKey = extractRawKey(req);
    // PublicApiKeyManager: bcrypt validation + 60s in-memory cache, Bearer support.
    const auth = await publicApiKeyManager.validate(rawKey);
    if (!auth.ok) {
      const requestId = req.header('x-request-id') ?? undefined;
      publicApiService.registerUsage({
        scopes: [scope],
        endpoint: req.originalUrl,
        method: req.method,
        status: auth.error.status,
        timestamp: new Date().toISOString(),
        errorCode: auth.error.code,
        requestId: requestId ?? 'public-api-auth-failed',
      });
      res.status(auth.error.status).json(PublicErrorPresenter.error(auth.error, requestId));
      return;
    }

    const scopeResult = publicApiService.validateScope(auth.context, scope);
    if (!scopeResult.ok) {
      publicApiService.registerUsage({
        partnerId: auth.context.partner.id,
        empresaId: auth.context.key.empresaId,
        scopes: [scope],
        endpoint: req.originalUrl,
        method: req.method,
        status: scopeResult.error.status,
        timestamp: new Date().toISOString(),
        errorCode: scopeResult.error.code,
        requestId: auth.context.requestId,
      });
      res.status(scopeResult.error.status).json(PublicErrorPresenter.error(scopeResult.error, auth.context.requestId));
      return;
    }

    req.publicApi = auth.context;
    next();
  };
}
