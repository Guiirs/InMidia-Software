import config from '@config/config';
import { buildMongoConnectOptions } from './dbMongo';

describe('buildMongoConnectOptions — connection pool config', () => {
  it('applies pool sizing and server selection timeout from config', () => {
    const options = buildMongoConnectOptions({});

    expect(options.minPoolSize).toBe(config.mongoMinPoolSize);
    expect(options.maxPoolSize).toBe(config.mongoMaxPoolSize);
    expect(options.serverSelectionTimeoutMS).toBe(config.mongoServerSelectionTimeoutMs);
  });

  it('config exposes safe defaults when MONGO_*_POOL_SIZE env vars are not set', () => {
    // .env.example documents 2 / 10 / 5000 as defaults — assert the loaded
    // config falls back to positive, sane values regardless of environment.
    expect(config.mongoMinPoolSize).toBeGreaterThan(0);
    expect(config.mongoMaxPoolSize).toBeGreaterThanOrEqual(config.mongoMinPoolSize);
    expect(config.mongoServerSelectionTimeoutMs).toBeGreaterThan(0);
  });

  it('pool options are present alongside TLS options', () => {
    const options = buildMongoConnectOptions({ DB_SSL: 'true', DB_TLS_INSECURE: 'true' });

    expect(options.tls).toBe(true);
    expect(options.minPoolSize).toBe(config.mongoMinPoolSize);
    expect(options.maxPoolSize).toBe(config.mongoMaxPoolSize);
    expect(options.serverSelectionTimeoutMS).toBe(config.mongoServerSelectionTimeoutMs);
  });
});
