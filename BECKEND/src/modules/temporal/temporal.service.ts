import { Types } from 'mongoose';
import AppError from '@shared/container/AppError';
import logger from '@shared/container/logger';
import Placa from '@modules/placas/Placa';
import PropostaInterna from '@modules/propostas-internas/PropostaInterna';
import Contrato from '@modules/contratos/Contrato';
import Aluguel from '@modules/alugueis/Aluguel';
import Region from '@modules/regions/Region';
import TemporalReservation, { type ITemporalReservation } from './TemporalReservation';
import TemporalEvent from './TemporalEvent';
import {
  TEMPORAL_BLOCKING_STATUSES,
  TEMPORAL_CRITICAL_PLATE_FIELDS,
  type CreateTemporalReservationPayload,
  type PlateTemporalStatus,
  type TemporalAvailabilityResult,
  type TemporalConflict,
  type TemporalEventType,
  type TemporalReservationStatus,
  type TemporalSourceType,
} from './temporal.types';

type DateLike = Date | string;

function toObjectId(value: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new AppError('Identificador invalido para operacao temporal.', 400);
  }
  return new Types.ObjectId(value);
}

function normalizeDate(value: DateLike, field: string): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(`${field} invalida.`, 400);
  }
  return date;
}

function assertValidInterval(startDate: DateLike, endDate: DateLike): { start: Date; end: Date } {
  const start = normalizeDate(startDate, 'startDate');
  const end = normalizeDate(endDate, 'endDate');
  if (start >= end) {
    throw new AppError('startDate precisa ser menor que endDate.', 400);
  }
  return { start, end };
}

function hasOverlap(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
  return startA < endB && endA > startB;
}

function isBlockingStatus(status: TemporalReservationStatus): boolean {
  return TEMPORAL_BLOCKING_STATUSES.includes(status);
}

function isActiveNow(item: Pick<ITemporalReservation, 'startDate' | 'endDate' | 'status'>, now: Date): boolean {
  return isBlockingStatus(item.status) && item.startDate <= now && item.endDate >= now;
}

function toConflict(reservation: ITemporalReservation, start: Date, end: Date): TemporalConflict {
  return {
    plateId: String(reservation.plateId),
    message: `Placa indisponivel entre ${start.toISOString()} e ${end.toISOString()} por conflito com ${reservation.sourceType} ${reservation.sourceId}.`,
    conflictingReservation: {
      id: String(reservation._id),
      sourceType: reservation.sourceType,
      sourceId: reservation.sourceId,
      status: reservation.status,
      startDate: reservation.startDate.toISOString(),
      endDate: reservation.endDate.toISOString(),
      reason: reservation.reason,
    },
  };
}

function normalizeChangedFields(input: string[] | Record<string, unknown>): string[] {
  return Array.isArray(input) ? input : Object.keys(input || {});
}

function extractPeriod(source: any): { startDate: Date; endDate: Date } {
  const startDate = source?.startDate || source?.dataInicio || source?.data_inicio;
  const endDate = source?.endDate || source?.dataFim || source?.data_fim;
  const interval = assertValidInterval(startDate, endDate);
  return { startDate: interval.start, endDate: interval.end };
}

function toMoney(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function rate(part: number, total: number): number {
  if (!total) return 0;
  return Number(((part / total) * 100).toFixed(2));
}

function onlyObjectIds(values: string[]): string[] {
  return [...new Set(values.filter((value) => Types.ObjectId.isValid(value)))];
}

function regionKeyFromPlate(plate: any, regionNames = new Map<string, string>()): { regionId: string; name: string } {
  const rawRegion = plate?.regionId || plate?.regiaoId || plate?.regiao || plate?.loteRegional;
  if (rawRegion && typeof rawRegion === 'object') {
    const id = String(rawRegion._id || rawRegion.id || 'sem-regiao');
    return { regionId: id, name: String(rawRegion.name || rawRegion.nome || regionNames.get(id) || id) };
  }
  const id = rawRegion ? String(rawRegion) : 'sem-regiao';
  return { regionId: id, name: regionNames.get(id) || (id === 'sem-regiao' ? 'Sem regiao' : id) };
}

class TemporalEngineService {
  validateInterval(startDate: DateLike, endDate: DateLike) {
    return assertValidInterval(startDate, endDate);
  }

  overlaps(startA: DateLike, endA: DateLike, startB: DateLike, endB: DateLike): boolean {
    const a = assertValidInterval(startA, endA);
    const b = assertValidInterval(startB, endB);
    return hasOverlap(a.start, a.end, b.start, b.end);
  }

  async recordEvent(input: {
    empresaId: string;
    plateId?: string;
    sourceType?: TemporalSourceType;
    sourceId?: string;
    eventType: TemporalEventType;
    message: string;
    metadata?: Record<string, unknown>;
    createdBy?: string;
  }) {
    try {
      await TemporalEvent.create({
        empresaId: toObjectId(input.empresaId),
        plateId: input.plateId ? toObjectId(input.plateId) : undefined,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        eventType: input.eventType,
        message: input.message,
        metadata: input.metadata ?? {},
        createdBy: input.createdBy,
      });
    } catch (error: any) {
      logger.warn('[TemporalEngine] Falha ao registrar evento temporal', {
        error: error.message,
        eventType: input.eventType,
      });
    }
  }

  async checkPlateAvailability(
    plateId: string,
    startDate: DateLike,
    endDate: DateLike,
    options: {
      empresaId?: string;
      ignoreSource?: { sourceType: TemporalSourceType; sourceId: string };
      allowSameSource?: boolean;
    } = {},
  ): Promise<TemporalAvailabilityResult> {
    const { start, end } = assertValidInterval(startDate, endDate);
    const plateObjectId = toObjectId(plateId);
    const query: Record<string, unknown> = {
      plateId: plateObjectId,
      status: { $in: TEMPORAL_BLOCKING_STATUSES },
      startDate: { $lt: end },
      endDate: { $gt: start },
    };

    if (options.empresaId) query.empresaId = toObjectId(options.empresaId);

    const reservations = await TemporalReservation.find(query).lean<ITemporalReservation[]>();
    const conflicts = reservations
      .filter((reservation) => {
        if (!options.ignoreSource && !options.allowSameSource) return true;
        return !(
          reservation.sourceType === options.ignoreSource?.sourceType
          && reservation.sourceId === options.ignoreSource?.sourceId
        );
      })
      .map((reservation) => toConflict(reservation, start, end));

    if (conflicts.length > 0) {
      const firstConflict = conflicts[0];
      await this.recordEvent({
        empresaId: options.empresaId ?? String(reservations[0]?.empresaId ?? ''),
        plateId,
        eventType: 'TEMPORAL_RESERVATION_CONFLICT',
        message: firstConflict?.message ?? 'Conflito temporal detectado.',
        metadata: { conflicts },
      });
    }

    return { available: conflicts.length === 0, conflicts };
  }

  async checkMultiplePlatesAvailability(
    plateIds: string[],
    startDate: DateLike,
    endDate: DateLike,
    options: {
      empresaId?: string;
      ignoreSource?: { sourceType: TemporalSourceType; sourceId: string };
      allowSameSource?: boolean;
    } = {},
  ): Promise<TemporalAvailabilityResult> {
    const results = await Promise.all(
      plateIds.map((plateId) => this.checkPlateAvailability(plateId, startDate, endDate, options)),
    );
    const conflicts = results.flatMap((result) => result.conflicts);
    return { available: conflicts.length === 0, conflicts };
  }

  async assertMultiplePlatesAvailable(
    plateIds: string[],
    startDate: DateLike,
    endDate: DateLike,
    options: {
      empresaId?: string;
      sourceType?: TemporalSourceType;
      sourceId?: string;
      allowSameSource?: boolean;
    } = {},
  ): Promise<void> {
    const result = await this.checkMultiplePlatesAvailability(plateIds, startDate, endDate, {
      empresaId: options.empresaId,
      ignoreSource: options.sourceType && options.sourceId
        ? { sourceType: options.sourceType, sourceId: options.sourceId }
        : undefined,
      allowSameSource: options.allowSameSource,
    });

    if (!result.available) {
      throw new AppError(result.conflicts[0]?.message || 'Conflito temporal detectado.', 409);
    }
  }

  async createTemporalReservation(payload: CreateTemporalReservationPayload): Promise<ITemporalReservation> {
    const { start, end } = assertValidInterval(payload.startDate, payload.endDate);

    const plate = await Placa.findOne({
      _id: payload.plateId,
      empresaId: payload.empresaId,
    }).select('_id').lean();

    if (!plate) {
      throw new AppError('Placa nao encontrada para reserva temporal.', 404);
    }

    await this.assertMultiplePlatesAvailable([payload.plateId], start, end, {
      empresaId: payload.empresaId,
      sourceType: payload.sourceType,
      sourceId: payload.sourceId,
      allowSameSource: payload.allowSameSource,
    });

    const reservation = await TemporalReservation.create({
      empresaId: toObjectId(payload.empresaId),
      plateId: toObjectId(payload.plateId),
      sourceType: payload.sourceType,
      sourceId: payload.sourceId,
      customerId: payload.customerId ? toObjectId(payload.customerId) : undefined,
      startDate: start,
      endDate: end,
      status: payload.status ?? (payload.sourceType === 'MANUAL_BLOCK' ? 'BLOCKED' : 'RESERVED'),
      reason: payload.reason,
      createdBy: payload.createdBy,
    });

    await this.recordEvent({
      empresaId: payload.empresaId,
      plateId: payload.plateId,
      sourceType: payload.sourceType,
      sourceId: payload.sourceId,
      eventType: reservation.status === 'BLOCKED'
        ? 'TEMPORAL_PLATE_LOCKED'
        : 'TEMPORAL_RESERVATION_CREATED',
      message: `Reserva temporal criada para placa ${payload.plateId}.`,
      metadata: { reservationId: String(reservation._id), startDate: start, endDate: end },
      createdBy: payload.createdBy,
    });

    return reservation.toObject() as ITemporalReservation;
  }

  async cancelTemporalReservation(
    sourceType: TemporalSourceType,
    sourceId: string,
    empresaId?: string,
    createdBy?: string,
  ): Promise<{ cancelledCount: number }> {
    const filter: Record<string, unknown> = {
      sourceType,
      sourceId,
      status: { $in: TEMPORAL_BLOCKING_STATUSES },
    };
    if (empresaId) filter.empresaId = toObjectId(empresaId);

    const reservations = await TemporalReservation.find(filter).lean<ITemporalReservation[]>();
    const result = await TemporalReservation.updateMany(filter, { $set: { status: 'CANCELLED' } });

    await Promise.all(reservations.map((reservation) => this.recordEvent({
      empresaId: String(reservation.empresaId),
      plateId: String(reservation.plateId),
      sourceType,
      sourceId,
      eventType: 'TEMPORAL_RESERVATION_CANCELLED',
      message: `Reserva temporal cancelada para ${sourceType} ${sourceId}.`,
      metadata: { reservationId: String(reservation._id) },
      createdBy,
    })));

    return { cancelledCount: result.modifiedCount ?? 0 };
  }

  async replaceSourceReservations(input: {
    empresaId: string;
    sourceType: TemporalSourceType;
    sourceId: string;
    plateIds: string[];
    customerId?: string;
    startDate: DateLike;
    endDate: DateLike;
    status?: TemporalReservationStatus;
    reason?: string;
    createdBy?: string;
  }): Promise<ITemporalReservation[]> {
    await this.cancelTemporalReservation(input.sourceType, input.sourceId, input.empresaId, input.createdBy);
    return Promise.all(input.plateIds.map((plateId) => this.createTemporalReservation({
      empresaId: input.empresaId,
      plateId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      customerId: input.customerId,
      startDate: input.startDate,
      endDate: input.endDate,
      status: input.status,
      reason: input.reason,
      createdBy: input.createdBy,
      allowSameSource: true,
    })));
  }

  async promotePiReservationToContract(piId: string, contractId: string, empresaId?: string): Promise<{ promotedCount: number }> {
    const piQuery: Record<string, unknown> = { _id: piId };
    if (empresaId) piQuery.empresaId = empresaId;

    const pi = await PropostaInterna.findOne(piQuery).lean<any>();
    if (!pi) throw new AppError('PI nao encontrada para promocao temporal.', 404);

    const { startDate, endDate } = extractPeriod(pi);
    const plateIds = (pi.placas || []).map((plateId: unknown) => String(plateId));

    await this.assertMultiplePlatesAvailable(plateIds, startDate, endDate, {
      empresaId: String(pi.empresaId),
      sourceType: 'PI',
      sourceId: piId,
    });

    await this.cancelTemporalReservation('PI', piId, String(pi.empresaId));

    const reservations = await Promise.all(plateIds.map((plateId: string) => this.createTemporalReservation({
      empresaId: String(pi.empresaId),
      plateId,
      sourceType: 'CONTRACT',
      sourceId: contractId,
      customerId: String(pi.clienteId),
      startDate,
      endDate,
      status: 'ACTIVE',
      reason: `Contrato gerado a partir da PI ${piId}`,
      allowSameSource: true,
    })));

    await Promise.all(reservations.map((reservation) => this.recordEvent({
      empresaId: String(reservation.empresaId),
      plateId: String(reservation.plateId),
      sourceType: 'CONTRACT',
      sourceId: contractId,
      eventType: 'TEMPORAL_CONTRACT_ACTIVATED',
      message: `Contrato ${contractId} ativou reserva temporal da placa.`,
      metadata: { piId },
    })));

    return { promotedCount: reservations.length };
  }

  async syncContractStatus(contractId: string, status: string, empresaId: string): Promise<void> {
    if (status === 'cancelado' || status === 'concluido') {
      await this.cancelTemporalReservation('CONTRACT', contractId, empresaId);
      return;
    }

    if (status === 'ativo') {
      const contract = await Contrato.findOne({ _id: contractId, empresaId }).lean<any>();
      if (contract?.piId) {
        await this.promotePiReservationToContract(String(contract.piId), contractId, empresaId);
      }
    }
  }

  async resolvePlateTemporalStatus(plateId: string, now: Date = new Date(), empresaId?: string): Promise<PlateTemporalStatus> {
    const plateQuery: Record<string, unknown> = { _id: plateId };
    if (empresaId) plateQuery.empresaId = empresaId;
    const plate = await Placa.findOne(plateQuery).lean<any>();
    if (!plate) throw new AppError('Placa nao encontrada.', 404);

    if (plate.disponivel === false || plate.ativa === false) {
      return 'MAINTENANCE';
    }

    const reservationQuery: Record<string, unknown> = {
      plateId: toObjectId(plateId),
      status: { $in: TEMPORAL_BLOCKING_STATUSES },
    };
    if (empresaId) reservationQuery.empresaId = toObjectId(empresaId);

    const reservations = await TemporalReservation.find(reservationQuery)
      .sort({ startDate: 1 })
      .lean<ITemporalReservation[]>();

    const active = reservations.find((reservation) => isActiveNow(reservation, now));
    if (active?.sourceType === 'MANUAL_BLOCK' || active?.status === 'BLOCKED') return 'BLOCKED';
    if (active?.sourceType === 'CONTRACT') return 'CONTRACTED_ACTIVE';
    if (active?.sourceType === 'OPERATION' && /install/i.test(active.reason ?? '')) return 'INSTALLATION_PENDING';
    if (active?.sourceType === 'OPERATION' && /rasp/i.test(active.reason ?? '')) return 'SCRAPING_PENDING';
    if (active) return 'RESERVED_FUTURE';

    const future = reservations.find((reservation) => isBlockingStatus(reservation.status) && reservation.startDate > now);
    if (future?.sourceType === 'MANUAL_BLOCK' || future?.status === 'BLOCKED') return 'BLOCKED';
    if (future) return 'RESERVED_FUTURE';

    const expiredBlocking = reservations.find((reservation) => isBlockingStatus(reservation.status) && reservation.endDate < now);
    if (expiredBlocking) return 'EXPIRED_PENDING_RELEASE';

    return 'AVAILABLE';
  }

  async assertPlateCanBeEdited(
    plateId: string,
    changedFields: string[] | Record<string, unknown>,
    options: { empresaId?: string; override?: boolean; createdBy?: string } = {},
  ): Promise<void> {
    const fields = normalizeChangedFields(changedFields);
    const criticalFields = fields.filter((field) => TEMPORAL_CRITICAL_PLATE_FIELDS.includes(field));
    if (criticalFields.length === 0 || options.override) return;

    const now = new Date();
    const query: Record<string, unknown> = {
      plateId: toObjectId(plateId),
      sourceType: 'CONTRACT',
      status: { $in: TEMPORAL_BLOCKING_STATUSES },
      startDate: { $lte: now },
      endDate: { $gte: now },
    };
    if (options.empresaId) query.empresaId = toObjectId(options.empresaId);

    const activeContract = await TemporalReservation.findOne(query).lean<ITemporalReservation>();
    if (!activeContract) return;

    await this.recordEvent({
      empresaId: String(activeContract.empresaId),
      plateId,
      sourceType: 'CONTRACT',
      sourceId: activeContract.sourceId,
      eventType: 'TEMPORAL_CRITICAL_UPDATE_BLOCKED',
      message: 'Alteracao critica bloqueada por contrato temporal ativo.',
      metadata: { criticalFields },
      createdBy: options.createdBy,
    });

    throw new AppError(
      `Placa possui contrato ativo; campos criticos bloqueados: ${criticalFields.join(', ')}.`,
      409,
    );
  }

  async getPlateTimeline(plateId: string, empresaId?: string) {
    const query: Record<string, unknown> = { plateId: toObjectId(plateId) };
    if (empresaId) query.empresaId = toObjectId(empresaId);
    const [reservations, events] = await Promise.all([
      TemporalReservation.find(query).sort({ startDate: -1 }).lean(),
      TemporalEvent.find(query).sort({ createdAt: -1 }).lean(),
    ]);
    return { reservations, events };
  }

  async getTemporalDashboardSummary(empresaId: string, now: Date = new Date()) {
    const empresaObjectId = toObjectId(empresaId);
    const endingSoonDate = new Date(now);
    endingSoonDate.setDate(endingSoonDate.getDate() + 7);
    const legacyExpiringDate = new Date(now);
    legacyExpiringDate.setDate(legacyExpiringDate.getDate() + 30);

    const [plates, reservations, conflictsCount] = await Promise.all([
      Placa.find({ empresaId: empresaObjectId }).lean<any[]>(),
      TemporalReservation.find({
        empresaId: empresaObjectId,
      }).lean<ITemporalReservation[]>(),
      TemporalEvent.countDocuments({
        empresaId: empresaObjectId,
        eventType: { $in: ['TEMPORAL_RESERVATION_CONFLICT', 'TEMPORAL_BACKFILL_CONFLICT'] },
      }),
    ]);

    const totalPlates = plates.length;
    const plateMap = new Map(plates.map((plate) => [String(plate._id), plate]));
    const formalRegionIds = [
      ...new Set(
        plates
          .map((plate) => plate.regionId || plate.regiaoId)
          .filter((value) => value && Types.ObjectId.isValid(String(value)))
          .map((value) => String(value)),
      ),
    ];
    const formalRegions = formalRegionIds.length
      ? await Region.find({ _id: { $in: formalRegionIds.map((id) => new Types.ObjectId(id)) }, empresaId: empresaObjectId }).lean<any[]>()
      : [];
    const regionNames = new Map(formalRegions.map((region) => [
      String(region._id),
      String(region.name || region.nome || region.code || region.codigo || region._id),
    ]));
    const activeBlocking = reservations.filter((r) => TEMPORAL_BLOCKING_STATUSES.includes(r.status) && r.startDate <= now && r.endDate >= now);
    const futureBlocking = reservations.filter((r) => TEMPORAL_BLOCKING_STATUSES.includes(r.status) && r.startDate > now);
    const blocked = activeBlocking.filter((r) => r.status === 'BLOCKED' || r.sourceType === 'MANUAL_BLOCK');
    const contracted = activeBlocking.filter((r) => r.sourceType === 'CONTRACT');
    const reserved = reservations.filter((r) => r.status === 'RESERVED' && r.sourceType !== 'CONTRACT');
    const contractsEndingSoon = reservations.filter((r) => (
      r.sourceType === 'CONTRACT'
      && r.status === 'ACTIVE'
      && r.endDate >= now
      && r.endDate <= endingSoonDate
    ));
    const contractsExpiring = reservations.filter((r) => (
      r.sourceType === 'CONTRACT'
      && r.status === 'ACTIVE'
      && r.endDate >= now
      && r.endDate <= legacyExpiringDate
    ));
    const expiredPendingRelease = reservations.filter((r) => r.status === 'EXPIRED' && r.endDate < now);

    const occupiedPlateIds = new Set(activeBlocking.map((r) => String(r.plateId)));
    const blockedPlateIds = new Set(blocked.map((r) => String(r.plateId)));
    const contractedPlateIds = new Set(contracted.map((r) => String(r.plateId)));
    const reservedPlateIds = new Set(reserved.map((r) => String(r.plateId)));

    const sourceValues = await this.resolveReservationValues(reservations);
    const activeRevenue = activeBlocking.reduce((sum, reservation) => sum + (sourceValues.get(String(reservation._id)) ?? 0), 0);
    const futureRevenue = futureBlocking.reduce((sum, reservation) => sum + (sourceValues.get(String(reservation._id)) ?? 0), 0);

    const regions = new Map<string, {
      regionId: string;
      name: string;
      total: number;
      occupied: number;
      available: number;
      blocked: number;
      reserved: number;
      contracted: number;
      occupancyRate: number;
    }>();
    const revenueRegions = new Map<string, { regionId: string; name: string; activeRevenue: number; futureRevenue: number }>();

    plates.forEach((plate) => {
      const region = regionKeyFromPlate(plate, regionNames);
      const row = regions.get(region.regionId) ?? {
        regionId: region.regionId,
        name: region.name,
        total: 0,
        occupied: 0,
        available: 0,
        blocked: 0,
        reserved: 0,
        contracted: 0,
        occupancyRate: 0,
      };
      row.total += 1;
      regions.set(region.regionId, row);
      revenueRegions.set(region.regionId, revenueRegions.get(region.regionId) ?? {
        regionId: region.regionId,
        name: region.name,
        activeRevenue: 0,
        futureRevenue: 0,
      });
    });

    activeBlocking.forEach((reservation) => {
      const plate = plateMap.get(String(reservation.plateId));
      const region = regionKeyFromPlate(plate, regionNames);
      const row = regions.get(region.regionId);
      if (!row) return;
      row.occupied += 1;
      if (reservation.status === 'BLOCKED' || reservation.sourceType === 'MANUAL_BLOCK') row.blocked += 1;
      if (reservation.sourceType === 'CONTRACT') row.contracted += 1;
      if (reservation.status === 'RESERVED') row.reserved += 1;
      const revenue = revenueRegions.get(region.regionId);
      if (revenue) revenue.activeRevenue += sourceValues.get(String(reservation._id)) ?? 0;
    });

    futureBlocking.forEach((reservation) => {
      const plate = plateMap.get(String(reservation.plateId));
      const region = regionKeyFromPlate(plate, regionNames);
      const revenue = revenueRegions.get(region.regionId);
      if (revenue) revenue.futureRevenue += sourceValues.get(String(reservation._id)) ?? 0;
    });

    const occupancyByRegion = [...regions.values()].map((row) => ({
      ...row,
      available: Math.max(0, row.total - row.occupied),
      occupancyRate: rate(row.occupied, row.total),
    }));
    const platesByRegion = occupancyByRegion.map((row) => ({ regionId: row.regionId, name: row.name, totalPlates: row.total }));
    const availableByRegion = occupancyByRegion.map((row) => ({ regionId: row.regionId, name: row.name, availablePlates: row.available }));
    const contractedByRegion = occupancyByRegion.map((row) => ({ regionId: row.regionId, name: row.name, contractedPlates: row.contracted }));
    const blockedByRegion = occupancyByRegion.map((row) => ({ regionId: row.regionId, name: row.name, blockedPlates: row.blocked }));

    const integrityCounts = await this.getTemporalIntegrityCounts(empresaId, reservations, plates, now);

    return {
      totalPlates,
      availablePlates: Math.max(0, totalPlates - occupiedPlateIds.size),
      reservedPlates: reservedPlateIds.size,
      contractedPlates: contractedPlateIds.size,
      blockedPlates: blockedPlateIds.size,
      contractsExpiring: contractsExpiring.length,
      contractsEndingSoon: contractsEndingSoon.length,
      activeRevenue,
      futureRevenue,
      occupancyRate: rate(occupiedPlateIds.size, totalPlates),
      occupancyByRegion,
      revenueByRegion: [...revenueRegions.values()],
      platesByRegion,
      availableByRegion,
      contractedByRegion,
      blockedByRegion,
      futureOccupancy: futureBlocking.length,
      conflictsDetected: conflictsCount,
      conflictsCount,
      orphanReservationsCount: integrityCounts.orphanReservationsCount,
      integrityIssuesCount: integrityCounts.integrityIssuesCount,
      expiredPendingRelease: expiredPendingRelease.length,
      generatedAt: now.toISOString(),
    };
  }

  private async resolveReservationValues(reservations: ITemporalReservation[]): Promise<Map<string, number>> {
    const values = new Map<string, number>();
    const contractIds = onlyObjectIds(reservations.filter((r) => r.sourceType === 'CONTRACT').map((r) => r.sourceId));
    const piIds = onlyObjectIds(reservations.filter((r) => r.sourceType === 'PI').map((r) => r.sourceId));
    const rentalIds = onlyObjectIds(reservations.filter((r) => r.sourceType === 'LEGACY_RENTAL').map((r) => r.sourceId));

    const [contracts, pis, rentals] = await Promise.all([
      contractIds.length > 0 ? Contrato.find({ _id: { $in: contractIds } }).populate('piId', 'valorTotal').lean<any[]>() : [],
      piIds.length > 0 ? PropostaInterna.find({ _id: { $in: piIds } }).select('valorTotal').lean<any[]>() : [],
      rentalIds.length > 0 ? Aluguel.find({ _id: { $in: rentalIds } }).lean<any[]>() : [],
    ]);

    const contractValueById = new Map(contracts.map((contract) => [
      String(contract._id),
      toMoney((contract.piId && typeof contract.piId === 'object' ? contract.piId.valorTotal : undefined) ?? (contract as any).valorTotal),
    ]));
    const piValueById = new Map(pis.map((pi) => [String(pi._id), toMoney(pi.valorTotal)]));
    const rentalValueById = new Map(rentals.map((rental) => [
      String(rental._id),
      toMoney(rental.valorTotal ?? rental.valor_mensal ?? rental.valor ?? rental.total),
    ]));

    reservations.forEach((reservation) => {
      if (reservation.sourceType === 'CONTRACT') values.set(String(reservation._id), contractValueById.get(reservation.sourceId) ?? 0);
      if (reservation.sourceType === 'PI') values.set(String(reservation._id), piValueById.get(reservation.sourceId) ?? 0);
      if (reservation.sourceType === 'LEGACY_RENTAL') values.set(String(reservation._id), rentalValueById.get(reservation.sourceId) ?? 0);
    });

    return values;
  }

  private async getTemporalIntegrityCounts(empresaId: string, reservations: ITemporalReservation[], plates: any[], now: Date) {
    const empresaObjectId = toObjectId(empresaId);
    let orphanReservationsCount = 0;

    for (const reservation of reservations) {
      if (reservation.sourceType === 'CONTRACT') {
        const exists = Types.ObjectId.isValid(reservation.sourceId)
          ? await Contrato.exists({ _id: reservation.sourceId, empresaId: empresaObjectId })
          : null;
        if (!exists) orphanReservationsCount += 1;
      }
      if (reservation.sourceType === 'PI') {
        const exists = Types.ObjectId.isValid(reservation.sourceId)
          ? await PropostaInterna.exists({ _id: reservation.sourceId, empresaId: empresaObjectId })
          : null;
        if (!exists) orphanReservationsCount += 1;
      }
    }

    const activeByPlate = new Set(
      reservations
        .filter((reservation) => TEMPORAL_BLOCKING_STATUSES.includes(reservation.status) && reservation.startDate <= now && reservation.endDate >= now)
        .map((reservation) => String(reservation.plateId)),
    );

    const blockedWithoutReservation = plates.filter((plate) => plate.disponivel === false && !activeByPlate.has(String(plate._id))).length;
    const activeExpired = reservations.filter((reservation) => ['RESERVED', 'ACTIVE'].includes(reservation.status) && reservation.endDate < now).length;
    const invalidDates = reservations.filter((reservation) => !reservation.startDate || !reservation.endDate || reservation.startDate >= reservation.endDate).length;
    const overlapCount = this.countLedgerOverlaps(reservations);

    return {
      orphanReservationsCount,
      integrityIssuesCount: orphanReservationsCount + blockedWithoutReservation + activeExpired + invalidDates + overlapCount,
    };
  }

  private countLedgerOverlaps(reservations: ITemporalReservation[]): number {
    const blocking = reservations.filter((reservation) => TEMPORAL_BLOCKING_STATUSES.includes(reservation.status));
    let count = 0;
    for (let i = 0; i < blocking.length; i += 1) {
      for (let j = i + 1; j < blocking.length; j += 1) {
        const a = blocking[i];
        const b = blocking[j];
        if (!a || !b) continue;
        if (String(a.plateId) !== String(b.plateId)) continue;
        if (a.startDate < b.endDate && a.endDate > b.startDate) count += 1;
      }
    }
    return count;
  }

  async getConflicts(empresaId: string) {
    const events = await TemporalEvent.find({
      empresaId: toObjectId(empresaId),
      eventType: 'TEMPORAL_RESERVATION_CONFLICT',
    }).sort({ createdAt: -1 }).limit(100).lean();
    return { conflicts: events };
  }

  async expirePastReservations(now: Date = new Date()): Promise<{ expiredCount: number }> {
    const reservations = await TemporalReservation.find({
      status: { $in: ['RESERVED', 'ACTIVE'] },
      endDate: { $lt: now },
    }).lean<ITemporalReservation[]>();

    const result = await TemporalReservation.updateMany(
      { _id: { $in: reservations.map((r) => r._id) } },
      { $set: { status: 'EXPIRED' } },
    );

    await Promise.all(reservations.map((reservation) => this.recordEvent({
      empresaId: String(reservation.empresaId),
      plateId: String(reservation.plateId),
      sourceType: reservation.sourceType,
      sourceId: reservation.sourceId,
      eventType: reservation.sourceType === 'CONTRACT'
        ? 'TEMPORAL_CONTRACT_EXPIRED'
        : 'TEMPORAL_PLATE_RELEASED',
      message: 'Reserva temporal expirada.',
      metadata: { reservationId: String(reservation._id) },
    })));

    return { expiredCount: result.modifiedCount ?? 0 };
  }
}

export const temporalEngine = new TemporalEngineService();
export default TemporalEngineService;
