import { Request } from 'express';
import { BlockAuthGuardResult, IBlockAuthGuard, SecurityContext } from '../types/blockAuth.types';
import { blockAuthPolicy } from '../config/blockAuthPolicy';
import logger from '@shared/container/logger';

export class EdgeTrustGuard implements IBlockAuthGuard {
  execute(req: Request, _context: SecurityContext): BlockAuthGuardResult {
    const cfConnectingIp = req.headers['cf-connecting-ip'] as string | undefined;
    const xForwardedFor = req.headers['x-forwarded-for'] as string | undefined;
    const cfRay = req.headers['cf-ray'] as string | undefined;
    const cfCountry = req.headers['cf-ipcountry'] as string | undefined;

    const realIp =
      cfConnectingIp?.trim() ??
      req.ip ??
      xForwardedFor?.split(',')[0]?.trim() ??
      'unknown';

    const proxyIp =
      xForwardedFor
        ? xForwardedFor
            .split(',')
            .slice(1)
            .map((s) => s.trim())
            .filter(Boolean)
            .join(', ') || undefined
        : undefined;

    const contextPatch: Partial<SecurityContext> = {
      realIp,
      proxyIp,
      cfRayId: cfRay,
      country: cfCountry,
    };

    const isTest = process.env.NODE_ENV === 'test';
    const hasCloudflareHeader = !!cfConnectingIp || !!cfRay;
    const hasProxyHeader = !!xForwardedFor;

    if (
      blockAuthPolicy.blockDirectBackendAccess &&
      !isTest &&
      !hasCloudflareHeader &&
      !hasProxyHeader
    ) {
      logger.warn(
        `[EdgeTrustGuard] Direct backend access blocked realIp=${realIp} path=${req.path}`
      );
      return {
        decision: 'BLOCK',
        reason: 'DIRECT_BACKEND_BLOCKED',
        riskScore: 30,
        contextPatch,
      };
    }

    return { decision: 'ALLOW', contextPatch };
  }
}
