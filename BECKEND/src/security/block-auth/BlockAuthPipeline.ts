import { Request } from 'express';
import { SecurityContext, BlockAuthGuardResult, IBlockAuthGuard } from './types/blockAuth.types';
import { EdgeTrustGuard } from './guards/EdgeTrustGuard';
import { RequestShieldGuard } from './guards/RequestShieldGuard';
import { AuthGuard } from './guards/AuthGuard';
import { TenantGuard } from './guards/TenantGuard';
import { ApiKeyGuard } from './guards/ApiKeyGuard';

const GUARDS: readonly IBlockAuthGuard[] = [
  new EdgeTrustGuard(),
  new RequestShieldGuard(),
  new AuthGuard(),
  new TenantGuard(),
  new ApiKeyGuard(),
];

export async function runBlockAuthPipeline(
  req: Request,
  context: SecurityContext
): Promise<BlockAuthGuardResult> {
  for (const guard of GUARDS) {
    const result = await guard.execute(req, context);

    if (result.contextPatch) {
      Object.assign(context, result.contextPatch);
    }

    if (result.decision !== 'ALLOW') {
      if (result.riskScore !== undefined) {
        context.riskScore = Math.max(context.riskScore, result.riskScore);
      }
      return result;
    }
  }

  return { decision: 'ALLOW' };
}
