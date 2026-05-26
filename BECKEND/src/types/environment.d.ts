/**
 * Environment variables type definitions
 */
export interface IEnvironment {
  // Server
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: string;
  
  // Database
  MONGODB_URI: string;
  
  // JWT
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  
  // Redis
  REDIS_HOST?: string;
  REDIS_PORT?: string;
  REDIS_PASSWORD?: string;
  
  // AWS S3
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  AWS_REGION?: string;
  AWS_S3_BUCKET?: string;
  
  // WhatsApp
  WHATSAPP_SESSION_PATH?: string;
  
  // API Keys
  API_KEY?: string;
  
  // Other
  CORS_ORIGIN?: string;
  RATE_LIMIT_WINDOW_MS?: string;
  RATE_LIMIT_MAX_REQUESTS?: string;
}

declare global {
  namespace NodeJS {
    interface ProcessEnv extends IEnvironment {}
  }
}

export {};
