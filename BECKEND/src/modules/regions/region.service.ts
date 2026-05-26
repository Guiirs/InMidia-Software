import { Types } from 'mongoose';
import AppError from '@shared/container/AppError';
import Placa from '@modules/placas/Placa';
import TemporalReservation from '@modules/temporal/TemporalReservation';
import TemporalEvent from '@modules/temporal/TemporalEvent';
import { TEMPORAL_BLOCKING_STATUSES } from '@modules/temporal/temporal.types';
import { temporalEngine } from '@modules/temporal';
import { OperationRecord, resolveOperationPlateId, resolveOperationSla } from '@modules/operations/services/operations-v4.service';
import { AlertRecord } from '@modules/alerts/services/alerts-v4.service';
import Region from './Region';

type RegionStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

type RegionPayload = {
  empresaId: string;
  name?: string;
  code?: string;
  city?: string;
  state?: string;
  centerLatitude?: number;
  centerLongitude?: number;
  color?: string;
  ownerName?: string;
  status?: RegionStatus;
  notes?: string;
  description?: string;
  polygon?: unknown;
  metadata?: Record<string, unknown>;
  operationalPriority?: number;
  sortOrder?: number;
  createdBy?: string;
  updatedBy?: string;
  nome?: string;
  codigo?: string;
  descricao?: string;
};

const DONE_OPERATION_STATUSES = ['completed', 'complete', 'done', 'resolved', 'cancelled', 'canceled'];
const PRIORITY_WEIGHT: Record<string, number> = {
  critical: 0,
  urgent: 0,
  high: 1,
  medium: 2,
  normal: 2,
  low: 3,
};

function normalizeOperationType(value: unknown): string {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw.includes('instal')) return 'INSTALLATION';
  if (raw.includes('rasp') || raw.includes('scrap')) return 'SCRAPING';
  if (raw.includes('manut') || raw.includes('maint')) return 'MAINTENANCE';
  if (raw.includes('bloq') || raw.includes('block')) return 'BLOCK';
  return raw ? 'OTHER' : 'OTHER';
}

function normalizeOperationStatus(value: unknown): string {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'scheduled' || raw === 'reserved') return 'SCHEDULED';
  if (raw === 'in_progress' || raw === 'progress' || raw === 'running') return 'IN_PROGRESS';
  if (DONE_OPERATION_STATUSES.includes(raw)) return raw === 'cancelled' || raw === 'canceled' ? 'CANCELLED' : 'DONE';
  return 'PENDING';
}

function normalizeOperationPriority(value: unknown): string {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'critical' || raw === 'urgent') return 'CRITICAL';
  if (raw === 'high') return 'HIGH';
  if (raw === 'medium' || raw === 'normal') return 'MEDIUM';
  return 'LOW';
}

function priorityRank(value: unknown): number {
  return PRIORITY_WEIGHT[String(value ?? '').trim().toLowerCase()] ?? 4;
}

function dateOrNull(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function isoOrNull(value: unknown): string | null {
  const date = dateOrNull(value);
  return date ? date.toISOString() : null;
}

function average(numbers: number[]) {
  if (!numbers.length) return null;
  return Math.round(numbers.reduce((sum, value) => sum + value, 0) / numbers.length);
}

function getPlateCode(plate: any): string | null {
  return plate?.numero_placa ?? plate?.numeroPlaca ?? plate?.codigo ?? plate?.code ?? null;
}

function getPlateAddress(plate: any): string | null {
  return plate?.localizacao ?? plate?.endereco ?? plate?.address ?? plate?.nomeDaRua ?? null;
}

function toObjectId(value: string, field = 'id'): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) throw new AppError(`${field} invalido.`, 400);
  return new Types.ObjectId(value);
}

function normalizeCode(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, '-');
}

function normalizeRegionPayload(payload: RegionPayload, partial = false) {
  const name = payload.name ?? payload.nome;
  if (!partial && (!name || !name.trim())) throw new AppError('name e obrigatorio.', 400);

  const code = payload.code ?? payload.codigo ?? name;
  const status = payload.status ?? 'ACTIVE';
  const normalized: Record<string, unknown> = {
    ...payload,
    name: name?.trim(),
    nome: name?.trim(),
    code: code ? normalizeCode(code) : undefined,
    codigo: code ? normalizeCode(code) : undefined,
    description: payload.description ?? payload.descricao,
    descricao: payload.descricao ?? payload.description,
    status,
    ativo: status === 'ACTIVE',
  };

  Object.keys(normalized).forEach((key) => normalized[key] === undefined && delete normalized[key]);
  return normalized;
}

function serializeRegion(region: any) {
  if (!region) return null;
  return {
    ...region,
    id: String(region._id),
    name: region.name ?? region.nome,
    code: region.code ?? region.codigo,
    description: region.description ?? region.descricao,
    status: region.status ?? (region.ativo === false ? 'INACTIVE' : 'ACTIVE'),
  };
}

export class RegionService {
  async createRegion(payload: RegionPayload) {
    const empresaId = toObjectId(payload.empresaId, 'empresaId');
    const data = normalizeRegionPayload(payload);

    const existing = await Region.findOne({
      empresaId,
      code: data.code,
    }).lean();
    if (existing) throw new AppError('Ja existe uma regiao com este code nesta empresa.', 409);

    const region = await Region.create({
      ...data,
      empresaId,
      createdBy: payload.createdBy ? toObjectId(payload.createdBy, 'createdBy') : undefined,
      updatedBy: payload.updatedBy ? toObjectId(payload.updatedBy, 'updatedBy') : undefined,
    });

    return serializeRegion(region.toObject());
  }

  async updateRegion(regionId: string, payload: Partial<RegionPayload> & { empresaId: string }) {
    const empresaId = toObjectId(payload.empresaId, 'empresaId');
    const _id = toObjectId(regionId, 'regionId');
    const data = normalizeRegionPayload(payload as RegionPayload, true);

    if (data.code) {
      const duplicate = await Region.findOne({ _id: { $ne: _id }, empresaId, code: data.code }).lean();
      if (duplicate) throw new AppError('Ja existe uma regiao com este code nesta empresa.', 409);
    }

    const region = await Region.findOneAndUpdate(
      { _id, empresaId },
      { $set: { ...data, updatedBy: payload.updatedBy ? toObjectId(payload.updatedBy, 'updatedBy') : undefined } },
      { new: true, runValidators: true },
    ).lean();

    if (!region) throw new AppError('Regiao nao encontrada.', 404);
    return serializeRegion(region);
  }

  async archiveRegion(regionId: string, empresaId: string, updatedBy?: string) {
    return this.updateRegion(regionId, { empresaId, status: 'ARCHIVED', updatedBy });
  }

  async getRegionById(regionId: string, empresaId: string) {
    const region = await Region.findOne({ _id: toObjectId(regionId, 'regionId'), empresaId: toObjectId(empresaId, 'empresaId') }).lean();
    if (!region) throw new AppError('Regiao nao encontrada.', 404);
    return serializeRegion(region);
  }

  async listRegions(filters: { empresaId: string; status?: RegionStatus; search?: string }) {
    const query: Record<string, unknown> = { empresaId: toObjectId(filters.empresaId, 'empresaId') };
    if (filters.status) query.status = filters.status;
    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: 'i' } },
        { nome: { $regex: filters.search, $options: 'i' } },
        { code: { $regex: filters.search, $options: 'i' } },
      ];
    }
    const regions = await Region.find(query).sort({ sortOrder: 1, name: 1, nome: 1 }).lean();
    return regions.map(serializeRegion);
  }

  async getRegionPlates(regionId: string, empresaId: string) {
    const _id = toObjectId(regionId, 'regionId');
    const tenant = toObjectId(empresaId, 'empresaId');
    await this.getRegionById(regionId, empresaId);
    return Placa.find({ empresaId: tenant, $or: [{ regionId: _id }, { regiaoId: _id }] }).lean();
  }

  async getRegionSummary(regionId: string, empresaId: string, now = new Date()) {
    const plates = await this.getRegionPlates(regionId, empresaId);
    const plateIds = plates.map((plate) => String(plate._id));
    const reservations = plateIds.length
      ? await TemporalReservation.find({ empresaId: toObjectId(empresaId, 'empresaId'), plateId: { $in: plateIds.map((id) => toObjectId(id, 'plateId')) } }).lean()
      : [];

    const activeBlocking = reservations.filter((r) => TEMPORAL_BLOCKING_STATUSES.includes(r.status as any) && r.startDate <= now && r.endDate >= now);
    const reserved = activeBlocking.filter((r) => r.status === 'RESERVED');
    const contracted = activeBlocking.filter((r) => r.sourceType === 'CONTRACT');
    const blocked = activeBlocking.filter((r) => r.status === 'BLOCKED' || r.sourceType === 'MANUAL_BLOCK');
    const occupiedPlateIds = new Set(activeBlocking.map((r) => String(r.plateId)));

    const temporalSummary = await temporalEngine.getTemporalDashboardSummary(empresaId, now);
    const regionRevenue = temporalSummary.revenueByRegion?.find((row: any) => row.regionId === regionId);
    const [operationsData, alertsData] = await Promise.all([
      this.getRegionOperations(regionId, empresaId, now),
      this.getRegionAlerts(regionId, empresaId),
    ]);
    const endingWindow = new Date(now);
    endingWindow.setDate(endingWindow.getDate() + 30);
    const endingContracts = reservations.filter((r) => (
      r.sourceType === 'CONTRACT'
      && r.status !== 'CANCELLED'
      && r.endDate >= now
      && r.endDate <= endingWindow
    ));
    const expiredPendingRelease = reservations.filter((r) => (
      r.status === 'EXPIRED'
      || (r.endDate < now && r.status !== 'CANCELLED' && r.status !== 'BLOCKED')
    ));
    const pendingInstallations = operationsData.items.filter((item) => item.type === 'INSTALLATION' && item.status !== 'DONE' && item.status !== 'CANCELLED').length;
    const pendingScrapings = operationsData.items.filter((item) => item.type === 'SCRAPING' && item.status !== 'DONE' && item.status !== 'CANCELLED').length;
    const pendingMaintenances = operationsData.items.filter((item) => item.type === 'MAINTENANCE' && item.status !== 'DONE' && item.status !== 'CANCELLED').length;
    const averageResolutionMinutes = average(operationsData.items
      .map((item) => item.resolutionMinutes)
      .filter((value): value is number => typeof value === 'number'));
    const lastOperationAt = operationsData.items
      .map((item) => dateOrNull(item.completedAt ?? item.updatedAt ?? item.createdAt))
      .filter((date): date is Date => !!date)
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

    return {
      regionId,
      totalPlates: plates.length,
      availablePlates: plates.length - occupiedPlateIds.size,
      reservedPlates: new Set(reserved.map((r) => String(r.plateId))).size,
      contractedPlates: new Set(contracted.map((r) => String(r.plateId))).size,
      blockedPlates: new Set(blocked.map((r) => String(r.plateId))).size,
      activeRevenue: regionRevenue?.activeRevenue ?? 0,
      futureRevenue: regionRevenue?.futureRevenue ?? 0,
      occupancyRate: plates.length ? Number(((occupiedPlateIds.size / plates.length) * 100).toFixed(2)) : 0,
      activeContracts: new Set(contracted.map((r) => r.sourceId)).size,
      pendingInstallations,
      pendingScrapings,
      pendingMaintenances,
      endingContracts: new Set(endingContracts.map((r) => r.sourceId)).size,
      expiredPendingRelease: new Set(expiredPendingRelease.map((r) => String(r.plateId))).size,
      pendingOperations: operationsData.summary.pending,
      overdueOperations: operationsData.summary.overdue,
      dueSoonOperations: operationsData.summary.dueSoon,
      slaHealth: operationsData.summary.slaHealth,
      criticalBacklog: operationsData.summary.criticalBacklog,
      averageResolutionMinutes,
      nextSlaDueAt: operationsData.summary.nextSlaDueAt,
      alertsCount: alertsData.summary.total,
      criticalAlertsCount: alertsData.summary.critical,
      operationalBacklog: operationsData.summary.pending + alertsData.summary.critical + new Set(expiredPendingRelease.map((r) => String(r.plateId))).size,
      nextDueOperation: operationsData.items[0] ?? null,
      lastOperationAt: lastOperationAt?.toISOString?.() ?? null,
      lastUpdatedAt: new Date().toISOString(),
    };
  }

  async getRegionOperations(regionId: string, empresaId: string, now = new Date()) {
    const plates = await this.getRegionPlates(regionId, empresaId);
    const plateIds = plates.map((plate) => String(plate._id));
    const plateIdSet = new Set(plateIds);
    const plateById = new Map(plates.map((plate: any) => [String(plate._id), plate]));
    if (plateIds.length === 0) {
      return { items: [], summary: { total: 0, pending: 0, critical: 0, overdue: 0, dueSoon: 0, criticalBacklog: 0, slaHealth: 'HEALTHY', nextSlaDueAt: null } };
    }

    const operations = await OperationRecord.find({
      empresaId,
      kind: 'task',
      $or: [
        { 'payload.plateId': { $in: plateIds } },
        { 'payload.placaId': { $in: plateIds } },
        { 'payload.boardId': { $in: plateIds } },
        { 'payload.placa_id': { $in: plateIds } },
        { 'payload.board_id': { $in: plateIds } },
      ],
    }).lean<any[]>();

    const items = operations
      .map((operation) => {
        const payload = operation.payload ?? {};
        const plateId = resolveOperationPlateId(operation);
        if (!plateId || !plateIdSet.has(plateId)) return null;
        const plate = plateById.get(plateId);
        const dueAt = operation.dueDate ?? payload.dueAt ?? payload.dueDate ?? payload.scheduledAt;
        const scheduledAt = payload.scheduledAt ?? payload.startDate ?? operation.dueDate;
        const normalizedStatus = normalizeOperationStatus(operation.status);
        const normalizedPriority = normalizeOperationPriority(operation.priority ?? payload.priority);
        const sla = resolveOperationSla(operation, { now });

        return {
          id: String(operation._id),
          type: normalizeOperationType(operation.type ?? payload.type ?? operation.title ?? operation.domain),
          status: normalizedStatus,
          priority: normalizedPriority,
          slaStatus: sla.slaStatus,
          slaPriority: sla.slaPriority,
          isOverdue: sla.isOverdue,
          overdueMinutes: sla.overdueMinutes,
          resolutionMinutes: sla.resolutionMinutes,
          referenceDueAt: sla.referenceDueAt,
          dueSoon: sla.dueSoon,
          plateId,
          plateNumber: getPlateCode(plate),
          address: getPlateAddress(plate),
          scheduledAt: isoOrNull(scheduledAt),
          dueAt: isoOrNull(dueAt),
          assignedTo: operation.assigneeId ?? payload.assignedTo ?? payload.owner ?? null,
          notes: payload.notes ?? payload.description ?? operation.title ?? null,
          overdue: sla.isOverdue,
          createdAt: isoOrNull(operation.createdAt),
          updatedAt: isoOrNull(operation.updatedAt),
          completedAt: isoOrNull(operation.completedAt),
        };
      })
      .filter((item): item is NonNullable<typeof item> => !!item)
      .sort((a, b) => {
        const priority = priorityRank(a.priority) - priorityRank(b.priority);
        if (priority !== 0) return priority;
        const aDue = dateOrNull(a.dueAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const bDue = dateOrNull(b.dueAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return aDue - bDue;
      });

    return {
      items,
      summary: {
        total: items.length,
        pending: items.filter((item) => item.status !== 'DONE' && item.status !== 'CANCELLED').length,
        critical: items.filter((item) => item.priority === 'CRITICAL' || item.slaPriority === 'CRITICAL').length,
        overdue: items.filter((item) => item.isOverdue).length,
        dueSoon: items.filter((item) => item.slaStatus === 'DUE_SOON').length,
        criticalBacklog: items.filter((item) => item.slaPriority === 'CRITICAL' && item.slaStatus !== 'RESOLVED' && item.slaStatus !== 'CANCELLED').length,
        slaHealth: items.some((item) => item.slaStatus === 'OVERDUE' || item.slaPriority === 'CRITICAL')
          ? 'CRITICAL'
          : items.some((item) => item.slaStatus === 'DUE_SOON' || item.slaPriority === 'HIGH')
            ? 'ATTENTION'
            : 'HEALTHY',
        nextSlaDueAt: items
          .map((item) => dateOrNull(item.referenceDueAt ?? item.dueAt))
          .filter((date): date is Date => !!date && date >= now)
          .sort((a, b) => a.getTime() - b.getTime())[0]?.toISOString?.() ?? null,
      },
    };
  }

  async getRegionAlerts(regionId: string, empresaId: string) {
    const plates = await this.getRegionPlates(regionId, empresaId);
    const plateIds = plates.map((plate) => String(plate._id));
    if (plateIds.length === 0) {
      return { items: [], summary: { total: 0, critical: 0, warning: 0, temporal: 0 } };
    }

    const [alerts, events] = await Promise.all([
      AlertRecord.find({
        empresaId,
        status: { $nin: ['resolved', 'dismissed'] },
        $or: [
          { 'payload.plateId': { $in: plateIds } },
          { 'payload.placaId': { $in: plateIds } },
          { 'payload.boardId': { $in: plateIds } },
          { 'payload.placa_id': { $in: plateIds } },
          { 'payload.board_id': { $in: plateIds } },
          { 'payload.regionId': regionId },
          { 'payload.regiaoId': regionId },
        ],
      }).sort({ createdAt: -1 }).lean<any[]>(),
      TemporalEvent.find({
        empresaId: toObjectId(empresaId, 'empresaId'),
        plateId: { $in: plateIds.map((id) => toObjectId(id, 'plateId')) },
        eventType: {
          $in: [
            'TEMPORAL_CONTRACT_ENDING_SOON',
            'TEMPORAL_EXPIRED_PENDING_RELEASE',
            'TEMPORAL_RESERVATION_CONFLICT',
            'TEMPORAL_BACKFILL_CONFLICT',
            'TEMPORAL_INTEGRITY_ISSUE_DETECTED',
          ],
        },
      }).sort({ createdAt: -1 }).lean<any[]>(),
    ]);

    const alertItems = alerts.map((alert) => ({
      id: String(alert._id),
      type: alert.type,
      severity: String(alert.severity ?? 'info').toUpperCase(),
      message: alert.message,
      source: 'ALERT_V4',
      createdAt: isoOrNull(alert.createdAt),
      payload: alert.payload ?? {},
    }));
    const temporalItems = events.map((event) => ({
      id: String(event._id),
      type: event.eventType,
      severity: ['TEMPORAL_RESERVATION_CONFLICT', 'TEMPORAL_BACKFILL_CONFLICT', 'TEMPORAL_INTEGRITY_ISSUE_DETECTED'].includes(event.eventType) ? 'CRITICAL' : 'WARNING',
      message: event.message,
      source: 'TEMPORAL_EVENT',
      plateId: event.plateId ? String(event.plateId) : null,
      createdAt: isoOrNull(event.createdAt),
      payload: event.metadata ?? {},
    }));
    const items = [...alertItems, ...temporalItems].sort((a, b) => (dateOrNull(b.createdAt)?.getTime() ?? 0) - (dateOrNull(a.createdAt)?.getTime() ?? 0));

    return {
      items,
      summary: {
        total: items.length,
        critical: items.filter((item) => item.severity === 'CRITICAL').length,
        warning: items.filter((item) => item.severity === 'WARNING').length,
        temporal: temporalItems.length,
      },
    };
  }

  async attachPlateToRegion(plateId: string, regionId: string, empresaId: string, regionalLot?: string) {
    const region = await this.getRegionById(regionId, empresaId);
    if (region.status === 'ARCHIVED') throw new AppError('Regiao arquivada nao pode receber placas.', 409);

    const plate = await Placa.findOneAndUpdate(
      { _id: toObjectId(plateId, 'plateId'), empresaId: toObjectId(empresaId, 'empresaId') },
      {
        $set: {
          regionId: toObjectId(regionId, 'regionId'),
          regiaoId: toObjectId(regionId, 'regionId'),
          regionalLot,
          loteRegional: regionalLot,
        },
      },
      { new: true, runValidators: true },
    ).lean();

    if (!plate) throw new AppError('Placa nao encontrada.', 404);
    return plate;
  }

  async detachPlateFromRegion(plateId: string, empresaId: string) {
    const plate = await Placa.findOneAndUpdate(
      { _id: toObjectId(plateId, 'plateId'), empresaId: toObjectId(empresaId, 'empresaId') },
      { $unset: { regionId: '', regionalLot: '' } },
      { new: true },
    ).lean();
    if (!plate) throw new AppError('Placa nao encontrada.', 404);
    return plate;
  }

  async migrateLegacyPlateRegions(empresaId: string) {
    const tenant = toObjectId(empresaId, 'empresaId');
    const report = {
      regionsCreated: 0,
      platesUpdated: 0,
      platesSkipped: 0,
      conflicts: [] as Array<Record<string, unknown>>,
      errors: [] as Array<Record<string, unknown>>,
    };

    const plates = await Placa.find({ empresaId: tenant }).lean();

    for (const plate of plates) {
      try {
        if ((plate as any).regionId) {
          report.platesSkipped += 1;
          continue;
        }

        let region: any = null;
        if ((plate as any).regiaoId && Types.ObjectId.isValid(String((plate as any).regiaoId))) {
          region = await Region.findOne({ _id: (plate as any).regiaoId, empresaId: tenant }).lean();
        }

        const legacyName = (plate as any).loteRegional || (plate as any).regionalLot;
        if (!region && legacyName) {
          const code = normalizeCode(legacyName);
          region = await Region.findOne({ empresaId: tenant, code }).lean();
          if (!region) {
            region = await Region.create({
              empresaId: tenant,
              name: legacyName,
              nome: legacyName,
              code,
              codigo: code,
              status: 'ACTIVE',
              ativo: true,
            });
            report.regionsCreated += 1;
          }
        }

        if (!region) {
          report.platesSkipped += 1;
          continue;
        }

        await Placa.updateOne(
          { _id: plate._id, empresaId: tenant },
          {
            $set: {
              regionId: region._id,
              regiaoId: region._id,
              regionalLot: (plate as any).regionalLot || (plate as any).loteRegional,
              loteRegional: (plate as any).loteRegional || (plate as any).regionalLot,
            },
          },
        );
        report.platesUpdated += 1;
      } catch (error: any) {
        report.errors.push({ plateId: String(plate._id), message: error?.message ?? 'Erro desconhecido' });
      }
    }

    return report;
  }
}

export const regionService = new RegionService();
