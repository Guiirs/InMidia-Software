import { z } from 'zod';
import { spatialService } from '../services/spatial.service';
import type { GeoPoint } from '../contracts/spatial.contracts';

export const GeoPointSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const GeoPointInputSchema = z.union([
  GeoPointSchema,
  z.tuple([z.number(), z.number()]),
  z.string(),
  z.object({
    lat: z.union([z.number(), z.string()]).optional(),
    lng: z.union([z.number(), z.string()]).optional(),
    latitude: z.union([z.number(), z.string()]).optional(),
    longitude: z.union([z.number(), z.string()]).optional(),
  }),
]).superRefine((value, ctx) => {
  const result = spatialService.validateCoordinates(value);
  if (!result.ok) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: result.error ?? 'INVALID_COORDINATES',
    });
  }
});

export function parseGeoPointOrThrow(input: unknown): GeoPoint {
  const result = spatialService.normalizeGeoPoint(input as any);
  if (!result.ok || !result.data) {
    throw new Error(result.error ?? 'INVALID_COORDINATES');
  }
  return result.data;
}

