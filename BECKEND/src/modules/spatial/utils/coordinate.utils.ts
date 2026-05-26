import type { GeoPoint, GeoPointInput } from '../contracts/spatial.contracts';

const COORDINATE_PAIR_PATTERN = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;

export function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function parseGeoPointInput(input: GeoPointInput): GeoPoint | null {
  if (typeof input === 'string') {
    const match = input.match(COORDINATE_PAIR_PATTERN);
    if (!match) return null;

    const latitude = toFiniteNumber(match[1]);
    const longitude = toFiniteNumber(match[2]);
    return latitude === null || longitude === null ? null : { latitude, longitude };
  }

  if (Array.isArray(input)) {
    const latitude = toFiniteNumber(input[0]);
    const longitude = toFiniteNumber(input[1]);
    return latitude === null || longitude === null ? null : { latitude, longitude };
  }

  if (input && typeof input === 'object') {
    const candidate = input as Record<string, unknown>;
    const latitude = toFiniteNumber(candidate.latitude ?? candidate.lat);
    const longitude = toFiniteNumber(candidate.longitude ?? candidate.lng);
    return latitude === null || longitude === null ? null : { latitude, longitude };
  }

  return null;
}

export function roundCoordinate(value: number, precision = 6): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}
