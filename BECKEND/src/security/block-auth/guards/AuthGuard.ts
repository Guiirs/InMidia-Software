import { Request } from 'express';
import { BlockAuthGuardResult, IBlockAuthGuard, SecurityContext } from '../types/blockAuth.types';
import { isExemptPath, isPublicApiPath } from '../config/blockAuthPolicy';

const ACCESS_COOKIE_NAME = 'inmidia_access';

const PUBLIC_IMAGE_PREFIXES: readonly string[] = [
  '/public/v1/images/',
  '/api/public/images/',
];

function isPublicImagePath(path: string): boolean {
  return PUBLIC_IMAGE_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export class AuthGuard implements IBlockAuthGuard {
  execute(req: Request, _context: SecurityContext): BlockAuthGuardResult {
    if (isExemptPath(req.path)) {
      return { decision: 'ALLOW', contextPatch: { authType: 'health' } };
    }

    if (isPublicImagePath(req.path)) {
      return { decision: 'ALLOW', contextPatch: { authType: 'public' } };
    }

    const hasApiKey =
      typeof req.headers['x-api-key'] === 'string' && req.headers['x-api-key'].length > 0;
    const hasBearerToken =
      typeof req.headers['authorization'] === 'string' &&
      req.headers['authorization'].startsWith('Bearer ');
    const hasCookieToken = !!(req.cookies as Record<string, unknown> | undefined)?.[ACCESS_COOKIE_NAME];

    if (hasApiKey && isPublicApiPath(req.path)) {
      return { decision: 'ALLOW', contextPatch: { authType: 'api_key' } };
    }

    if (hasBearerToken || hasCookieToken) {
      return { decision: 'ALLOW', contextPatch: { authType: 'jwt' } };
    }

    if (isPublicApiPath(req.path)) {
      return { decision: 'ALLOW', contextPatch: { authType: 'public' } };
    }

    return { decision: 'ALLOW', contextPatch: { authType: 'unknown' } };
  }
}
