import type { BoundingBox, GeoPoint, RadiusQuery, SpatialResult } from '../contracts/spatial.contracts';
import { GeoPointInputSchema, GeoPointSchema } from '../validators/spatial.validators';

describe('Spatial Core internal contracts', () => {
  it('keeps GeoPoint shape stable', () => {
    const point: GeoPoint = { latitude: -3.7319, longitude: -38.5267 };

    expect(GeoPointSchema.parse(point)).toEqual(point);
  });

  it('keeps BoundingBox shape stable', () => {
    const box: BoundingBox = {
      northEast: { latitude: 1, longitude: 1 },
      southWest: { latitude: -1, longitude: -1 },
    };

    expect(box.northEast.latitude).toBe(1);
    expect(box.southWest.longitude).toBe(-1);
  });

  it('keeps RadiusQuery shape stable', () => {
    const query: RadiusQuery = {
      center: { latitude: 0, longitude: 0 },
      radiusMeters: 500,
    };

    expect(query.radiusMeters).toBe(500);
  });

  it('keeps SpatialResult success shape stable', () => {
    const result: SpatialResult<GeoPoint> = {
      ok: true,
      data: { latitude: 0, longitude: 0 },
    };

    expect(result.ok).toBe(true);
    expect(result.data?.latitude).toBe(0);
  });

  it('accepts supported GeoPoint input formats', () => {
    expect(GeoPointInputSchema.safeParse({ latitude: 0, longitude: 0 }).success).toBe(true);
    expect(GeoPointInputSchema.safeParse({ lat: '0', lng: '0' }).success).toBe(true);
    expect(GeoPointInputSchema.safeParse([0, 0]).success).toBe(true);
    expect(GeoPointInputSchema.safeParse('0, 0').success).toBe(true);
  });

  it('rejects invalid GeoPoint input formats', () => {
    expect(GeoPointInputSchema.safeParse('abc').success).toBe(false);
    expect(GeoPointInputSchema.safeParse({ latitude: 100, longitude: 0 }).success).toBe(false);
    expect(GeoPointInputSchema.safeParse([0, 200]).success).toBe(false);
  });
});

