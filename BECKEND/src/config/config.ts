import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { validateJwtSecret } from './validators/jwtSecret';
import { validateRedisConfig } from './validators/redisConfig';
import { parsePositiveInt } from './validators/parsePositiveInt';

function loadEnvFiles(): void {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const projectRoot = path.resolve(__dirname, '../..');

  const envFiles = [
    '.env',
    `.env.${nodeEnv}`,
    '.env.local',
    `.env.${nodeEnv}.local`,
  ];

  for (const envFile of envFiles) {
    const envPath = path.join(projectRoot, envFile);
    if (!fs.existsSync(envPath)) continue;
    // Em NODE_ENV=test, o `.env` base nao deve sobrescrever variaveis ja
    // definidas pelo processo (ex.: setup.ts força REDIS_ENABLED=false para
    // testes de integração). Arquivos de override mais especificos
    // (.env.test, .env.local, .env.test.local) continuam vencendo.
    const override = !(nodeEnv === 'test' && envFile === '.env');
    dotenv.config({ path: envPath, override });
  }
}

loadEnvFiles();

interface IStorageConfig {
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  bucketName?: string;
  publicUrl?: string;
}

interface IConfig {
  // JWT / Access Token
  jwtSecret: string;
  jwtExpiresIn: string;         // legado — use accessTokenExpiresIn
  accessTokenExpiresIn: string; // duração do access token (ex: '15m')
  accessTokenExpiresMs: number; // em milissegundos (para maxAge do cookie)

  // Refresh Token
  jwtRefreshExpiresIn: string;    // legado — use refreshTokenExpiresIn
  refreshTokenExpiresIn: string;  // duração do refresh token (ex: '7d')
  refreshTokenExpiresMs: number;  // em milissegundos (para maxAge do cookie)

  port: number;
  mongoUri: string;
  nodeEnv: string;
  storage: IStorageConfig;
  corsOrigin: string;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  redisUrl: string;
  redisEnabled: boolean;
  redisConnectTimeoutMs: number;
  metricsUser?: string;
  metricsPassword?: string;
  enableOrganizationBootstrapOnLogin: boolean;

  // Mongo connection pool
  mongoMinPoolSize: number;
  mongoMaxPoolSize: number;
  mongoServerSelectionTimeoutMs: number;
}

function resolveCorsOrigin(): string {
  const corsOrigin = process.env.CORS_ORIGIN?.trim();
  if (corsOrigin) return corsOrigin;

  const frontendUrl = process.env.FRONTEND_URL?.trim();
  if (frontendUrl) return frontendUrl;

  return 'http://localhost:5173';
}

function parseEnvToggle(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === null || value === '') return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'on', 'yes'].includes(normalized)) return true;
  if (['false', '0', 'off', 'no'].includes(normalized)) return false;
  return defaultValue;
}

/** Converte string de duração tipo "15m", "1h", "7d" em milissegundos */
function parseDurationMs(value: string): number {
  const match = value.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return 15 * 60 * 1000; // fallback 15m

  const num = parseInt(match[1]!, 10);
  switch (match[2]!) {
    case 's': return num * 1000;
    case 'm': return num * 60 * 1000;
    case 'h': return num * 60 * 60 * 1000;
    case 'd': return num * 24 * 60 * 60 * 1000;
    default:  return num * 60 * 1000;
  }
}

// Validate critical environment variables
const jwtSecretCheck = validateJwtSecret(process.env.JWT_SECRET, process.env.NODE_ENV || 'development');
if (jwtSecretCheck.fatal) {
  process.stderr.write(`[CONFIG] FATAL ERROR: ${jwtSecretCheck.message}\n`);
  process.exit(1);
} else if (!jwtSecretCheck.ok) {
  process.stderr.write(`[CONFIG] WARNING: ${jwtSecretCheck.message}\n`);
}

if (!process.env.MONGODB_URI) {
  process.stderr.write('[CONFIG] FATAL ERROR: MONGODB_URI is not defined\n');
  process.exit(1);
}

if (
  process.env.NODE_ENV === 'production' &&
  (!process.env.METRICS_USER || !process.env.METRICS_PASSWORD)
) {
  process.stderr.write('[CONFIG] FATAL ERROR: METRICS_USER and METRICS_PASSWORD must be defined in production\n');
  process.exit(1);
}

if (
  process.env.NODE_ENV === 'production' &&
  (!process.env.R2_ENDPOINT || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY || !process.env.R2_BUCKET_NAME || !process.env.R2_PUBLIC_URL)
) {
  process.stderr.write('[CONFIG] WARNING: R2 storage variables not fully configured.\n');
}

const redisEnabled = parseEnvToggle(process.env.REDIS_ENABLED, true);

const redisConfigCheck = validateRedisConfig({
  enabled: redisEnabled,
  hasUrl: !!process.env.REDIS_URL,
  nodeEnv: process.env.NODE_ENV || 'development',
});
if (redisConfigCheck.fatal) {
  process.stderr.write(`[CONFIG] FATAL ERROR: ${redisConfigCheck.message}\n`);
  process.exit(1);
}

const accessTokenExpiresIn = process.env.ACCESS_TOKEN_EXPIRES_IN || process.env.JWT_EXPIRES_IN || '15m';
const refreshTokenExpiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN || process.env.JWT_REFRESH_EXPIRES_IN || '7d';

const config: IConfig = {
  jwtSecret: process.env.JWT_SECRET as string,
  jwtExpiresIn: accessTokenExpiresIn,            // legado — mantido para compatibilidade
  accessTokenExpiresIn,
  accessTokenExpiresMs: parseDurationMs(accessTokenExpiresIn),

  jwtRefreshExpiresIn: refreshTokenExpiresIn,    // legado — mantido para compatibilidade
  refreshTokenExpiresIn,
  refreshTokenExpiresMs: parseDurationMs(refreshTokenExpiresIn),

  port: parseInt(process.env.PORT || '4000', 10),
  mongoUri: process.env.MONGODB_URI as string,
  nodeEnv: process.env.NODE_ENV || 'development',
  storage: {
    endpoint: process.env.R2_ENDPOINT,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucketName: process.env.R2_BUCKET_NAME,
    publicUrl: process.env.R2_PUBLIC_URL,
  },
  corsOrigin: resolveCorsOrigin(),
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  redisEnabled,
  redisConnectTimeoutMs: parsePositiveInt(process.env.REDIS_CONNECT_TIMEOUT_MS, 5_000),
  metricsUser: process.env.METRICS_USER,
  metricsPassword: process.env.METRICS_PASSWORD,
  enableOrganizationBootstrapOnLogin: parseEnvToggle(
    process.env.ENABLE_ORGANIZATION_BOOTSTRAP_ON_LOGIN,
    (process.env.NODE_ENV ?? 'development') !== 'production',
  ),

  mongoMinPoolSize: parsePositiveInt(process.env.MONGO_MIN_POOL_SIZE, 2),
  mongoMaxPoolSize: parsePositiveInt(process.env.MONGO_MAX_POOL_SIZE, 10),
  mongoServerSelectionTimeoutMs: parsePositiveInt(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS, 5_000),
};

export default config;
