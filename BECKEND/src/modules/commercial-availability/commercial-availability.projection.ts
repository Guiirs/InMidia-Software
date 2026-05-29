import { Types } from 'mongoose';
import Aluguel from '@modules/alugueis/Aluguel';
import Placa from '@modules/placas/Placa';
import TemporalReservation, { type ITemporalReservation } from '@modules/temporal/TemporalReservation';
import { recordProjectionMetric } from '@shared/infra/monitoring/projection-metrics';
import {
  projectionCacheService,
  makeCacheKey,
  hashPlateIds,
  timeBucket,
  CACHE_TTL_MS,
} from '@shared/infra/cache';

export type CommercialAvailabilityStatus =
  | 'AVAILABLE'
  | 'RESERVED'
  | 'CONTRACTED_ACTIVE'
  | 'FUTURE_RESERVED'
  | 'MAINTENANCE'
  | 'UNKNOWN';

export type CommercialAvailabilitySource = 'temporal' | 'fallback_legacy' | 'physical_block';

export interface CommercialAvailabilityResult {
  status: CommercialAvailabilityStatus;
  source: CommercialAvailabilitySource;
  isCommerciallyAvailable: boolean;
  isPhysicallyBlocked: boolean;
  activeReservationId?: string;
  activeContractId?: string;
  reason?: string;
}

export interface ResolvePlateCommercialStatusParams {
  empresaId: string;
  placaId: string;
  at?: Date;
}

function toObjectId(value: string, field: string): Types.ObjectId {
  if (!value) {
    throw new Error(`${field} obrigatorio.`);
  }
  if (!Types.ObjectId.isValid(value)) {
    throw new Error(`${field} invalido.`);
  }
  return new Types.ObjectId(value);
}

function asDate(input: unknown): Date | null {
  if (!input) return null;
  const date = input instanceof Date ? input : new Date(String(input));
  return Number.isNaN(date.getTime()) ? null : date;
}

function isBlockingTemporal(status: string): boolean {
  return status === 'RESERVED' || status === 'ACTIVE' || status === 'BLOCKED';
}

function isCancelledLegacy(status: unknown): boolean {
  return status === 'cancelado' || status === 'finalizado';
}

function activeTemporalStatus(reservation: ITemporalReservation): CommercialAvailabilityStatus {
  if (reservation.sourceType === 'CONTRACT' || reservation.status === 'ACTIVE') return 'CONTRACTED_ACTIVE';
  if (reservation.sourceType === 'MANUAL_BLOCK' || reservation.status === 'BLOCKED') return 'MAINTENANCE';
  return 'RESERVED';
}

function resultFromTemporal(reservation: ITemporalReservation, now: Date): CommercialAvailabilityResult {
  const active = reservation.startDate <= now && reservation.endDate >= now;
  const status = active ? activeTemporalStatus(reservation) : 'FUTURE_RESERVED';
  const isPhysicallyBlocked = reservation.sourceType === 'MANUAL_BLOCK' || reservation.status === 'BLOCKED';

  return {
    status,
    source: 'temporal',
    isCommerciallyAvailable: false,
    isPhysicallyBlocked,
    activeReservationId: String(reservation._id),
    activeContractId: reservation.sourceType === 'CONTRACT' ? reservation.sourceId : undefined,
    reason: `Temporal reservation ${reservation.sourceType}:${reservation.sourceId}`,
  };
}

function resultFromLegacy(aluguel: any, now: Date): CommercialAvailabilityResult {
  const start = asDate(aluguel.startDate ?? aluguel.data_inicio);
  const end = asDate(aluguel.endDate ?? aluguel.data_fim);
  const active = Boolean(start && end && start <= now && end >= now);

  return {
    status: active ? 'CONTRACTED_ACTIVE' : 'FUTURE_RESERVED',
    source: 'fallback_legacy',
    isCommerciallyAvailable: false,
    isPhysicallyBlocked: false,
    activeReservationId: String(aluguel._id),
    activeContractId: aluguel.contratoId ? String(aluguel.contratoId) : undefined,
    reason: 'Fallback legado via Aluguel',
  };
}

function unknownResult(reason: string): CommercialAvailabilityResult {
  return {
    status: 'UNKNOWN',
    source: 'physical_block',
    isCommerciallyAvailable: false,
    isPhysicallyBlocked: false,
    reason,
  };
}

function availableResult(): CommercialAvailabilityResult {
  return {
    status: 'AVAILABLE',
    source: 'temporal',
    isCommerciallyAvailable: true,
    isPhysicallyBlocked: false,
    reason: 'Sem reserva temporal bloqueante',
  };
}

function physicalBlockResult(): CommercialAvailabilityResult {
  return {
    status: 'MAINTENANCE',
    source: 'physical_block',
    isCommerciallyAvailable: false,
    isPhysicallyBlocked: true,
    reason: 'Placa fisicamente bloqueada',
  };
}

// Serialize/deserialize Map<string, CommercialAvailabilityResult> for cache storage
function serializeStatusMap(map: Map<string, CommercialAvailabilityResult>): Array<[string, CommercialAvailabilityResult]> {
  return Array.from(map.entries());
}

function deserializeStatusMap(entries: Array<[string, CommercialAvailabilityResult]>): Map<string, CommercialAvailabilityResult> {
  return new Map(entries);
}

// Cache key uses time bucket so entries naturally expire within TTL window
function batchCacheKey(empresaId: string, placaIds: string[]): string {
  const hash = hashPlateIds(placaIds);
  const bucket = timeBucket(CACHE_TTL_MS.AVAILABILITY_BATCH);
  return makeCacheKey(empresaId, 'commercial', hash, String(bucket));
}

export class CommercialAvailabilityProjection {
  async resolvePlateCommercialStatus(
    params: ResolvePlateCommercialStatusParams,
  ): Promise<CommercialAvailabilityResult> {
    const startedAt = Date.now();
    const now = params.at ?? new Date();
    const empresaObjectId = toObjectId(params.empresaId, 'empresaId');
    const placaObjectId = toObjectId(params.placaId, 'placaId');

    const [placa, temporalReservations] = await Promise.all([
      Placa.findOne({ _id: placaObjectId, empresaId: empresaObjectId })
        .select('_id disponivel ativa')
        .lean<any>(),
      TemporalReservation.find({
        empresaId: empresaObjectId,
        plateId: placaObjectId,
        status: { $in: ['RESERVED', 'ACTIVE', 'BLOCKED'] },
      })
        .sort({ startDate: 1 })
        .lean<ITemporalReservation[]>(),
    ]);

    if (!placa) {
      const result = unknownResult('Placa nao encontrada');
      recordProjectionMetric({
        projection: 'commercial',
        durationMs: Date.now() - startedAt,
        plateCount: 1,
      });
      return result;
    }

    const blockingTemporal = temporalReservations
      .filter((reservation) => isBlockingTemporal(reservation.status))
      .find((reservation) => reservation.startDate <= now && reservation.endDate >= now)
      ?? temporalReservations
        .filter((reservation) => isBlockingTemporal(reservation.status))
        .find((reservation) => reservation.startDate > now);

    if (blockingTemporal) {
      const result = resultFromTemporal(blockingTemporal, now);
      recordProjectionMetric({
        projection: 'commercial',
        durationMs: Date.now() - startedAt,
        plateCount: 1,
      });
      return result;
    }

    const legacyRental = await Aluguel.findOne({
      empresaId: params.empresaId,
      status: { $nin: ['cancelado', 'finalizado'] },
      $or: [{ placaId: placaObjectId }, { placa: placaObjectId }],
      $and: [
        { $or: [{ startDate: { $lte: now } }, { data_inicio: { $lte: now } }, { startDate: { $gt: now } }, { data_inicio: { $gt: now } }] },
        { $or: [{ endDate: { $gte: now } }, { data_fim: { $gte: now } }] },
      ],
    })
      .sort({ startDate: 1, data_inicio: 1 })
      .lean<any>();

    if (legacyRental && !isCancelledLegacy(legacyRental.status)) {
      const result = resultFromLegacy(legacyRental, now);
      recordProjectionMetric({
        projection: 'commercial',
        durationMs: Date.now() - startedAt,
        plateCount: 1,
        fallbackCount: 1,
      });
      return result;
    }

    const isPhysicallyBlocked = (placa.disponivel ?? placa.ativa ?? true) === false;
    if (isPhysicallyBlocked) {
      const result = physicalBlockResult();
      recordProjectionMetric({
        projection: 'commercial',
        durationMs: Date.now() - startedAt,
        plateCount: 1,
      });
      return result;
    }

    const result = availableResult();
    recordProjectionMetric({
      projection: 'commercial',
      durationMs: Date.now() - startedAt,
      plateCount: 1,
    });
    return result;
  }

  async resolveManyPlateCommercialStatuses(params: {
    empresaId: string;
    placaIds: string[];
    at?: Date;
    skipCache?: boolean;
  }): Promise<Map<string, CommercialAvailabilityResult>> {
    const startedAt = Date.now();
    const now = params.at ?? new Date();

    // Only use cache for "now-ish" queries (no explicit historical `at`)
    const useCache = !params.skipCache && !params.at;

    if (useCache && params.placaIds.length > 0) {
      try {
        const key = batchCacheKey(params.empresaId, params.placaIds);
        const cached = projectionCacheService.get<Array<[string, CommercialAvailabilityResult]>>(key);
        if (cached) {
          const result = deserializeStatusMap(cached);
          recordProjectionMetric({
            projection: 'commercial',
            durationMs: Date.now() - startedAt,
            plateCount: result.size,
            cacheHit: true,
          });
          return result;
        }
      } catch {
        // cache miss on error — continue to compute
      }
    }

    const empresaObjectId = toObjectId(params.empresaId, 'empresaId');
    const placaObjectIds = Array.from(new Set(params.placaIds))
      .filter((placaId) => Types.ObjectId.isValid(placaId))
      .map((placaId) => new Types.ObjectId(placaId));

    if (placaObjectIds.length === 0) {
      recordProjectionMetric({
        projection: 'commercial',
        durationMs: Date.now() - startedAt,
        plateCount: 0,
        cacheHit: false,
      });
      return new Map();
    }

    const [placas, temporalReservations] = await Promise.all([
      Placa.find({ _id: { $in: placaObjectIds }, empresaId: empresaObjectId })
        .select('_id disponivel ativa')
        .lean<any[]>(),
      TemporalReservation.find({
        empresaId: empresaObjectId,
        plateId: { $in: placaObjectIds },
        status: { $in: ['RESERVED', 'ACTIVE', 'BLOCKED'] },
      })
        .sort({ startDate: 1 })
        .lean<ITemporalReservation[]>(),
    ]);

    const placasById = new Map<string, any>();
    placas.forEach((placa) => placasById.set(String(placa._id), placa));

    const temporalByPlate = new Map<string, ITemporalReservation[]>();
    temporalReservations.forEach((reservation) => {
      const key = String(reservation.plateId);
      const list = temporalByPlate.get(key) || [];
      list.push(reservation);
      temporalByPlate.set(key, list);
    });

    const result = new Map<string, CommercialAvailabilityResult>();
    const fallbackCandidateIds: string[] = [];

    params.placaIds.forEach((placaId) => {
      const placa = placasById.get(placaId);
      if (!placa) {
        result.set(placaId, unknownResult('Placa nao encontrada'));
        return;
      }

      const reservations = temporalByPlate.get(placaId) || [];
      const blockingTemporal = reservations
        .filter((reservation) => isBlockingTemporal(reservation.status))
        .find((reservation) => reservation.startDate <= now && reservation.endDate >= now)
        ?? reservations
          .filter((reservation) => isBlockingTemporal(reservation.status))
          .find((reservation) => reservation.startDate > now);

      if (blockingTemporal) {
        result.set(placaId, resultFromTemporal(blockingTemporal, now));
        return;
      }

      fallbackCandidateIds.push(placaId);
    });

    const fallbackObjectIds = fallbackCandidateIds.map((placaId) => new Types.ObjectId(placaId));
    const legacyRentals = fallbackObjectIds.length > 0
      ? await Aluguel.find({
          empresaId: empresaObjectId,
          status: { $nin: ['cancelado', 'finalizado'] },
          $or: [{ placaId: { $in: fallbackObjectIds } }, { placa: { $in: fallbackObjectIds } }],
          $and: [
            { $or: [{ startDate: { $lte: now } }, { data_inicio: { $lte: now } }, { startDate: { $gt: now } }, { data_inicio: { $gt: now } }] },
            { $or: [{ endDate: { $gte: now } }, { data_fim: { $gte: now } }] },
          ],
        })
          .sort({ startDate: 1, data_inicio: 1 })
          .lean<any[]>()
      : [];

    const legacyByPlate = new Map<string, any>();
    legacyRentals.forEach((rental) => {
      const key = String(rental.placaId ?? rental.placa ?? '');
      if (key && !legacyByPlate.has(key)) legacyByPlate.set(key, rental);
    });

    fallbackCandidateIds.forEach((placaId) => {
      const placa = placasById.get(placaId);
      const legacyRental = legacyByPlate.get(placaId);
      if (legacyRental && !isCancelledLegacy(legacyRental.status)) {
        result.set(placaId, resultFromLegacy(legacyRental, now));
        return;
      }

      const isPhysicallyBlocked = (placa.disponivel ?? placa.ativa ?? true) === false;
      if (isPhysicallyBlocked) {
        result.set(placaId, physicalBlockResult());
        return;
      }

      result.set(placaId, availableResult());
    });

    const fallbackCount = Array.from(result.values())
      .filter((status) => status.source === 'fallback_legacy')
      .length;

    // Store in cache (only for "now" queries)
    if (useCache && result.size > 0) {
      try {
        const key = batchCacheKey(params.empresaId, params.placaIds);
        projectionCacheService.set(key, serializeStatusMap(result), CACHE_TTL_MS.AVAILABILITY_BATCH);
      } catch {
        // cache write failure is non-fatal
      }
    }

    recordProjectionMetric({
      projection: 'commercial',
      durationMs: Date.now() - startedAt,
      plateCount: result.size,
      fallbackCount,
      cacheHit: false,
      rebuild: true,
    });

    return result;
  }
}

export const commercialAvailabilityProjection = new CommercialAvailabilityProjection();
