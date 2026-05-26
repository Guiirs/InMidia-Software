import type { SpatialProjection, SpatialProjectionPoint } from '@modules/projections';
import type { PublicGeoPoint } from '../contracts/public-api.contracts';

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
      id: point.numeroOperacional ? `op-${point.numeroOperacional}` : point.placaId,
      regionId: point.regiaoId,
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
