import { spatialService } from '@modules/spatial';
import type {
  InventoryProjection,
  SpatialProjection,
  SpatialProjectionGroup,
  SpatialProjectionPoint,
} from '../contracts/projection.contracts';

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export class SpatialProjectionBuilder {
  build(inventoryProjection: InventoryProjection): SpatialProjection {
    const points: SpatialProjectionPoint[] = [];
    const invalidPointIds: string[] = [];

    inventoryProjection.items.forEach((item) => {
      if (!item.coordinates) {
        invalidPointIds.push(item.placaId);
        return;
      }

      const normalized = spatialService.normalizeGeoPoint(item.coordinates);
      if (!normalized.ok || !normalized.data) {
        invalidPointIds.push(item.placaId);
        return;
      }

      points.push({
        placaId: item.placaId,
        empresaId: item.empresaId,
        regiaoId: item.regiaoId,
        numeroOperacional: item.numeroOperacional,
        coordinates: normalized.data,
      });
    });

    const boundingBox = points.length > 0
      ? {
          northEast: {
            latitude: Math.max(...points.map((point) => point.coordinates.latitude)),
            longitude: Math.max(...points.map((point) => point.coordinates.longitude)),
          },
          southWest: {
            latitude: Math.min(...points.map((point) => point.coordinates.latitude)),
            longitude: Math.min(...points.map((point) => point.coordinates.longitude)),
          },
        }
      : undefined;

    const groupsMap = new Map<string, SpatialProjectionPoint[]>();
    points.forEach((point) => {
      const key = point.regiaoId ?? 'unknown-region';
      const current = groupsMap.get(key) ?? [];
      current.push(point);
      groupsMap.set(key, current);
    });

    const groups: SpatialProjectionGroup[] = Array.from(groupsMap.entries()).map(([key, groupPoints]) => ({
      key,
      count: groupPoints.length,
      center: {
        latitude: average(groupPoints.map((point) => point.coordinates.latitude)),
        longitude: average(groupPoints.map((point) => point.coordinates.longitude)),
      },
    }));

    return {
      points,
      invalidPointIds,
      boundingBox,
      groups,
      status: points.length === 0 ? 'empty' : invalidPointIds.length > 0 ? 'partial' : 'ready',
    };
  }
}
