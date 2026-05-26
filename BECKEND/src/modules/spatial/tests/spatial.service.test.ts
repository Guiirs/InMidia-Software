import { spatialService } from '../services/spatial.service';

describe('SpatialService', () => {
  describe('validateCoordinates', () => {
    it('accepts valid object coordinates', () => {
      const result = spatialService.validateCoordinates({ latitude: -3.7319, longitude: -38.5267 });

      expect(result.ok).toBe(true);
      expect(result.data).toEqual({ latitude: -3.7319, longitude: -38.5267 });
    });

    it('rejects invalid latitude', () => {
      const result = spatialService.validateCoordinates({ latitude: 91, longitude: 0 });

      expect(result.ok).toBe(false);
      expect(result.error).toBe('INVALID_LATITUDE');
    });

    it('rejects invalid longitude', () => {
      const result = spatialService.validateCoordinates({ latitude: 0, longitude: -181 });

      expect(result.ok).toBe(false);
      expect(result.error).toBe('INVALID_LONGITUDE');
    });

    it('rejects malformed coordinate strings', () => {
      const result = spatialService.validateCoordinates('not-a-coordinate');

      expect(result.ok).toBe(false);
      expect(result.error).toBe('INVALID_COORDINATE_FORMAT');
    });
  });

  describe('normalizeCoordinates', () => {
    it('parses and rounds string coordinates', () => {
      const result = spatialService.normalizeCoordinates(' -3.73191234, -38.52671234 ');

      expect(result.ok).toBe(true);
      expect(result.data).toEqual({ latitude: -3.731912, longitude: -38.526712 });
    });

    it('accepts lat/lng aliases', () => {
      const result = spatialService.normalizeGeoPoint({ lat: '-3.7', lng: '-38.5' });

      expect(result.ok).toBe(true);
      expect(result.data).toEqual({ latitude: -3.7, longitude: -38.5 });
    });
  });

  describe('calculateDistance', () => {
    it('returns zero for the same point', () => {
      const result = spatialService.calculateDistance(
        { latitude: -3.7319, longitude: -38.5267 },
        { latitude: -3.7319, longitude: -38.5267 },
      );

      expect(result.ok).toBe(true);
      expect(result.data).toBe(0);
    });

    it('calculates approximate haversine distance in meters', () => {
      const result = spatialService.calculateDistance(
        { latitude: 0, longitude: 0 },
        { latitude: 0, longitude: 1 },
      );

      expect(result.ok).toBe(true);
      expect(result.data).toBeGreaterThan(111000);
      expect(result.data).toBeLessThan(112000);
    });
  });

  describe('isWithinRadius', () => {
    it('detects a point inside radius', () => {
      const result = spatialService.isWithinRadius(
        { latitude: 0, longitude: 0.001 },
        { center: { latitude: 0, longitude: 0 }, radiusMeters: 200 },
      );

      expect(result.ok).toBe(true);
      expect(result.data).toBe(true);
    });

    it('detects a point outside radius', () => {
      const result = spatialService.isWithinRadius(
        { latitude: 0, longitude: 1 },
        { center: { latitude: 0, longitude: 0 }, radiusMeters: 200 },
      );

      expect(result.ok).toBe(true);
      expect(result.data).toBe(false);
    });

    it('rejects invalid radius values', () => {
      const result = spatialService.isWithinRadius(
        { latitude: 0, longitude: 0 },
        { center: { latitude: 0, longitude: 0 }, radiusMeters: -1 },
      );

      expect(result.ok).toBe(false);
      expect(result.error).toBe('INVALID_RADIUS');
    });
  });

  describe('buildBoundingBox', () => {
    it('builds a bounding box around a valid point', () => {
      const result = spatialService.buildBoundingBox({ latitude: 0, longitude: 0 }, 1000);

      expect(result.ok).toBe(true);
      expect(result.data?.northEast.latitude).toBeGreaterThan(0);
      expect(result.data?.northEast.longitude).toBeGreaterThan(0);
      expect(result.data?.southWest.latitude).toBeLessThan(0);
      expect(result.data?.southWest.longitude).toBeLessThan(0);
    });

    it('clamps bounding boxes near the poles', () => {
      const result = spatialService.buildBoundingBox({ latitude: 89.999, longitude: 179.999 }, 10000);

      expect(result.ok).toBe(true);
      expect(result.data?.northEast.latitude).toBeLessThanOrEqual(90);
      expect(result.data?.northEast.longitude).toBeLessThanOrEqual(180);
    });
  });
});

