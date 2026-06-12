import { Types } from 'mongoose';
import AppError from '@shared/container/AppError';
import TemporalReservation, { type ITemporalReservation } from '@modules/temporal/TemporalReservation';
import Contrato from '@modules/contratos/Contrato';
import PropostaInterna from '@modules/propostas-internas/PropostaInterna';
import Cliente from '@modules/clientes/Cliente';
import Placa from '@modules/placas/Placa';
import { OperationRecord } from '@modules/operations/services/operations-v4.service';
import { resolveOperationBlockLabel } from '@modules/operations/operation-block-label';
import { TEMPORAL_BLOCKING_STATUSES } from '@modules/temporal/temporal.types';
import type {
  CommercialProjection,
  CommercialProjectionActiveContract,
  CommercialProjectionPricing,
  CommercialStatus,
  OperationalBlockInfo,
} from './commercial-projection.types';

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

/** Constroi o bloqueio visual a partir de uma operacao aberta ligada a placa. */
function buildOperationalBlock(operation: any): OperationalBlockInfo {
  const payload = operation.payload ?? {};
  const operationType = String(payload.operationType ?? operation.type ?? 'OTHER');
  const operationStatus = String(payload.operationStatus ?? operation.status ?? 'PENDING');
  return {
    blocked: true,
    reason: 'Esta placa já possui uma operação em aberto.',
    operationId: String(operation._id),
    operationType,
    operationStatus,
    status: operationStatus,
    label: resolveOperationBlockLabel(operationType, operationStatus),
    assignedTo: stringOrUndefined(payload.assignedTo ?? operation.assigneeId),
    notes: stringOrUndefined(payload.notes),
    teamSnapshot: payload.teamSnapshot ?? undefined,
  };
}

const FINAL_OPERATION_STATUSES = new Set([
  'DONE', 'COMPLETED', 'COMPLETE', 'FINISHED', 'FINALIZED', 'CLOSED', 'RESOLVED',
  'CONCLUIDA', 'CONCLUÍDA', 'CONCLUIDO', 'ENCERRADA', 'ENCERRADO', 'FINALIZADA', 'FINALIZADO',
  'CANCELLED', 'CANCELED', 'CANCELADA', 'CANCELADO',
]);

function operationPlateId(operation: any): string | undefined {
  const payload = operation?.payload ?? {};
  return stringOrUndefined(payload.plateId ?? payload.placaId ?? payload.boardId ?? payload.placa_id ?? payload.board_id);
}

function isBlockingOpenOperation(operation: any): boolean {
  const payload = operation?.payload ?? {};
  const operationStatus = String(payload.operationStatus ?? payload.status ?? operation?.status ?? '').toUpperCase();
  return !operation?.completedAt
    && !payload.completedAt
    && !payload.resolvedAt
    && !payload.cancelledAt
    && !FINAL_OPERATION_STATUSES.has(operationStatus);
}

function newestOpenOperation(operations: any[]): any | undefined {
  return operations
    .filter(isBlockingOpenOperation)
    .sort((left, right) => {
      const leftTime = new Date(left.updatedAt ?? left.createdAt ?? 0).getTime();
      const rightTime = new Date(right.updatedAt ?? right.createdAt ?? 0).getTime();
      return rightTime - leftTime;
    })[0];
}

function toObjectId(value: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new AppError('Identificador invalido.', 400);
  }
  return new Types.ObjectId(value);
}

function toMoney(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Derives the canonical CommercialStatus from the active/future temporal reservations
 * and the plate's physical availability flags.
 */
export function deriveCommercialStatus(
  active: ITemporalReservation | undefined,
  future: ITemporalReservation | undefined,
  hasExpiredPending: boolean,
  plateUnavailable: boolean,
): CommercialStatus {
  if (active) {
    if (active.status === 'BLOCKED' || active.sourceType === 'MANUAL_BLOCK') return 'MAINTENANCE';
    if (active.sourceType === 'OPERATION') return 'MAINTENANCE';
    if (active.sourceType === 'CONTRACT' || active.status === 'ACTIVE') return 'CONTRACTED_ACTIVE';
    return 'RESERVED';
  }

  if (future) {
    if (future.status === 'BLOCKED' || future.sourceType === 'MANUAL_BLOCK') return 'MAINTENANCE';
    return 'FUTURE_RESERVED';
  }

  if (hasExpiredPending) return 'UNKNOWN';
  if (plateUnavailable) return 'MAINTENANCE';
  return 'AVAILABLE';
}

/**
 * Builds a CommercialProjection from pre-fetched enrichment maps (no extra DB hits).
 * Used by resolveBatch() to avoid N+1.
 */
function buildEnrichment(
  governing: ITemporalReservation,
  contractsById: Map<string, any>,
  pisById: Map<string, any>,
  clientsById: Map<string, any>,
): { contract: CommercialProjectionActiveContract; pricing?: CommercialProjectionPricing } {
  const startDate = governing.startDate.toISOString();
  const endDate = governing.endDate.toISOString();

  if (governing.sourceType === 'CONTRACT') {
    const contrato = contractsById.get(governing.sourceId);
    if (!contrato) {
      return { contract: { id: governing.sourceId, startDate, endDate } };
    }
    const pi = contrato.piId && typeof contrato.piId === 'object' ? contrato.piId : null;
    const cliente = contrato.clienteId && typeof contrato.clienteId === 'object' ? contrato.clienteId : null;
    return {
      contract: {
        id: String(contrato._id),
        contractCode: contrato.numero,
        clientId: cliente ? String(cliente._id) : undefined,
        clientName: cliente ? (cliente.nomeFantasia || cliente.nome) : undefined,
        startDate,
        endDate,
        piId: pi ? String(pi._id) : undefined,
        piCode: pi?.pi_code,
      },
      pricing: {
        contractValue: pi
          ? toMoney(pi.valorTotal)
          : toMoney((contrato as any).valorTotal),
      },
    };
  }

  if (governing.sourceType === 'PI') {
    const pi = pisById.get(governing.sourceId);
    if (!pi) {
      return { contract: { id: governing.sourceId, startDate, endDate } };
    }
    const cliente = pi.clienteId && typeof pi.clienteId === 'object' ? pi.clienteId : null;
    return {
      contract: {
        id: String(pi._id),
        clientId: cliente ? String(cliente._id) : undefined,
        clientName: cliente ? (cliente.nomeFantasia || cliente.nome) : undefined,
        startDate,
        endDate,
        piCode: pi.pi_code,
      },
      pricing: { contractValue: toMoney(pi.valorTotal) },
    };
  }

  if (governing.sourceType === 'LEGACY_RENTAL') {
    const clientId = governing.customerId ? String(governing.customerId) : undefined;
    const client = clientId ? clientsById.get(clientId) : undefined;
    return {
      contract: {
        id: governing.sourceId,
        clientId,
        clientName: client ? (client.nomeFantasia || client.nome) : undefined,
        startDate,
        endDate,
      },
    };
  }

  // OPERATION or MANUAL_BLOCK — dates only, no commercial enrichment
  return { contract: { id: governing.sourceId, startDate, endDate } };
}

class CommercialProjectionService {
  /**
   * Resolves the canonical CommercialProjection for a single plate.
   * For bulk use, prefer resolveBatch() to avoid N+1 queries.
   */
  async resolve(placaId: string, empresaId: string): Promise<CommercialProjection> {
    const plateOid = toObjectId(placaId);
    const empresaOid = toObjectId(empresaId);

    const plate = await Placa.findOne({ _id: plateOid, empresaId: empresaOid })
      .select('disponivel ativa')
      .lean<any>();

    if (!plate) throw new AppError('Placa nao encontrada.', 404);

    const now = new Date();

    const reservations = await TemporalReservation.find({
      plateId: plateOid,
      empresaId: empresaOid,
      status: { $in: TEMPORAL_BLOCKING_STATUSES },
    })
      .sort({ startDate: 1 })
      .lean<ITemporalReservation[]>();

    const active = reservations.find((r) => r.startDate <= now && r.endDate >= now);
    const future = reservations.find((r) => r.startDate > now);

    const expiredAny = await TemporalReservation.find({
      plateId: plateOid,
      empresaId: empresaOid,
      status: { $in: ['RESERVED', 'ACTIVE'] as string[] },
      endDate: { $lt: now },
    })
      .select('_id')
      .lean();
    const hasExpiredPending = expiredAny.length > 0;

    const plateUnavailable = plate.disponivel === false || plate.ativa === false;
    const commercialStatus = deriveCommercialStatus(active, future, hasExpiredPending, plateUnavailable);

    const governing = active ?? future;
    let activeContract: CommercialProjection['activeContract'];
    let pricing: CommercialProjection['pricing'];

    if (governing && governing.sourceType !== 'MANUAL_BLOCK') {
      // For single-plate use, do individual lookups (no N+1 since it's 1 plate)
      const single = await this.loadEnrichmentForSingle(governing, empresaOid);
      activeContract = single.contract;
      pricing = single.pricing;
    }

    const plateOperations = await OperationRecord.find({
      empresaId: empresaOid,
      kind: 'task',
      $or: [
        { 'payload.plateId': placaId },
        { 'payload.placaId': placaId },
        { 'payload.boardId': placaId },
        { 'payload.placa_id': placaId },
        { 'payload.board_id': placaId },
      ],
    }).lean<any[]>();
    const openOperation = newestOpenOperation(plateOperations);
    const operationalBlock = openOperation ? buildOperationalBlock(openOperation) : undefined;

    return {
      placaId,
      empresaId,
      commercialStatus,
      activeContract,
      reservation: { active: !!active, future: !!future },
      pricing,
      operationalBlock,
      resolvedAt: now.toISOString(),
    };
  }

  /**
   * Resolves CommercialProjection for multiple plates.
   * Uses resolveBatch() internally — O(1) DB round trips regardless of N.
   */
  async resolveMany(
    placaIds: string[],
    empresaId: string,
  ): Promise<CommercialProjection[]> {
    if (placaIds.length === 0) return [];
    const map = await this.resolveBatch(placaIds, empresaId);
    const now = new Date().toISOString();
    return placaIds.map((id) => map.get(id) ?? {
      placaId: id,
      empresaId,
      commercialStatus: 'UNKNOWN' as CommercialStatus,
      reservation: { active: false, future: false },
      resolvedAt: now,
    });
  }

  /**
   * True batch resolver — returns Map<placaId, CommercialProjection>.
   *
   * DB round trips (max 6, regardless of N plates):
   *   Round 1 (parallel): plates + temporal reservations + expired reservations
   *   Round 2 (parallel): contracts + PIs + clients  (only for governing sources)
   */
  async resolveBatch(
    placaIds: string[],
    empresaId: string,
    now: Date = new Date(),
  ): Promise<Map<string, CommercialProjection>> {
    if (placaIds.length === 0) return new Map();

    const empresaOid = toObjectId(empresaId);
    const validIds = [...new Set(placaIds)].filter((id) => Types.ObjectId.isValid(id));
    const placaObjectIds = validIds.map((id) => new Types.ObjectId(id));

    // ── Round 1: plates + reservations in parallel ────────────────────────
    const [plates, blockingReservations, expiredRows] = await Promise.all([
      Placa.find({ _id: { $in: placaObjectIds }, empresaId: empresaOid })
        .select('_id disponivel ativa')
        .lean<any[]>(),

      TemporalReservation.find({
        empresaId: empresaOid,
        plateId: { $in: placaObjectIds },
        status: { $in: TEMPORAL_BLOCKING_STATUSES },
      })
        .sort({ startDate: 1 })
        .lean<ITemporalReservation[]>(),

      TemporalReservation.find({
        empresaId: empresaOid,
        plateId: { $in: placaObjectIds },
        status: { $in: ['RESERVED', 'ACTIVE'] as string[] },
        endDate: { $lt: now },
      })
        .select('plateId')
        .lean<{ plateId: Types.ObjectId }[]>(),
    ]);

    const platesById = new Map<string, any>(
      plates.map((p) => [String(p._id), p]),
    );

    // Group reservations by plate
    const reservationsByPlate = new Map<string, ITemporalReservation[]>();
    blockingReservations.forEach((r) => {
      const key = String(r.plateId);
      const list = reservationsByPlate.get(key) ?? [];
      list.push(r);
      reservationsByPlate.set(key, list);
    });

    const expiredPlateIds = new Set<string>(expiredRows.map((r) => String(r.plateId)));

    // Identify governing reservation per plate
    const governingByPlate = new Map<string, ITemporalReservation>();
    validIds.forEach((placaId) => {
      const reservations = reservationsByPlate.get(placaId) ?? [];
      const active = reservations.find((r) => r.startDate <= now && r.endDate >= now);
      const future = reservations.find((r) => r.startDate > now);
      const governing = active ?? future;
      if (governing && governing.sourceType !== 'MANUAL_BLOCK') {
        governingByPlate.set(placaId, governing);
      }
    });

    // ── Round 2: batch-load enrichment data in parallel ──────────────────
    const contractIds = [...new Set(
      [...governingByPlate.values()]
        .filter((r) => r.sourceType === 'CONTRACT' && Types.ObjectId.isValid(r.sourceId))
        .map((r) => r.sourceId),
    )];

    const piIds = [...new Set(
      [...governingByPlate.values()]
        .filter((r) => r.sourceType === 'PI' && Types.ObjectId.isValid(r.sourceId))
        .map((r) => r.sourceId),
    )];

    const legacyCustomerIds = [...new Set(
      [...governingByPlate.values()]
        .filter((r) => r.sourceType === 'LEGACY_RENTAL' && r.customerId && Types.ObjectId.isValid(String(r.customerId)))
        .map((r) => String(r.customerId)),
    )];

    const [contracts, pis, legacyClients, operations] = await Promise.all([
      contractIds.length > 0
        ? Contrato.find({ _id: { $in: contractIds.map((id) => new Types.ObjectId(id)) }, empresaId: empresaOid })
          .populate('piId', 'valorTotal pi_code startDate endDate dataInicio dataFim')
          .populate('clienteId', 'nome nomeFantasia')
          .lean<any[]>()
        : Promise.resolve([] as any[]),

      piIds.length > 0
        ? PropostaInterna.find({ _id: { $in: piIds.map((id) => new Types.ObjectId(id)) }, empresaId: empresaOid })
          .populate('clienteId', 'nome nomeFantasia')
          .lean<any[]>()
        : Promise.resolve([] as any[]),

      legacyCustomerIds.length > 0
        ? Cliente.find({ _id: { $in: legacyCustomerIds.map((id) => new Types.ObjectId(id)) }, empresaId: empresaOid })
          .select('nome nomeFantasia')
          .lean<any[]>()
        : Promise.resolve([] as any[]),

      OperationRecord.find({
        empresaId: empresaOid,
        kind: 'task',
        $or: [
          { 'payload.plateId': { $in: validIds } },
          { 'payload.placaId': { $in: validIds } },
          { 'payload.boardId': { $in: validIds } },
          { 'payload.placa_id': { $in: validIds } },
          { 'payload.board_id': { $in: validIds } },
        ],
      }).lean<any[]>(),
    ]);

    const contractsById = new Map<string, any>(contracts.map((c) => [String(c._id), c]));
    const pisById = new Map<string, any>(pis.map((p) => [String(p._id), p]));
    const clientsById = new Map<string, any>(legacyClients.map((c) => [String(c._id), c]));
    const operationsByPlate = new Map<string, any[]>();
    operations.forEach((operation) => {
      const plateId = operationPlateId(operation);
      if (!plateId) return;
      operationsByPlate.set(plateId, [...(operationsByPlate.get(plateId) ?? []), operation]);
    });

    // ── Build projections ─────────────────────────────────────────────────
    const result = new Map<string, CommercialProjection>();

    placaIds.forEach((placaId) => {
      const plate = platesById.get(placaId);
      if (!plate) {
        result.set(placaId, {
          placaId,
          empresaId,
          commercialStatus: 'UNKNOWN',
          reservation: { active: false, future: false },
          resolvedAt: now.toISOString(),
        });
        return;
      }

      const reservations = reservationsByPlate.get(placaId) ?? [];
      const active = reservations.find((r) => r.startDate <= now && r.endDate >= now);
      const future = reservations.find((r) => r.startDate > now);

      const hasExpiredPending = expiredPlateIds.has(placaId);
      const plateUnavailable = plate.disponivel === false || plate.ativa === false;
      const commercialStatus = deriveCommercialStatus(active, future, hasExpiredPending, plateUnavailable);

      const governing = governingByPlate.get(placaId);
      let activeContract: CommercialProjection['activeContract'];
      let pricing: CommercialProjection['pricing'];

      if (governing) {
        const enrichment = buildEnrichment(governing, contractsById, pisById, clientsById);
        activeContract = enrichment.contract;
        pricing = enrichment.pricing;
      }

      const openOperation = newestOpenOperation(operationsByPlate.get(placaId) ?? []);
      const operationalBlock = openOperation ? buildOperationalBlock(openOperation) : undefined;

      result.set(placaId, {
        placaId,
        empresaId,
        commercialStatus,
        activeContract,
        reservation: { active: !!active, future: !!future },
        pricing,
        operationalBlock,
        resolvedAt: now.toISOString(),
      });
    });

    return result;
  }

  /** Single-plate enrichment for resolve() — no batch needed for 1 plate */
  private async loadEnrichmentForSingle(
    governing: ITemporalReservation,
    empresaOid: Types.ObjectId,
  ): Promise<{ contract: CommercialProjectionActiveContract; pricing?: CommercialProjectionPricing }> {
    const startDate = governing.startDate.toISOString();
    const endDate = governing.endDate.toISOString();

    if (governing.sourceType === 'CONTRACT') {
      const contrato = await Contrato.findOne({ _id: governing.sourceId, empresaId: empresaOid })
        .populate('piId', 'valorTotal pi_code startDate endDate dataInicio dataFim')
        .populate('clienteId', 'nome nomeFantasia')
        .lean<any>();
      if (!contrato) return { contract: { id: governing.sourceId, startDate, endDate } };

      const pi = contrato.piId && typeof contrato.piId === 'object' ? contrato.piId : null;
      const cliente = contrato.clienteId && typeof contrato.clienteId === 'object' ? contrato.clienteId : null;
      return {
        contract: {
          id: String(contrato._id),
          contractCode: contrato.numero,
          clientId: cliente ? String(cliente._id) : undefined,
          clientName: cliente ? (cliente.nomeFantasia || cliente.nome) : undefined,
          startDate,
          endDate,
          piId: pi ? String(pi._id) : undefined,
          piCode: pi?.pi_code,
        },
        pricing: { contractValue: pi ? toMoney(pi.valorTotal) : toMoney((contrato as any).valorTotal) },
      };
    }

    if (governing.sourceType === 'PI') {
      const pi = await PropostaInterna.findOne({ _id: governing.sourceId, empresaId: empresaOid })
        .populate('clienteId', 'nome nomeFantasia')
        .lean<any>();
      if (!pi) return { contract: { id: governing.sourceId, startDate, endDate } };

      const cliente = pi.clienteId && typeof pi.clienteId === 'object' ? pi.clienteId : null;
      return {
        contract: {
          id: String(pi._id),
          clientId: cliente ? String(cliente._id) : undefined,
          clientName: cliente ? (cliente.nomeFantasia || cliente.nome) : undefined,
          startDate,
          endDate,
          piCode: pi.pi_code,
        },
        pricing: { contractValue: toMoney(pi.valorTotal) },
      };
    }

    if (governing.sourceType === 'LEGACY_RENTAL') {
      const clientId = governing.customerId ? String(governing.customerId) : undefined;
      let clientName: string | undefined;
      if (clientId && Types.ObjectId.isValid(clientId)) {
        const client = await Cliente.findOne({ _id: clientId, empresaId: empresaOid })
          .select('nome nomeFantasia')
          .lean<any>();
        clientName = client ? (client.nomeFantasia || client.nome) : undefined;
      }
      return { contract: { id: governing.sourceId, clientId, clientName, startDate, endDate } };
    }

    return { contract: { id: governing.sourceId, startDate, endDate } };
  }
}

export const commercialProjectionService = new CommercialProjectionService();
export default CommercialProjectionService;
