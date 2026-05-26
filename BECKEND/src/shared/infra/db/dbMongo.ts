import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import config from '../../../config/config';
import logger from '../../container/logger';

// Path to CA certificate for SSL
const caPath = path.resolve(__dirname, 'certs', 'ca-certificate.pem');

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
    const options: mongoose.ConnectOptions = {};

    // Add SSL options only in production or if DB_SSL is true
    if (process.env.NODE_ENV === 'production' || process.env.DB_SSL === 'true') {
      if (fs.existsSync(caPath)) {
        options.tls = true;
        options.tlsCAFile = caPath;
        logger.info('🔐 Using CA certificate for MongoDB SSL connection.');
      } else {
        logger.warn(
          `⚠️ CA SSL certificate not found at ${caPath}. Connecting without verification (NOT SECURE FOR REAL PRODUCTION).`
        );
        // Insecure fallback - AVOID IN REAL PRODUCTION
        options.tls = true;
        options.tlsInsecure = true;
      }
    } else {
      logger.info('SSL for MongoDB disabled (non-production environment or DB_SSL not set to true).');
    }

    // Connect to MongoDB
    await mongoose.connect(config.mongoUri, options);
    logger.info('🔌 MongoDB connection established.');

    // Configure global transformation for JSON serialization
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

    logger.info('⚙️ Global Mongoose mapping _id -> id configured.');
  } catch (err) {
    const error = err as Error;
    logger.error('❌ Error connecting to MongoDB:', error.message);
    process.exit(1);
  }
};

export default connectDB;
