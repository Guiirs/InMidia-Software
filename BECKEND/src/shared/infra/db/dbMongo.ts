import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import config from '../../../config/config';
import logger from '../../container/logger';

function parseEnvToggle(value: string | undefined): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'on', 'yes'].includes(normalized)) return true;
  if (['false', '0', 'off', 'no'].includes(normalized)) return false;
  return undefined;
}

function isAtlasMongoUri(uri: string): boolean {
  return uri.startsWith('mongodb+srv://') || /\.mongodb\.net(?:\/|$)/i.test(uri);
}

function resolveOptionalPath(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return path.isAbsolute(trimmed) ? trimmed : path.resolve(process.cwd(), trimmed);
}

export function buildMongoConnectOptions(env = process.env): mongoose.ConnectOptions {
  const options: mongoose.ConnectOptions = {};
  const explicitTls = parseEnvToggle(env.DB_SSL ?? env.MONGODB_TLS);
  const tlsEnabled = explicitTls ?? isAtlasMongoUri(config.mongoUri);

  if (!tlsEnabled) {
    logger.info('[DB Mongo] TLS disabled for MongoDB connection.');
    return options;
  }

  options.tls = true;

  const caPath = resolveOptionalPath(
    env.DB_TLS_CA_FILE || env.DB_SSL_CA_FILE || env.MONGODB_TLS_CA_FILE
  );

  if (caPath) {
    if (!fs.existsSync(caPath)) {
      throw new Error(`[DB Mongo] TLS CA certificate not found at ${caPath}`);
    }

    options.tlsCAFile = caPath;
    logger.info(`[DB Mongo] TLS enabled with CA certificate file: ${caPath}`);
    return options;
  }

  const insecureTls = parseEnvToggle(env.DB_TLS_INSECURE);
  if (insecureTls) {
    if (env.NODE_ENV === 'production') {
      throw new Error('[DB Mongo] DB_TLS_INSECURE=true is not allowed in production');
    }

    options.tlsInsecure = true;
    logger.warn('[DB Mongo] TLS enabled with certificate verification disabled (non-production only).');
    return options;
  }

  logger.info(
    isAtlasMongoUri(config.mongoUri)
      ? '[DB Mongo] TLS enabled for MongoDB Atlas using system CA store.'
      : '[DB Mongo] TLS enabled using system CA store.'
  );

  return options;
}

/**
 * Connects to MongoDB database
 */
const connectDB = async (): Promise<void> => {
  // Skip connection in test environment
  if (process.env.NODE_ENV === 'test') {
    logger.info('[DB Mongo] Connection deferred (test environment). Jest will handle this.');
    return;
  }

  try {
    const options = buildMongoConnectOptions();

    await mongoose.connect(config.mongoUri, options);
    logger.info('[DB Mongo] MongoDB connection established.');

    mongoose.set('toJSON', {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    });

    mongoose.set('toObject', {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    });

    logger.info('[DB Mongo] Global Mongoose mapping _id -> id configured.');
  } catch (err) {
    const error = err as Error;
    logger.error(`[DB Mongo] Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
