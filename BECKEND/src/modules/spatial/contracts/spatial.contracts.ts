export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface BoundingBox {
  northEast: GeoPoint;
  southWest: GeoPoint;
}

export interface RadiusQuery {
  center: GeoPoint;
  radiusMeters: number;
}

export interface SpatialResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export type GeoPointInput =
  | GeoPoint
  | [number, number]
  | string
  | {
      lat?: number | string;
      lng?: number | string;
      latitude?: number | string;
      longitude?: number | string;
    };

