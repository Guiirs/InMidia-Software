import { classifyHttpResponse, formatHttpAccessLog, resolveHttpSlowMs } from './http-access-log';

describe('http access log classification', () => {
  it('classifica 200 lento como SLOW, nao SLOW/ERR', () => {
    const result = classifyHttpResponse(200, 1199, 1000);
    const message = formatHttpAccessLog({
      label: result.label,
      method: 'GET',
      path: '/boards',
      status: 200,
      durationMs: 1199,
      requestId: 'rid-1',
    });

    expect(result).toEqual({ level: 'warn', label: 'SLOW', shouldLogInProduction: true });
    expect(message).toContain('[HTTP] SLOW GET /boards 200 1199ms rid=rid-1');
    expect(message).not.toContain('SLOW/ERR');
  });

  it('classifica 304 lento como SLOW, nao SLOW/ERR', () => {
    const result = classifyHttpResponse(304, 3158, 1000);
    const message = formatHttpAccessLog({
      label: result.label,
      method: 'GET',
      path: '/regions',
      status: 304,
      durationMs: 3158,
      requestId: 'rid-2',
    });

    expect(result.label).toBe('SLOW');
    expect(result.level).toBe('warn');
    expect(message).not.toContain('SLOW/ERR');
  });

  it('classifica 404 como WARN', () => {
    const result = classifyHttpResponse(404, 12, 1000);

    expect(result).toEqual({ level: 'warn', label: 'WARN', shouldLogInProduction: true });
  });

  it('classifica 500 como ERR', () => {
    const result = classifyHttpResponse(500, 123, 1000);

    expect(result).toEqual({ level: 'error', label: 'ERR', shouldLogInProduction: true });
  });

  it('usa HTTP_SLOW_MS customizado e fallback seguro para valor invalido', () => {
    expect(resolveHttpSlowMs('2500')).toBe(2500);
    expect(resolveHttpSlowMs('invalid')).toBe(1000);
    expect(resolveHttpSlowMs('-1')).toBe(1000);
    expect(classifyHttpResponse(200, 1500, resolveHttpSlowMs('2000')).label).toBe('OK');
  });
});
