import { validateJwtSecret, JWT_SECRET_MIN_LENGTH } from './jwtSecret';

describe('validateJwtSecret', () => {
  const LONG_SECRET = 'a'.repeat(JWT_SECRET_MIN_LENGTH);
  const SHORT_SECRET = 'short-secret';

  it('is fatal when JWT_SECRET is undefined, regardless of environment', () => {
    expect(validateJwtSecret(undefined, 'production')).toEqual({
      ok: false,
      fatal: true,
      message: 'JWT_SECRET is not defined',
    });
    expect(validateJwtSecret(undefined, 'development')).toMatchObject({ fatal: true });
    expect(validateJwtSecret(undefined, 'test')).toMatchObject({ fatal: true });
  });

  it('is fatal when JWT_SECRET is empty string, regardless of environment', () => {
    expect(validateJwtSecret('', 'development')).toMatchObject({ fatal: true });
  });

  it('is fatal in production when JWT_SECRET is shorter than the minimum', () => {
    const result = validateJwtSecret(SHORT_SECRET, 'production');
    expect(result.fatal).toBe(true);
    expect(result.ok).toBe(false);
    expect(result.message).toContain(`${JWT_SECRET_MIN_LENGTH}`);
  });

  it('is a non-fatal warning in development when JWT_SECRET is shorter than the minimum', () => {
    const result = validateJwtSecret(SHORT_SECRET, 'development');
    expect(result.fatal).toBe(false);
    expect(result.ok).toBe(false);
    expect(result.message).toContain(`${JWT_SECRET_MIN_LENGTH}`);
  });

  it('is a non-fatal warning in test when JWT_SECRET is shorter than the minimum', () => {
    const result = validateJwtSecret(SHORT_SECRET, 'test');
    expect(result.fatal).toBe(false);
    expect(result.ok).toBe(false);
  });

  it('is ok when JWT_SECRET meets the minimum length, in any environment', () => {
    expect(validateJwtSecret(LONG_SECRET, 'production')).toEqual({ ok: true, fatal: false });
    expect(validateJwtSecret(LONG_SECRET, 'development')).toEqual({ ok: true, fatal: false });
    expect(validateJwtSecret(LONG_SECRET, 'test')).toEqual({ ok: true, fatal: false });
  });
});
