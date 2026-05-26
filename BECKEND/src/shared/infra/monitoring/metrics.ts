// src/shared/infra/monitoring/metrics.ts
import { register, collectDefaultMetrics, Histogram, Counter, Gauge } from 'prom-client';
import logger from '@shared/container/logger';

// Enable default metrics collection (CPU, memory, etc.)
collectDefaultMetrics({ prefix: 'api_' });

// Custom metrics
export const metrics = {
  // Request duration histogram
  requestDuration: new Histogram({
    name: 'api_http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.1, 0.5, 1, 2, 5, 10] // buckets in seconds
  }),

  // Request count counter
  requestCount: new Counter({
    name: 'api_http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code']
  }),

  // Database query duration
  dbQueryDuration: new Histogram({
    name: 'api_database_query_duration_seconds',
    help: 'Duration of database queries in seconds',
    labelNames: ['operation', 'collection'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2]
  }),

  // Redis/Queue latency
  redisLatency: new Histogram({
    name: 'api_redis_operation_duration_seconds',
    help: 'Duration of Redis operations in seconds',
    labelNames: ['operation'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1]
  }),

  // Active connections gauge
  activeConnections: new Gauge({
    name: 'api_active_connections',
    help: 'Number of active connections'
  }),

  // Queue metrics
  queueJobsTotal: new Counter({
    name: 'api_queue_jobs_total',
    help: 'Total number of jobs processed by queue',
    labelNames: ['queue_name', 'status']
  }),

  queueJobsActive: new Gauge({
    name: 'api_queue_jobs_active',
    help: 'Number of active jobs in queue',
    labelNames: ['queue_name']
  }),

  // Business metrics
  placasCreated: new Counter({
    name: 'api_placas_created_total',
    help: 'Total number of placas created',
    labelNames: ['empresa_id']
  }),

  alugueisCreated: new Counter({
    name: 'api_alugueis_created_total',
    help: 'Total number of alugueis created',
    labelNames: ['empresa_id']
  })
};

// Middleware to collect HTTP metrics
export const metricsMiddleware = (req: any, res: any, next: any) => {
  const start = Date.now();

  // Increment active connections
  metrics.activeConnections.inc();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000; // Convert to seconds
    const route = req.route?.path || req.path || 'unknown';
    const method = req.method;
    const statusCode = res.statusCode.toString();

    // Record metrics
    metrics.requestDuration
      .labels(method, route, statusCode)
      .observe(duration);

    metrics.requestCount
      .labels(method, route, statusCode)
      .inc();

    // Decrement active connections
    metrics.activeConnections.dec();

    logger.debug(`[Metrics] ${method} ${route} ${statusCode} - ${duration.toFixed(3)}s`);
  });

  next();
};

// Function to get metrics for Prometheus scraping
export const getMetrics = async (): Promise<string> => {
  try {
    return await register.metrics();
  } catch (error: any) {
    logger.error('[Metrics] Error generating metrics:', error.message);
    throw error;
  }
};

// Function to register custom metrics collectors
export const registerMetricsCollectors = () => {
  logger.info('[Metrics] Custom metrics collectors registered');
};

// Graceful shutdown for metrics
export const closeMetrics = async () => {
  try {
    register.clear();
    logger.info('[Metrics] Metrics registry cleared');
  } catch (error: any) {
    logger.error('[Metrics] Error clearing metrics registry:', error.message);
  }
};