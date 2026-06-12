import { getLogRotationConfig } from './logger';
import logger from './logger';

describe('getLogRotationConfig', () => {
  it('returns sensible defaults when env vars are not set', () => {
    expect(getLogRotationConfig({})).toEqual({
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    });
  });

  it('parses LOG_MAX_SIZE_BYTES and LOG_MAX_FILES from env', () => {
    expect(getLogRotationConfig({ LOG_MAX_SIZE_BYTES: '5242880', LOG_MAX_FILES: '10' })).toEqual({
      maxsize: 5242880,
      maxFiles: 10,
    });
  });

  it('falls back to defaults for invalid (non-positive/NaN) values', () => {
    expect(getLogRotationConfig({ LOG_MAX_SIZE_BYTES: '0', LOG_MAX_FILES: '-1' })).toEqual({
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    });
    expect(getLogRotationConfig({ LOG_MAX_SIZE_BYTES: 'not-a-number', LOG_MAX_FILES: '' })).toEqual({
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    });
  });
});

describe('logger transports', () => {
  it('configures error.log and all.log File transports with rotation limits', () => {
    const fileTransports = logger.transports.filter(
      (t: any) => typeof t.filename === 'string'
    ) as any[];

    expect(fileTransports.length).toBeGreaterThanOrEqual(2);

    for (const transport of fileTransports) {
      expect(transport.maxsize).toBeGreaterThan(0);
      expect(transport.maxFiles).toBeGreaterThan(0);
    }
  });
});
