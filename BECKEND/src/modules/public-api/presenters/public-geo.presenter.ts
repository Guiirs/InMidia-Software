import type { SpatialProjection, SpatialProjectionPoint } from '@modules/projections';
import type { PublicGeoPoint } from '../contracts/public-api.contracts';

function toPublicRegionId(regionId?: string): string | undefined {
  if (!regionId) return undefined;
  return /^[0-9a-f]{24}$/i.test(regionId)
    ? `region-${regionId.slice(-8)}`
    : regionId;
}

export interface PublicGeoCatalog {
  status: SpatialProjection['status'];
  points: Array<{
    id: string;
    regionId?: string;
    boardNumber?: string;
    geo: PublicGeoPoint;
  }>;
  boundingBox?: SpatialProjection['boundingBox'];
  groups: SpatialProjection['groups'];
  invalidPoints: number;
}

export class PublicGeoPresenter {
  static point(point: SpatialProjectionPoint): PublicGeoCatalog['points'][number] {
    return {
      id: point.numeroOperacional ? `op-${point.numeroOperacional}` : `board-${point.placaId.slice(-8)}`,
      regionId: toPublicRegionId(point.regiaoId),
      boardNumber: point.numeroOperacional ? String(point.numeroOperacional) : undefined,
      geo: {
        latitude: point.coordinates.latitude,
        longitude: point.coordinates.longitude,
        precision: 'exact',
      },
    };
  }

  static catalog(spatial: SpatialProjection): PublicGeoCatalog {
    return {
      status: spatial.status,
      points: spatial.points.map((point) => this.point(point)),
      boundingBox: spatial.boundingBox,
      groups: spatial.groups,
      invalidPoints: spatial.invalidPointIds.length,
    };
  }
}
