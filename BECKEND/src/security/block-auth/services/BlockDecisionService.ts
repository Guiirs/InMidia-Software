import { Response } from 'express';
import { SecurityContext } from '../types/blockAuth.types';

const REASON_TO_STATUS: Readonly<Record<string, number>> = {
  SECURITY_SCAN:            404,
  TENANT_MISMATCH:          403,
  API_KEY_QUERY_FORBIDDEN:  400,
  DIRECT_BACKEND_BLOCKED:   403,
  DEFAULT_BLOCK:            403,
};

export class BlockDecisionService {
  getHttpStatus(reason: string): number {
    return REASON_TO_STATUS[reason] ?? REASON_TO_STATUS['DEFAULT_BLOCK']!;
  }

  sendBlockedResponse(res: Response, context: SecurityContext): void {
    const status = this.getHttpStatus(context.reason ?? 'DEFAULT_BLOCK');

    res.status(status).json({
      success: false,
      error: {
        code: 'BLOCKED_BY_SECURITY_GATEWAY',
        message: 'Request blocked by security policy.',
      },
      meta: {
        requestId: context.requestId,
      },
    });
  }
}

export const blockDecisionService = new BlockDecisionService();
