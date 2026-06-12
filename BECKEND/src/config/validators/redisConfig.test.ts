import { validateRedisConfig } from './redisConfig';

describe('validateRedisConfig', () => {
  it('is fatal in production when REDIS_ENABLED=true and REDIS_URL is absent', () => {
    const result = validateRedisConfig({ enabled: true, hasUrl: false, nodeEnv: 'production' });
    expect(result).toMatchObject({ ok: false, fatal: true });
    expect(result.message).toMatch(/REDIS_URL/);
  });

  it('is fatal in staging when REDIS_ENABLED=true and REDIS_URL is absent', () => {
    const result = validateRedisConfig({ enabled: true, hasUrl: false, nodeEnv: 'staging' });
    expect(result).toMatchObject({ ok: false, fatal: true });
  });

  it('is ok in production when REDIS_ENABLED=true and REDIS_URL is present', () => {
    expect(validateRedisConfig({ enabled: true, hasUrl: true, nodeEnv: 'production' })).toEqual({
      ok: true,
      fatal: false,
    });
  });

  it('is ok in production when REDIS_ENABLED=false, even without REDIS_URL', () => {
    expect(validateRedisConfig({ enabled: false, hasUrl: false, nodeEnv: 'production' })).toEqual({
      ok: true,
      fatal: false,
    });
  });

  it('allows fallback (no REDIS_URL) in development', () => {
    expect(validateRedisConfig({ enabled: true, hasUrl: false, nodeEnv: 'development' })).toEqual({
      ok: true,
      fatal: false,
    });
  });

  it('allows fallback (no REDIS_URL) in test', () => {
    expect(validateRedisConfig({ enabled: true, hasUrl: false, nodeEnv: 'test' })).toEqual({
      ok: true,
      fatal: false,
    });
  });
});
