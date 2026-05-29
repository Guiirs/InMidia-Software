import { Request } from 'express';
import { BlockAuthGuardResult, IBlockAuthGuard, SecurityContext } from '../types/blockAuth.types';
import logger from '@shared/container/logger';

const EXACT_BLOCKED: ReadonlySet<string> = new Set([
  '/.git',
  '/.git/config',
  '/.env',
  '/wp-admin',
  '/wp-login.php',
  '/xmlrpc.php',
  '/phpmyadmin',
  '/server-status',
  '/composer.json',
  '/.aws',
  '/.docker',
]);

const PREFIX_BLOCKED: readonly string[] = [
  '/.git/',
  '/.aws/',
  '/vendor/',
  '/boaform/',
  '/cgi-bin/',
  '/.docker/',
];

export function isBlockedScannerPath(pathname: string): boolean {
  if (/^\/\.env(?:\.|$)/i.test(pathname)) return true;
  if (EXACT_BLOCKED.has(pathname)) return true;
  return PREFIX_BLOCKED.some((prefix) => pathname.startsWith(prefix));
}

export class RequestShieldGuard implements IBlockAuthGuard {
  execute(req: Request, _context: SecurityContext): BlockAuthGuardResult {
    if (!isBlockedScannerPath(req.path)) {
      return { decision: 'ALLOW' };
    }

    logger.warn(
      `[RequestShieldGuard] Scanner path blocked path=${req.path} ip=${req.ip ?? 'unknown'}`
    );

    return { decision: 'BLOCK', reason: 'SECURITY_SCAN', riskScore: 80 };
  }
}
