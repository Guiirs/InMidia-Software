import logger from '@shared/container/logger';
import type {
  BoundingBox,
  GeoPoint,
  GeoPointInput,
  RadiusQuery,
  SpatialResult,
} from '../contracts/spatial.contracts';
import { parseGeoPointInput, roundCoordinate, toRadians } from '../utils/coordinate.utils';

const EARTH_RADIUS_METERS = 6371008.8;
const METERS_PER_DEGREE_LATITUDE = 111320;

export class SpatialService {
  validateCoordinates(input: GeoPointInput): SpatialResult<GeoPoint> {
    const parsed = parseGeoPointInput(input);

    if (!parsed) {
      logger.warn('[SpatialCore] Invalid coordinate payload', { inputType: typeof input });
      return { ok: false, error: 'INVALID_COORDINATE_FORMAT' };
    }

    if (parsed.latitude < -90 || parsed.latitude > 90) {
      logger.warn('[SpatialCore] Invalid latitude', { latitude: parsed.latitude });
      return { ok: false, error: 'INVALID_LATITUDE' };
    }

    if (parsed.longitude < -180 || parsed.longitude > 180) {
      logger.warn('[SpatialCore] Invalid longitude', { longitude: parsed.longitude });
      return { ok: false, error: 'INVALID_LONGITUDE' };
    }

    return { ok: true, data: parsed };
  }

  normalizeCoordinates(input: GeoPointInput, precision = 6): SpatialResult<GeoPoint> {
    const validation = this.validateCoordinates(input);
    if (!validation.ok || !validation.data) return validation;

    return {
      ok: true,
      data: {
        latitude: roundCoordinate(validation.data.latitude, precision),
        longitude: roundCoordinate(validation.data.longitude, precision),
      },
    };
  }

  calculateDistance(from: GeoPointInput, to: GeoPointInput): SpatialResult<number> {
    const start = this.normalizeGeoPoint(from);
    const end = this.normalizeGeoPoint(to);

    if (!start.ok || !start.data) return { ok: false, error: start.error ?? 'INVALID_START_POINT' };
    if (!end.ok || !end.data) return { ok: false, error: end.error ?? 'INVALID_END_POINT' };

    const deltaLat = toRadians(end.data.latitude - start.data.latitude);
    const deltaLon = toRadians(end.data.longitude - start.data.longitude);
    const lat1 = toRadians(start.data.latitude);
    const lat2 = toRadians(end.data.latitude);

    const a =
      Math.sin(deltaLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return { ok: true, data: EARTH_RADIUS_METERS * c };
  }

  isWithinRadius(point: GeoPointInput, query: RadiusQuery): SpatialResult<boolean> {
    if (!Number.isFinite(query.radiusMeters) || query.radiusMeters < 0) {
      logger.warn('[SpatialCore] Invalid radius query', { radiusMeters: query.radiusMeters });
      return { ok: false, error: 'INVALID_RADIUS' };
    }

    const distance = this.calculateDistance(query.center, point);
    if (!distance.ok || distance.data === undefined) return { ok: false, error: distance.error };

    return { ok: true, data: distance.data <= query.radiusMeters };
  }

  buildBoundingBox(centerInput: GeoPointInput, radiusMeters: number): SpatialResult<BoundingBox> {
    const center = this.normalizeGeoPoint(centerInput);
    if (!center.ok || !center.data) return { ok: false, error: center.error };

    if (!Number.isFinite(radiusMeters) || radiusMeters < 0) {
      logger.warn('[SpatialCore] Invalid bounding box radius', { radiusMeters });
      return { ok: false, error: 'INVALID_RADIUS' };
    }

    const latDelta = radiusMeters / METERS_PER_DEGREE_LATITUDE;
    const latitudeRadians = toRadians(center.data.latitude);
    const metersPerDegreeLongitude = Math.max(
      Math.cos(latitudeRadians) * METERS_PER_DEGREE_LATITUDE,
      0.000001,
    );
    const lonDelta = radiusMeters / metersPerDegreeLongitude;

    return {
      ok: true,
      data: {
        northEast: {
          latitude: Math.min(90, center.data.latitude + latDelta),
          longitude: Math.min(180, center.data.longitude + lonDelta),
        },
        southWest: {
          latitude: Math.max(-90, center.data.latitude - latDelta),
          longitude: Math.max(-180, center.data.longitude - lonDelta),
        },
      },
    };
  }

  normalizeGeoPoint(input: GeoPointInput): SpatialResult<GeoPoint> {
    return this.normalizeCoordinates(input);
  }
}

export const spatialService = new SpatialService();

