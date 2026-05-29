export {
  CommercialAvailabilityProjection,
  commercialAvailabilityProjection,
  type CommercialAvailabilityResult,
  type CommercialAvailabilitySource,
  type CommercialAvailabilityStatus,
  type ResolvePlateCommercialStatusParams,
} from './commercial-availability.projection';
export {
  getProjectionMetricsSnapshot,
  recordProjectionMetric,
  resetProjectionMetrics,
  type ProjectionMetricName,
  type ProjectionMetricSnapshot,
} from '@shared/infra/monitoring/projection-metrics';
