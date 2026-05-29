import { Request } from 'express';

export interface SecurityContext {
  requestId: string;

  realIp: string;
  proxyIp?: string;

  cfRayId?: string;
  country?: string;

  userAgent?: string;
  origin?: string;
  referer?: string;

  authType?: 'jwt' | 'api_key' | 'public' | 'health' | 'internal' | 'unknown';

  userId?: string;
  empresaId?: string | null;

  role?: string;
  tenantScope?: string;

  riskScore: number;

  decision: 'ALLOW' | 'BLOCK' | 'LIMIT';

  reason?: string;
  systemContext?: string;
}

export type BlockAuthGuardResult =
  | { decision: 'ALLOW'; contextPatch?: Partial<SecurityContext> }
  | { decision: 'BLOCK'; reason: string; riskScore?: number; contextPatch?: Partial<SecurityContext> }
  | { decision: 'LIMIT'; reason: string; riskScore?: number; contextPatch?: Partial<SecurityContext> };

export interface IBlockAuthGuard {
  execute(
    req: Request,
    context: SecurityContext
  ): Promise<BlockAuthGuardResult> | BlockAuthGuardResult;
}
