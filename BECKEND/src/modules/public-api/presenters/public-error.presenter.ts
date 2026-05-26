import crypto from 'crypto';
import type { PublicApiError, PublicApiResponse } from '../contracts/public-api.contracts';

export class PublicErrorPresenter {
  static response<T>(data: T, count?: number, requestId: string = crypto.randomUUID()): PublicApiResponse<T> {
    return {
      success: true,
      data,
      meta: {
        requestId,
        version: 'v1',
        timestamp: new Date().toISOString(),
        count,
      },
    };
  }

  static error(error: PublicApiError, requestId: string = crypto.randomUUID()): PublicApiResponse {
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
      },
      meta: {
        requestId,
        version: 'v1',
        timestamp: new Date().toISOString(),
      },
    };
  }
}
