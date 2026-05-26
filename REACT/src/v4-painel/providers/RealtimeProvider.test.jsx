import { describe, expect, it } from 'vitest';

import { isRealtimeAuthExpiredError } from './RealtimeProvider.jsx';

describe('RealtimeProvider auth guards', () => {
  it('identifica 401 como expiracao/autenticacao e deve parar reconexao', () => {
    expect(isRealtimeAuthExpiredError({ response: { status: 401, data: {} } })).toBe(true);
  });

  it('identifica TOKEN_EXPIRED mesmo quando o status vem em outro formato', () => {
    expect(isRealtimeAuthExpiredError({ response: { status: 403, data: { code: 'TOKEN_EXPIRED' } } })).toBe(true);
  });

  it('nao trata erro de rede comum como expiracao de sessao', () => {
    expect(isRealtimeAuthExpiredError({ response: { status: 503, data: { code: 'SERVICE_UNAVAILABLE' } } })).toBe(false);
  });
});
