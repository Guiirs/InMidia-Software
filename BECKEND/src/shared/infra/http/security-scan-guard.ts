import { Request, Response, NextFunction } from 'express';
import logger from '@shared/container/logger';

export const KNOWN_SCANNER_PATHS = [
  '/.env',
  '/.env.*',
  '/.git',
  '/.git/*',
  '/.aws',
  '/.aws/*',
  '/.npmrc',
  '/.DS_Store',
  '/appsettings.json',
  '/config.json',
  '/credentials.json',
  '/actuator',
  '/actuator/*',
  '/server-status',
  '/phpinfo.php',
  '/wp-admin',
  '/wp-login.php',
  '/vendor/*',
  '/boaform/*',
  '/cgi-bin/*',
] as const;

function matchesScannerPath(pathname: string): boolean {
  if (/^\/\.env(?:\.|$)/i.test(pathname)) return true;

  const exactMatches = new Set<string>([
    '/.git',
    '/.aws',
    '/.npmrc',
    '/.DS_Store',
    '/appsettings.json',
    '/config.json',
    '/credentials.json',
    '/actuator',
    '/server-status',
    '/phpinfo.php',
    '/wp-admin',
    '/wp-login.php',
  ]);

  if (exactMatches.has(pathname)) return true;

  return [
    '/.git/',
    '/.aws/',
    '/actuator/',
    '/vendor/',
    '/boaform/',
    '/cgi-bin/',
  ].some((prefix) => pathname.startsWith(prefix));
}

export function isKnownScannerPath(pathname: string): boolean {
  return matchesScannerPath(pathname);
}

export function securityScanGuard(req: Request, res: Response, next: NextFunction): void {
  if (!isKnownScannerPath(req.path)) {
    next();
    return;
  }

  res.locals.skipHttpAccessLog = true;

  const ip = (req.headers['cf-connecting-ip'] as string) || req.ip || req.socket?.remoteAddress || 'unknown';
  const userAgent = String(req.headers['user-agent'] || '-').replace(/\s+/g, ' ').slice(0, 300);

  logger.warn(`[SECURITY_SCAN] Blocked request method=${req.method} path=${req.originalUrl} ip=${ip} ua=${userAgent}`);
  res.status(404).json({ error: 'Not found' });
}
