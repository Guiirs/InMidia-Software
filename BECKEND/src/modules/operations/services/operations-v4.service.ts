import mongoose, { Model, Schema } from 'mongoose';
import AppError from '@shared/container/AppError';
import { temporalEngine } from '@modules/temporal';
import Placa from '@modules/placas/Placa';

type OperationKind = 'task' | 'event';

type OperationDoc = {
  _id: mongoose.Types.ObjectId;
  empresaId: string;
  kind: OperationKind;
  title?: string;
  domain: string;
  priority?: string;
  status: string;
  assigneeId?: string;
  dueDate?: Date;
  completedAt?: Date;
  type?: string;
  payload: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
};

type OperationScope = 'PLATE' | 'REGIONAL' | 'GLOBAL' | 'ADMINISTRATIVE';
type CanonicalOperationType = 'INSTALLATION' | 'SCRAPING' | 'MAINTENANCE' | 'BLOCK' | 'INSPECTION' | 'OTHER';
type CanonicalOperationStatus = 'PENDING' | 'SCHEDULED' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
type CanonicalOperationPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
type OperationSlaStatus = 'ON_TRACK' | 'DUE_SOON' | 'OVERDUE' | 'RESOLVED' | 'CANCELLED' | 'UNKNOWN';
type OperationSlaPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
type CanonicalizationDiagnosticStatus = 'CANONICAL' | 'LEGACY_ONLY' | 'UNRESOLVED' | 'AMBIGUOUS';
type CanonicalizationMatchedBy = 'plateId' | 'placaId' | 'boardId' | 'plateNumber' | 'none';
type CanonicalizationDiagnostic = {
  status: CanonicalizationDiagnosticStatus;
  reason: string;
  lastCheckedAt: string;
  candidateCount: number;
  matchedBy: CanonicalizationMatchedBy;
  safeHints: {
    legacyPlateNumber: string | null;
    legacyBoardId: string | null;
    addressHint: string | null;
  };
};

const PLATE_REQUIRED_TYPES = new Set(['INSTALLATION', 'SCRAPING', 'MAINTENANCE', 'BLOCK']);
const PLATE_REQUIRED_SCOPES = new Set(['PLATE', 'REGIONAL']);
const DONE_STATUS_KEYS = new Set(['DONE', 'COMPLETED', 'COMPLETE', 'RESOLVED', 'CONCLUIDA', 'CONCLUÍDA']);
const CANCELLED_STATUS_KEYS = new Set(['CANCELLED', 'CANCELED', 'CANCELADA']);
const PRIORITY_RANK: Record<OperationSlaPriority, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};
const DIAGNOSTIC_CACHE_TTL_MS = 15 * 60 * 1000;

const TYPE_ALIASES: Record<string, CanonicalOperationType> = {
  INSTALLATION: 'INSTALLATION',
  INSTALACAO: 'INSTALLATION',
  INSTALAÇÃO: 'INSTALLATION',
  INSTALL: 'INSTALLATION',
  SCRAPING: 'SCRAPING',
  RASPAGEM: 'SCRAPING',
  SCRAPE: 'SCRAPING',
  MAINTENANCE: 'MAINTENANCE',
  MANUTENCAO: 'MAINTENANCE',
  MANUTENÇÃO: 'MAINTENANCE',
  BLOCK: 'BLOCK',
  BLOQUEIO: 'BLOCK',
  INSPECTION: 'INSPECTION',
  INSPECAO: 'INSPECTION',
  INSPEÇÃO: 'INSPECTION',
};

const STATUS_ALIASES: Record<string, CanonicalOperationStatus> = {
  PENDING: 'PENDING',
  PENDENTE: 'PENDING',
  SCHEDULED: 'SCHEDULED',
  AGENDADA: 'SCHEDULED',
  AGENDADO: 'SCHEDULED',
  IN_PROGRESS: 'IN_PROGRESS',
  INPROGRESS: 'IN_PROGRESS',
  ANDAMENTO: 'IN_PROGRESS',
  DONE: 'DONE',
  COMPLETED: 'DONE',
  COMPLETE: 'DONE',
  CONCLUIDA: 'DONE',
  CONCLUÍDA: 'DONE',
  CANCELLED: 'CANCELLED',
  CANCELED: 'CANCELLED',
  CANCELADA: 'CANCELLED',
};

const PRIORITY_ALIASES: Record<string, CanonicalOperationPriority> = {
  CRITICAL: 'CRITICAL',
  CRITICA: 'CRITICAL',
  CRÍTICA: 'CRITICAL',
  URGENT: 'CRITICAL',
  HIGH: 'HIGH',
  ALTA: 'HIGH',
  MEDIUM: 'MEDIUM',
  MEDIA: 'MEDIUM',
  MÉDIA: 'MEDIUM',
  NORMAL: 'MEDIUM',
  LOW: 'LOW',
  BAIXA: 'LOW',
};

const operationSchema = new Schema<OperationDoc>({
  empresaId: { type: String, required: true, index: true },
  kind: { type: String, enum: ['task', 'event'], required: true, index: true },
  title: { type: String },
  domain: { type: String, default: 'system', index: true },
  priority: { type: String, default: 'normal' },
  status: { type: String, default: 'pending', index: true },
  assigneeId: { type: String },
  dueDate: { type: Date },
  completedAt: { type: Date },
  type: { type: String },
  payload: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true, collection: 'operations_v4_records' });

operationSchema.index({ empresaId: 1, kind: 1, createdAt: -1 });

export const OperationRecord: Model<OperationDoc> = (mongoose.models.OperationV4Record as Model<OperationDoc> | undefined)
  || mongoose.model<OperationDoc>('OperationV4Record', operationSchema);

function toDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function isoOrNull(value: unknown): string | null {
  const date = toDate(value);
  return date ? date.toISOString() : null;
}

function normalizedKey(value: unknown): string {
  return String(value ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');
}

function normalizeOperationTypeValue(value: unknown): CanonicalOperationType {
  const key = normalizedKey(value);
  return TYPE_ALIASES[key] ?? 'OTHER';
}

function normalizeOperationStatusValue(value: unknown): CanonicalOperationStatus {
  const key = normalizedKey(value);
  return STATUS_ALIASES[key] ?? 'PENDING';
}

function normalizeOperationPriorityValue(value: unknown): CanonicalOperationPriority {
  const key = normalizedKey(value);
  return PRIORITY_ALIASES[key] ?? 'MEDIUM';
}

function normalizeOperationScope(value: unknown, plateId: unknown): OperationScope {
  const key = normalizedKey(value);
  if (key === 'REGIONAL') return 'REGIONAL';
  if (key === 'PLATE') return 'PLATE';
  if (key === 'GLOBAL') return 'GLOBAL';
  if (key === 'ADMINISTRATIVE') return 'ADMINISTRATIVE';
  return plateId ? 'PLATE' : 'ADMINISTRATIVE';
}

function stringOrNull(value: unknown): string | null {
  if (value == null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function uniqueStrings(values: Array<string | null>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function getLegacyPlateCandidate(payload: Record<string, unknown>): string | null {
  return stringOrNull(payload.plateId)
    ?? stringOrNull(payload.placaId)
    ?? stringOrNull(payload.boardId)
    ?? stringOrNull(payload.placa_id)
    ?? stringOrNull(payload.board_id);
}

function getLegacyIdCandidates(payload: Record<string, unknown>): string[] {
  return uniqueStrings([
    stringOrNull(payload.placaId),
    stringOrNull(payload.boardId),
    stringOrNull(payload.placa_id),
    stringOrNull(payload.board_id),
  ]);
}

function getPlateNumberCandidates(payload: Record<string, unknown>): string[] {
  return uniqueStrings([
    stringOrNull(payload.numeroPlaca),
    stringOrNull(payload.numero_placa),
    stringOrNull(payload.codigoPlaca),
    stringOrNull(payload.codigo_placa),
  ]);
}

function hasAddressDiagnostic(payload: Record<string, unknown>): boolean {
  return Boolean(stringOrNull(payload.address) ?? stringOrNull(payload.endereco));
}

function getOperationPayload(operation: { payload?: Record<string, unknown> } | Record<string, unknown>): Record<string, unknown> {
  if ('payload' in operation && operation.payload && typeof operation.payload === 'object') {
    return operation.payload as Record<string, unknown>;
  }
  return operation as Record<string, unknown>;
}

function getOperationStatusKey(operation: { status?: unknown; completedAt?: unknown; payload?: Record<string, unknown> } | Record<string, unknown>): string {
  const payload = getOperationPayload(operation);
  const raw = payload.operationStatus ?? payload.status ?? ('status' in operation ? operation.status : undefined);
  return normalizedKey(raw);
}

function isResolvedOperation(operation: { status?: unknown; completedAt?: unknown; payload?: Record<string, unknown> } | Record<string, unknown>): boolean {
  const statusKey = getOperationStatusKey(operation);
  return DONE_STATUS_KEYS.has(statusKey) || Boolean(('completedAt' in operation && operation.completedAt) || getOperationPayload(operation).completedAt || getOperationPayload(operation).resolvedAt);
}

function isCancelledOperation(operation: { status?: unknown; payload?: Record<string, unknown> } | Record<string, unknown>): boolean {
  return CANCELLED_STATUS_KEYS.has(getOperationStatusKey(operation));
}

function getReferenceDueAt(operation: Record<string, any>, payload: Record<string, unknown>): Date | undefined {
  return toDate(payload.slaDueAt)
    ?? toDate(payload.dueAt)
    ?? toDate(payload.dueDate)
    ?? toDate(operation.dueDate)
    ?? toDate(payload.scheduledAt)
    ?? toDate(payload.startDate)
    ?? toDate(operation.scheduledAt);
}

function getResolutionMinutes(operation: Record<string, any>, payload: Record<string, unknown>): number | null {
  const end = toDate(payload.resolvedAt) ?? toDate(payload.completedAt) ?? toDate(operation.completedAt);
  const start = toDate(payload.startedAt) ?? toDate(operation.createdAt);
  if (!start || !end) return null;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

function maxPriority(a: OperationSlaPriority, b: OperationSlaPriority): OperationSlaPriority {
  return PRIORITY_RANK[b] > PRIORITY_RANK[a] ? b : a;
}

export function resolveOperationSla(
  operation: { status?: unknown; dueDate?: unknown; completedAt?: unknown; createdAt?: unknown; payload?: Record<string, unknown>; priority?: unknown } | Record<string, unknown>,
  options: { now?: Date; dueSoonThresholdHours?: number } = {},
) {
  const now = options.now ?? new Date();
  const dueSoonThresholdHours = options.dueSoonThresholdHours ?? 24;
  const payload = getOperationPayload(operation);
  const op = operation as Record<string, any>;
  const priority = normalizeOperationPriorityValue(payload.slaPriority ?? payload.priority ?? op.priority) as OperationSlaPriority;
  const referenceDueAt = getReferenceDueAt(op, payload);
  const resolutionMinutes = getResolutionMinutes(op, payload);

  if (isCancelledOperation(operation)) {
    return {
      slaStatus: 'CANCELLED' as OperationSlaStatus,
      slaPriority: priority,
      isOverdue: false,
      overdueMinutes: 0,
      resolutionMinutes,
      dueSoon: false,
      referenceDueAt: referenceDueAt?.toISOString?.() ?? null,
    };
  }

  if (isResolvedOperation(operation)) {
    return {
      slaStatus: 'RESOLVED' as OperationSlaStatus,
      slaPriority: priority,
      isOverdue: false,
      overdueMinutes: 0,
      resolutionMinutes,
      dueSoon: false,
      referenceDueAt: referenceDueAt?.toISOString?.() ?? null,
    };
  }

  if (!referenceDueAt) {
    return {
      slaStatus: 'UNKNOWN' as OperationSlaStatus,
      slaPriority: priority,
      isOverdue: false,
      overdueMinutes: 0,
      resolutionMinutes,
      dueSoon: false,
      referenceDueAt: null,
    };
  }

  const minutesUntilDue = Math.round((referenceDueAt.getTime() - now.getTime()) / 60000);
  const isOverdue = minutesUntilDue < 0;
  const overdueMinutes = isOverdue ? Math.abs(minutesUntilDue) : 0;
  const dueSoon = !isOverdue && minutesUntilDue <= dueSoonThresholdHours * 60;
  let slaStatus: OperationSlaStatus = 'ON_TRACK';
  let slaPriority = priority;

  if (isOverdue) {
    slaStatus = 'OVERDUE';
    slaPriority = maxPriority(priority, overdueMinutes >= 24 * 60 ? 'CRITICAL' : 'HIGH');
  } else if (dueSoon) {
    slaStatus = 'DUE_SOON';
    slaPriority = maxPriority(priority, 'HIGH');
  }

  return {
    slaStatus,
    slaPriority,
    isOverdue,
    overdueMinutes,
    resolutionMinutes,
    dueSoon,
    referenceDueAt: referenceDueAt.toISOString(),
  };
}

export function resolveOperationPlateId(operation: { payload?: Record<string, unknown> } | Record<string, unknown>): string | null {
  const payload = getOperationPayload(operation);
  return stringOrNull(payload.plateId)
    ?? stringOrNull(payload.placaId)
    ?? stringOrNull(payload.boardId)
    ?? stringOrNull(payload.placa_id)
    ?? stringOrNull(payload.board_id);
}

function getPlateRegionId(plate: any): string | null {
  return stringOrNull(plate?.regionId) ?? stringOrNull(plate?.regiaoId);
}

function getPlateRegionalLot(plate: any): string | null {
  return stringOrNull(plate?.regionalLot) ?? stringOrNull(plate?.loteRegional);
}

function empresaQuery(empresaId: string) {
  return mongoose.Types.ObjectId.isValid(empresaId) ? new mongoose.Types.ObjectId(empresaId) : empresaId;
}

async function findPlateForOperation(empresaId: string, plateId: string) {
  if (!mongoose.Types.ObjectId.isValid(plateId)) return null;
  return Placa.findOne({
    _id: new mongoose.Types.ObjectId(plateId),
    empresaId: empresaQuery(empresaId),
  }).lean<any>();
}

async function findPlatesByNumberForOperation(empresaId: string, plateNumber: string) {
  return Placa.find({
    empresaId: empresaQuery(empresaId),
    numero_placa: plateNumber,
  }).limit(3).lean<any[]>();
}

type PlateResolution =
  | { status: 'resolved'; plate: any; source: 'plateId' | 'legacyId' | 'plateNumber'; candidate: string }
  | { status: 'ambiguous'; source: 'plateNumber'; candidate: string; count: number }
  | { status: 'unresolved'; reason: string; addressDiagnostic: boolean };
type PlateResolutionSource = 'plateId' | 'legacyId' | 'plateNumber';

async function resolvePlateForBackfill(empresaId: string, payload: Record<string, unknown>): Promise<PlateResolution> {
  const canonical = stringOrNull(payload.plateId);
  if (canonical) {
    const plate = await findPlateForOperation(empresaId, canonical);
    if (plate) return { status: 'resolved', plate, source: 'plateId', candidate: canonical };
  }

  for (const candidate of getLegacyIdCandidates(payload)) {
    const plate = await findPlateForOperation(empresaId, candidate);
    if (plate) return { status: 'resolved', plate, source: 'legacyId', candidate };
  }

  for (const candidate of getPlateNumberCandidates(payload)) {
    const plates = await findPlatesByNumberForOperation(empresaId, candidate);
    if (plates.length === 1) return { status: 'resolved', plate: plates[0], source: 'plateNumber', candidate };
    if (plates.length > 1) return { status: 'ambiguous', source: 'plateNumber', candidate, count: plates.length };
  }

  return {
    status: 'unresolved',
    reason: hasAddressDiagnostic(payload) ? 'address-only-diagnostic' : 'no-safe-match',
    addressDiagnostic: hasAddressDiagnostic(payload),
  };
}

function operationTypeOf(operation: OperationDoc): string {
  return String(operation.payload?.operationType ?? operation.payload?.type ?? operation.type ?? operation.title ?? 'OTHER').trim() || 'OTHER';
}

function operationStatusOf(operation: OperationDoc): string {
  return String(operation.payload?.operationStatus ?? operation.payload?.status ?? operation.status ?? 'unknown').trim() || 'unknown';
}

function incrementBucket(
  acc: Record<string, { total: number; canonical: number; legacyOnly: number; unresolved: number; ambiguous: number }>,
  key: string,
  status: 'canonical' | 'legacyOnly' | 'unresolved' | 'ambiguous',
) {
  const bucketKey = key || 'unknown';
  acc[bucketKey] ??= { total: 0, canonical: 0, legacyOnly: 0, unresolved: 0, ambiguous: 0 };
  acc[bucketKey].total += 1;
  acc[bucketKey][status] += 1;
}

function safeOperationSample(operation: OperationDoc, reason?: string) {
  const payload = operation.payload ?? {};
  return {
    operationId: String(operation._id),
    id: String(operation._id),
    title: operation.title ?? null,
    operationType: operationTypeOf(operation),
    type: operationTypeOf(operation),
    status: operationStatusOf(operation),
    currentReason: reason ?? null,
    reason: reason ?? null,
    legacyPlateNumber: stringOrNull(payload.numeroPlaca) ?? stringOrNull(payload.numero_placa) ?? stringOrNull(payload.codigoPlaca) ?? stringOrNull(payload.codigo_placa),
    legacyBoardId: stringOrNull(payload.boardId) ?? stringOrNull(payload.board_id) ?? stringOrNull(payload.placaId) ?? stringOrNull(payload.placa_id),
    addressHint: stringOrNull(payload.address) ?? stringOrNull(payload.endereco),
    createdAt: operation.createdAt?.toISOString?.() ?? null,
    hasLegacyId: getLegacyIdCandidates(operation.payload ?? {}).length > 0,
    hasPlateNumber: getPlateNumberCandidates(operation.payload ?? {}).length > 0,
    hasAddressDiagnostic: hasAddressDiagnostic(operation.payload ?? {}),
  };
}

function safePlateCandidate(plate: any, source: string, matchedBy?: string) {
  return {
    plateId: String(plate._id),
    plateNumber: plate.numero_placa ?? null,
    address: plate.nomeDaRua ?? plate.localizacao ?? null,
    regionId: getPlateRegionId(plate),
    regionalLot: getPlateRegionalLot(plate),
    source,
    matchedBy: matchedBy ?? null,
  };
}

function percent(part: number, total: number) {
  return total ? Number(((part / total) * 100).toFixed(2)) : 0;
}

function ageDaysOf(date?: Date) {
  if (!date) return 0;
  const diff = Date.now() - date.getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}

function priorityRankOf(priority: string) {
  return PRIORITY_RANK[normalizeOperationPriorityValue(priority)] ?? 0;
}

function safeSummaryOf(operation: OperationDoc) {
  const payload = operation.payload ?? {};
  const dueAt = isoOrNull(payload.dueAt ?? payload.dueDate ?? operation.dueDate);
  const scheduledAt = isoOrNull(payload.scheduledAt);
  return {
    title: operation.title ?? 'Tarefa operacional',
    domain: operation.domain ?? null,
    dueAt,
    scheduledAt,
    assigneeId: operation.assigneeId ?? stringOrNull(payload.assignedTo) ?? stringOrNull(payload.assigneeId),
  };
}

function getPayloadMetadata(payload: Record<string, unknown>): Record<string, unknown> {
  return payload.metadata && typeof payload.metadata === 'object'
    ? payload.metadata as Record<string, unknown>
    : {};
}

function getSafeHints(payload: Record<string, unknown>) {
  return {
    legacyPlateNumber: stringOrNull(payload.numeroPlaca) ?? stringOrNull(payload.numero_placa) ?? stringOrNull(payload.codigoPlaca) ?? stringOrNull(payload.codigo_placa),
    legacyBoardId: stringOrNull(payload.boardId) ?? stringOrNull(payload.board_id) ?? stringOrNull(payload.placaId) ?? stringOrNull(payload.placa_id),
    addressHint: stringOrNull(payload.address) ?? stringOrNull(payload.endereco),
  };
}

function sourceToMatchedBy(source: PlateResolutionSource | undefined, candidate: string | undefined, payload: Record<string, unknown>): CanonicalizationMatchedBy {
  if (source === 'plateId') return 'plateId';
  if (source === 'plateNumber') return 'plateNumber';
  if (source === 'legacyId') {
    if (candidate && (stringOrNull(payload.placaId) === candidate || stringOrNull(payload.placa_id) === candidate)) return 'placaId';
    if (candidate && (stringOrNull(payload.boardId) === candidate || stringOrNull(payload.board_id) === candidate)) return 'boardId';
  }
  return 'none';
}

async function buildCanonicalizationDiagnostic(empresaId: string, operation: OperationDoc): Promise<CanonicalizationDiagnostic> {
  const payload = operation.payload ?? {};
  const now = new Date().toISOString();
  const resolution = await resolvePlateForBackfill(empresaId, payload);

  if (resolution.status === 'resolved') {
    return {
      status: resolution.source === 'plateId' ? 'CANONICAL' : 'LEGACY_ONLY',
      reason: resolution.source,
      lastCheckedAt: now,
      candidateCount: 1,
      matchedBy: sourceToMatchedBy(resolution.source, resolution.candidate, payload),
      safeHints: getSafeHints(payload),
    };
  }

  if (resolution.status === 'ambiguous') {
    return {
      status: 'AMBIGUOUS',
      reason: `ambiguous-${resolution.source}`,
      lastCheckedAt: now,
      candidateCount: resolution.count,
      matchedBy: 'plateNumber',
      safeHints: getSafeHints(payload),
    };
  }

  return {
    status: 'UNRESOLVED',
    reason: resolution.reason,
    lastCheckedAt: now,
    candidateCount: 0,
    matchedBy: 'none',
    safeHints: getSafeHints(payload),
  };
}

function getCachedDiagnostic(operation: OperationDoc): CanonicalizationDiagnostic | null {
  const diagnostic = getPayloadMetadata(operation.payload ?? {}).canonicalizationDiagnostic;
  if (!diagnostic || typeof diagnostic !== 'object') return null;
  const record = diagnostic as Partial<CanonicalizationDiagnostic>;
  if (!record.status || !record.lastCheckedAt) return null;
  return {
    status: record.status,
    reason: String(record.reason ?? ''),
    lastCheckedAt: String(record.lastCheckedAt),
    candidateCount: Number(record.candidateCount ?? 0),
    matchedBy: (record.matchedBy ?? 'none') as CanonicalizationMatchedBy,
    safeHints: {
      legacyPlateNumber: stringOrNull(record.safeHints?.legacyPlateNumber),
      legacyBoardId: stringOrNull(record.safeHints?.legacyBoardId),
      addressHint: stringOrNull(record.safeHints?.addressHint),
    },
  } as CanonicalizationDiagnostic;
}

function isDiagnosticFresh(diagnostic: CanonicalizationDiagnostic | null) {
  if (!diagnostic?.lastCheckedAt) return false;
  const checkedAt = new Date(diagnostic.lastCheckedAt).getTime();
  return Number.isFinite(checkedAt) && Date.now() - checkedAt <= DIAGNOSTIC_CACHE_TTL_MS;
}

export async function resolveOperationRegionId(
  operation: { payload?: Record<string, unknown> } | Record<string, unknown>,
  empresaId?: string,
): Promise<string | null> {
  const payload = getOperationPayload(operation);
  const regionId = stringOrNull(payload.regionId);
  if (regionId) return regionId;

  const plateId = resolveOperationPlateId(operation);
  if (!plateId || !empresaId) return null;
  const plate = await findPlateForOperation(empresaId, plateId);
  return getPlateRegionId(plate);
}

export function assertOperationHasPlate(payload: Record<string, unknown>, options: { operationScope?: unknown; operationType?: unknown } = {}) {
  const plateId = stringOrNull(payload.plateId);
  const operationType = normalizeOperationTypeValue(options.operationType ?? payload.operationType ?? payload.type);
  const operationScope = normalizeOperationScope(options.operationScope ?? payload.operationScope, plateId);

  if ((PLATE_REQUIRED_SCOPES.has(operationScope) || PLATE_REQUIRED_TYPES.has(operationType)) && !plateId) {
    throw new AppError('Operacao regional ou de placa exige plateId canonico.', 400);
  }
}

export async function normalizeOperationPayload(payload: Record<string, unknown>, empresaId: string) {
  const canonical: Record<string, unknown> = { ...payload };
  const legacyPlateId = getLegacyPlateCandidate(canonical);
  const operationType = normalizeOperationTypeValue(canonical.operationType ?? canonical.type ?? canonical.title);
  const operationScope = normalizeOperationScope(canonical.operationScope, legacyPlateId);
  const plateRequired = PLATE_REQUIRED_SCOPES.has(operationScope) || PLATE_REQUIRED_TYPES.has(operationType);
  const plate = legacyPlateId ? await findPlateForOperation(empresaId, legacyPlateId) : null;

  if (legacyPlateId && !plate && plateRequired) {
    throw new AppError('Placa da operacao nao encontrada para a empresa.', 404);
  }

  if (plate) {
    canonical.plateId = String(plate._id);
    canonical.placaId ??= legacyPlateId;
    canonical.boardId ??= legacyPlateId;
    canonical.regionId = getPlateRegionId(plate);
    canonical.regionalLot = getPlateRegionalLot(plate);
  } else {
    canonical.plateId = legacyPlateId ?? null;
    canonical.regionId = null;
    canonical.regionalLot = null;
  }

  canonical.operationType = operationType;
  canonical.operationStatus = normalizeOperationStatusValue(canonical.operationStatus ?? canonical.status);
  canonical.priority = normalizeOperationPriorityValue(canonical.priority);
  canonical.operationScope = operationScope;
  canonical.scheduledAt = canonical.scheduledAt ?? canonical.startDate ?? canonical.dataInicio ?? null;
  canonical.dueAt = canonical.dueAt ?? canonical.dueDate ?? canonical.endDate ?? canonical.dataFim ?? null;
  canonical.slaDueAt = canonical.slaDueAt ?? canonical.dueAt ?? canonical.scheduledAt ?? null;
  canonical.startedAt = canonical.startedAt ?? null;
  canonical.completedAt = canonical.completedAt ?? null;
  canonical.resolvedAt = canonical.resolvedAt ?? null;
  canonical.assignedTo = canonical.assignedTo ?? canonical.assigneeId ?? canonical.owner ?? null;
  canonical.notes = canonical.notes ?? canonical.description ?? null;
  const sla = resolveOperationSla({ payload: canonical, status: canonical.operationStatus });
  canonical.isOverdue = sla.isOverdue;
  canonical.overdueMinutes = sla.overdueMinutes;
  canonical.resolutionMinutes = sla.resolutionMinutes;
  canonical.slaStatus = sla.slaStatus;
  canonical.slaPriority = sla.slaPriority;

  assertOperationHasPlate(canonical, { operationScope, operationType });
  return canonical;
}

function toTask(doc: OperationDoc) {
  const id = String(doc._id);
  const plateId = resolveOperationPlateId(doc);
  const sla = resolveOperationSla(doc);
  return {
    id,
    realId: id,
    title: doc.title ?? doc.payload.title ?? 'Tarefa operacional',
    domain: doc.domain,
    priority: doc.priority ?? 'normal',
    status: doc.status,
    assigneeId: doc.assigneeId ?? null,
    owner: doc.assigneeId ?? null,
    dueDate: doc.dueDate?.toISOString?.() ?? null,
    completedAt: doc.completedAt?.toISOString?.() ?? null,
    dueAt: isoOrNull(doc.payload?.dueAt ?? doc.payload?.dueDate ?? doc.dueDate),
    scheduledAt: isoOrNull(doc.payload?.scheduledAt),
    slaStatus: sla.slaStatus,
    slaPriority: sla.slaPriority,
    isOverdue: sla.isOverdue,
    overdueMinutes: sla.overdueMinutes,
    resolutionMinutes: sla.resolutionMinutes,
    dueSoon: sla.dueSoon,
    referenceDueAt: sla.referenceDueAt,
    plateId,
    regionId: stringOrNull(doc.payload?.regionId),
    regionalLot: stringOrNull(doc.payload?.regionalLot),
    operationType: stringOrNull(doc.payload?.operationType) ?? doc.type ?? null,
    operationStatus: stringOrNull(doc.payload?.operationStatus) ?? doc.status,
    payload: doc.payload ?? {},
    createdAt: doc.createdAt?.toISOString?.() ?? null,
    updatedAt: doc.updatedAt?.toISOString?.() ?? null,
  };
}

function toEvent(doc: OperationDoc) {
  const id = String(doc._id);
  return {
    id,
    realId: id,
    type: doc.type ?? 'manual',
    domain: doc.domain,
    status: doc.status,
    payload: doc.payload ?? {},
    createdAt: doc.createdAt?.toISOString?.() ?? null,
    updatedAt: doc.updatedAt?.toISOString?.() ?? null,
  };
}

async function findTask(empresaId: string, id: string): Promise<OperationDoc> {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError('Tarefa operacional invalida.', 400);
  const task = await OperationRecord.findOne({ _id: id, empresaId, kind: 'task' }).lean<OperationDoc>();
  if (!task) throw new AppError('Tarefa operacional nao encontrada.', 404);
  return task;
}

export class OperationsV4Service {
  async getTimeline(empresaId: string) {
    const events = await OperationRecord.find({ empresaId, kind: 'event' }).sort({ createdAt: -1 }).limit(100).lean<OperationDoc[]>();
    return { events: events.map(toEvent), cursor: null as string | null };
  }

  async getSummary(empresaId: string) {
    const today = new Date(new Date().toISOString().slice(0, 10));
    const operations = await OperationRecord.find({ empresaId, kind: 'task' }).lean<OperationDoc[]>();
    const activeOperations = operations.filter((operation) => {
      const sla = resolveOperationSla(operation);
      return sla.slaStatus !== 'RESOLVED' && sla.slaStatus !== 'CANCELLED';
    });
    const slaList = operations.map((operation) => resolveOperationSla(operation));
    const resolvedWithTime = slaList.filter((sla) => typeof sla.resolutionMinutes === 'number') as Array<ReturnType<typeof resolveOperationSla> & { resolutionMinutes: number }>;
    const overdueOperations = slaList.filter((sla) => sla.slaStatus === 'OVERDUE').length;
    const dueSoonOperations = slaList.filter((sla) => sla.slaStatus === 'DUE_SOON').length;
    const criticalBacklog = activeOperations.filter((operation) => resolveOperationSla(operation).slaPriority === 'CRITICAL').length;
    const highPriorityBacklog = activeOperations.filter((operation) => resolveOperationSla(operation).slaPriority === 'HIGH').length;
    const averageResolutionMinutes = resolvedWithTime.length
      ? Math.round(resolvedWithTime.reduce((sum, sla) => sum + sla.resolutionMinutes, 0) / resolvedWithTime.length)
      : null;
    const operationsSlaHealth = overdueOperations > 0 || criticalBacklog > 0
      ? 'CRITICAL'
      : dueSoonOperations > 0 || highPriorityBacklog > 0
        ? 'ATTENTION'
        : 'HEALTHY';
    const [pendingCount, completedToday, totalCount] = await Promise.all([
      OperationRecord.countDocuments({ empresaId, kind: 'task', status: { $ne: 'completed' } }),
      OperationRecord.countDocuments({ empresaId, kind: 'task', status: 'completed', completedAt: { $gte: today } }),
      OperationRecord.countDocuments({ empresaId, kind: 'task' }),
    ]);
    const healthStatus = pendingCount > 20 ? 'attention' : 'operational';
    const score = Math.max(0, Math.min(100, 100 - pendingCount * 2));
    return {
      health: healthStatus,
      pendingCount,
      completedToday,
      healthDetail: {
        status: healthStatus,
        score,
        pendingCount,
        completedToday,
        warningCount: dueSoonOperations || (pendingCount > 10 ? 1 : 0),
        criticalCount: overdueOperations || (pendingCount > 20 ? 1 : 0),
        affectedAreas: [] as string[],
      },
      sla: {
        overdueOperations,
        dueSoonOperations,
        resolvedOperations: slaList.filter((sla) => sla.slaStatus === 'RESOLVED').length,
        averageResolutionMinutes,
        criticalBacklog,
        highPriorityBacklog,
        operationsSlaHealth,
        backlogByPriority: {
          critical: criticalBacklog,
          high: highPriorityBacklog,
          medium: activeOperations.filter((operation) => resolveOperationSla(operation).slaPriority === 'MEDIUM').length,
          low: activeOperations.filter((operation) => resolveOperationSla(operation).slaPriority === 'LOW').length,
        },
      },
      overview: {
        totalTarefas: totalCount,
        pendentes: pendingCount,
        concluidas: totalCount - pendingCount,
        concluídasHoje: completedToday,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  async refreshOperationCanonicalizationDiagnostic(operationId: string, empresaId: string) {
    const operation = await findTask(empresaId, operationId);
    const diagnostic = await buildCanonicalizationDiagnostic(empresaId, operation);
    const payload = operation.payload ?? {};
    const metadata = getPayloadMetadata(payload);
    const updated = await OperationRecord.findOneAndUpdate(
      { _id: operation._id, empresaId, kind: 'task' },
      {
        $set: {
          payload: {
            ...payload,
            metadata: {
              ...metadata,
              canonicalizationDiagnostic: diagnostic,
            },
          },
        },
      },
      { new: true },
    ).lean<OperationDoc>();
    if (!updated) throw new AppError('Tarefa operacional nao encontrada.', 404);
    return { operation: updated, diagnostic };
  }

  async refreshOperationCanonicalizationDiagnostics(
    empresaId: string,
    options: { limit?: unknown } = {},
  ) {
    const limit = Math.max(1, Math.min(5000, Number(options.limit || 1000) || 1000));
    const report = {
      totalScanned: 0,
      updated: 0,
      canonical: 0,
      legacyOnly: 0,
      unresolved: 0,
      ambiguous: 0,
      errors: [] as Array<{ operationId: string; message: string }>,
    };
    const operations = await OperationRecord.find({ empresaId, kind: 'task' })
      .select('title type status priority domain assigneeId dueDate payload createdAt updatedAt')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean<OperationDoc[]>();
    report.totalScanned = operations.length;

    for (const operation of operations) {
      try {
        const diagnostic = await buildCanonicalizationDiagnostic(empresaId, operation);
        const payload = operation.payload ?? {};
        const metadata = getPayloadMetadata(payload);
        await OperationRecord.updateOne(
          { _id: operation._id, empresaId, kind: 'task' },
          {
            $set: {
              payload: {
                ...payload,
                metadata: {
                  ...metadata,
                  canonicalizationDiagnostic: diagnostic,
                },
              },
            },
          },
        );
        report.updated += 1;
        if (diagnostic.status === 'CANONICAL') report.canonical += 1;
        if (diagnostic.status === 'LEGACY_ONLY') report.legacyOnly += 1;
        if (diagnostic.status === 'UNRESOLVED') report.unresolved += 1;
        if (diagnostic.status === 'AMBIGUOUS') report.ambiguous += 1;
      } catch (error) {
        report.errors.push({
          operationId: String(operation._id),
          message: error instanceof Error ? error.message : 'Erro desconhecido',
        });
      }
    }

    return report;
  }

  async getOperationCanonicalizationReport(empresaId: string) {
    const operations = await OperationRecord.find({ empresaId, kind: 'task' }).select('title type status payload createdAt').lean<OperationDoc[]>();
    const totalOperations = operations.length;
    let canonicalOperations = 0;
    let legacyOnlyOperations = 0;
    let unresolvedOperations = 0;
    let ambiguousOperations = 0;
    const byOperationType: Record<string, { total: number; canonical: number; legacyOnly: number; unresolved: number; ambiguous: number }> = {};
    const byOperationStatus: Record<string, { total: number; canonical: number; legacyOnly: number; unresolved: number; ambiguous: number }> = {};
    const byRegionMap = new Map<string, { regionId: string | null; total: number; canonical: number; legacyOnly: number; unresolved: number; ambiguous: number }>();
    const samples = {
      unresolved: [] as Array<ReturnType<typeof safeOperationSample>>,
      legacyOnly: [] as Array<ReturnType<typeof safeOperationSample>>,
      ambiguous: [] as Array<ReturnType<typeof safeOperationSample>>,
    };

    for (const operation of operations) {
      const payload = operation.payload ?? {};
      const hasCanonical = Boolean(stringOrNull(payload.plateId));
      const hasLegacy = getLegacyIdCandidates(payload).length > 0 || getPlateNumberCandidates(payload).length > 0;
      let state: 'canonical' | 'legacyOnly' | 'unresolved' | 'ambiguous' = 'unresolved';
      let regionId = stringOrNull(payload.regionId);
      let reason: string | undefined;

      if (hasCanonical) {
        canonicalOperations += 1;
        state = 'canonical';
      } else {
        const resolution = await resolvePlateForBackfill(empresaId, payload);
        if (resolution.status === 'resolved') {
          legacyOnlyOperations += 1;
          state = 'legacyOnly';
          regionId = getPlateRegionId(resolution.plate);
          if (samples.legacyOnly.length < 5) samples.legacyOnly.push(safeOperationSample(operation, resolution.source));
        } else if (resolution.status === 'ambiguous') {
          ambiguousOperations += 1;
          state = 'ambiguous';
          reason = `ambiguous-${resolution.source}`;
          if (samples.ambiguous.length < 5) samples.ambiguous.push(safeOperationSample(operation, reason));
          if (hasLegacy) legacyOnlyOperations += 1;
        } else {
          unresolvedOperations += 1;
          if (hasLegacy) legacyOnlyOperations += 1;
          state = 'unresolved';
          reason = resolution.reason;
          if (samples.unresolved.length < 5) samples.unresolved.push(safeOperationSample(operation, reason));
        }
      }

      incrementBucket(byOperationType, normalizeOperationTypeValue(operationTypeOf(operation)), state);
      incrementBucket(byOperationStatus, normalizeOperationStatusValue(operationStatusOf(operation)), state);
      const regionKey = regionId ?? 'unresolved';
      const current = byRegionMap.get(regionKey) ?? { regionId, total: 0, canonical: 0, legacyOnly: 0, unresolved: 0, ambiguous: 0 };
      current.total += 1;
      current[state] += 1;
      byRegionMap.set(regionKey, current);
    }
    const canonicalizationRate = totalOperations ? Number(((canonicalOperations / totalOperations) * 100).toFixed(2)) : 100;

    return {
      totalOperations,
      canonicalOperations,
      legacyOnlyOperations,
      unresolvedOperations,
      ambiguousOperations,
      canonicalizationRate,
      unresolvedRate: percent(unresolvedOperations, totalOperations),
      legacyRate: percent(legacyOnlyOperations, totalOperations),
      byOperationType,
      byOperationStatus,
      byRegion: Array.from(byRegionMap.values()).sort((a, b) => b.total - a.total),
      samples,
    };
  }

  async getLinkResolutionQueue(
    empresaId: string,
    query: {
      status?: unknown;
      operationType?: unknown;
      priority?: unknown;
      age?: unknown;
      search?: unknown;
      limit?: unknown;
      page?: unknown;
      forceRefresh?: unknown;
    } = {},
  ) {
    const statusFilter = String(query.status ?? 'all').toLowerCase();
    const typeFilter = stringOrNull(query.operationType) ? normalizeOperationTypeValue(query.operationType) : null;
    const priorityFilter = stringOrNull(query.priority) ? normalizeOperationPriorityValue(query.priority) : null;
    const minAgeDays = Math.max(0, Number(query.age || 0) || 0);
    const search = String(query.search ?? '').trim().toLowerCase();
    const limit = Math.max(1, Math.min(100, Number(query.limit || 20) || 20));
    const page = Math.max(1, Number(query.page || 1) || 1);
    const forceRefresh = String(query.forceRefresh ?? 'false').toLowerCase() === 'true';

    const operations = await OperationRecord.find({ empresaId, kind: 'task' })
      .select('title type status priority domain assigneeId dueDate payload createdAt updatedAt')
      .lean<OperationDoc[]>();

    const allPending: Array<{
      operationId: string;
      reason: 'UNRESOLVED' | 'AMBIGUOUS';
      operationType: CanonicalOperationType;
      operationStatus: CanonicalOperationStatus;
      priority: CanonicalOperationPriority;
      createdAt: string | null;
      ageDays: number;
      legacyHints: {
        legacyPlateNumber: string | null;
        legacyBoardId: string | null;
        addressHint: string | null;
      };
      possibleCandidatesCount: number;
      lastAttemptAt: string | null;
      safeSummary: ReturnType<typeof safeSummaryOf>;
      sortPriority: number;
    }> = [];

    for (const operation of operations) {
      const payload = operation.payload ?? {};
      if (stringOrNull(payload.plateId)) continue;

      let diagnostic = getCachedDiagnostic(operation);
      if (forceRefresh || !isDiagnosticFresh(diagnostic)) {
        diagnostic = await buildCanonicalizationDiagnostic(empresaId, operation);
        const metadata = getPayloadMetadata(payload);
        await OperationRecord.updateOne(
          { _id: operation._id, empresaId, kind: 'task' },
          {
            $set: {
              payload: {
                ...payload,
                metadata: {
                  ...metadata,
                  canonicalizationDiagnostic: diagnostic,
                },
              },
            },
          },
        );
      }

      if (!diagnostic) continue;
      if (diagnostic.status === 'CANONICAL' || diagnostic.status === 'LEGACY_ONLY') continue;

      const reason = diagnostic.status;
      if (statusFilter === 'unresolved' && reason !== 'UNRESOLVED') continue;
      if (statusFilter === 'ambiguous' && reason !== 'AMBIGUOUS') continue;

      const operationType = normalizeOperationTypeValue(operationTypeOf(operation));
      const operationStatus = normalizeOperationStatusValue(operationStatusOf(operation));
      const priority = normalizeOperationPriorityValue(payload.priority ?? operation.priority);
      const ageDays = ageDaysOf(operation.createdAt);
      const legacyHints = diagnostic.safeHints;
      const possibleCandidatesCount = diagnostic.candidateCount;
      const lastAttemptAt = diagnostic.lastCheckedAt;
      const safeSummary = safeSummaryOf(operation);

      if (typeFilter && operationType !== typeFilter) continue;
      if (priorityFilter && priority !== priorityFilter) continue;
      if (minAgeDays > 0 && ageDays < minAgeDays) continue;
      if (search) {
        const haystack = [
          operation.title,
          operationType,
          operationStatus,
          priority,
          legacyHints.legacyPlateNumber,
          legacyHints.legacyBoardId,
          legacyHints.addressHint,
          safeSummary.domain,
          String(operation._id),
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(search)) continue;
      }

      allPending.push({
        operationId: String(operation._id),
        reason,
        operationType,
        operationStatus,
        priority,
        createdAt: operation.createdAt?.toISOString?.() ?? null,
        ageDays,
        legacyHints,
        possibleCandidatesCount,
        lastAttemptAt,
        safeSummary,
        sortPriority: priorityRankOf(priority),
      });
    }

    allPending.sort((a, b) => {
      if (b.sortPriority !== a.sortPriority) return b.sortPriority - a.sortPriority;
      if (b.ageDays !== a.ageDays) return b.ageDays - a.ageDays;
      return String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? ''));
    });

    const summary = allPending.reduce((acc, item) => {
      acc.total += 1;
      if (item.reason === 'UNRESOLVED') acc.unresolved += 1;
      if (item.reason === 'AMBIGUOUS') acc.ambiguous += 1;
      if (item.ageDays > 7) acc.olderThan7Days += 1;
      if (item.priority === 'CRITICAL') acc.criticalPriority += 1;
      acc.byOperationType[item.operationType] = (acc.byOperationType[item.operationType] ?? 0) + 1;
      return acc;
    }, {
      total: 0,
      unresolved: 0,
      ambiguous: 0,
      olderThan7Days: 0,
      criticalPriority: 0,
      byOperationType: {} as Record<string, number>,
    });

    const total = allPending.length;
    const pages = Math.max(1, Math.ceil(total / limit));
    const items = allPending.slice((page - 1) * limit, page * limit).map(({ sortPriority, ...item }) => item);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        pages,
        hasNextPage: page < pages,
        hasPreviousPage: page > 1,
      },
      summary,
    };
  }

  async listTasks(empresaId: string) {
    const tasks = await OperationRecord.find({ empresaId, kind: 'task' }).sort({ createdAt: -1 }).lean<OperationDoc[]>();
    return { tasks: tasks.map(toTask), total: tasks.length };
  }

  async getPendingTasks(empresaId: string) {
    const tasks = await OperationRecord.find({ empresaId, kind: 'task', status: { $ne: 'completed' } }).sort({ createdAt: -1 }).lean<OperationDoc[]>();
    return { tasks: tasks.map(toTask), count: tasks.length };
  }

  async getByDomain(empresaId: string) {
    const records = await OperationRecord.find({ empresaId }).lean<OperationDoc[]>();
    const byDomain = records.reduce<Record<string, { tasks: number; events: number; pending: number; completed: number }>>((acc, item) => {
      const domain = item.domain || 'system';
      acc[domain] ??= { tasks: 0, events: 0, pending: 0, completed: 0 };
      if (item.kind === 'task') {
        acc[domain].tasks += 1;
        if (item.status === 'completed') acc[domain].completed += 1;
        else acc[domain].pending += 1;
      } else {
        acc[domain].events += 1;
      }
      return acc;
    }, {});
    return { byDomain };
  }

  async createTask(empresaId: string, input: Record<string, unknown>) {
    const payload = await normalizeOperationPayload(input, empresaId);
    const plateId = payload.plateId;
    const startDate = payload.scheduledAt || input.startDate || input.dataInicio || payload.dueAt || input.dueDate;
    const endDate = payload.dueAt || input.endDate || input.dataFim || input.dueDate;

    if (plateId && startDate && endDate) {
      const normalizedStart = toDate(startDate) || new Date(String(startDate));
      const normalizedEnd = toDate(endDate) || new Date(String(endDate));
      if (normalizedEnd <= normalizedStart) {
        normalizedEnd.setDate(normalizedStart.getDate() + 1);
      }
      await temporalEngine.createTemporalReservation({
        empresaId,
        plateId: String(plateId),
        sourceType: 'OPERATION',
        sourceId: String(input.sourceId ?? new mongoose.Types.ObjectId()),
        startDate: normalizedStart,
        endDate: normalizedEnd,
        status: 'RESERVED',
        reason: String(payload.operationType ?? input.type ?? input.title ?? 'Operacao agendada'),
      });
    }

    const record = await OperationRecord.create({
      empresaId,
      kind: 'task',
      title: String(input.title ?? 'Tarefa operacional'),
      domain: String(input.domain ?? 'system'),
      priority: String(input.priority ?? 'normal'),
      status: String(input.status ?? 'pending'),
      assigneeId: input.assigneeId ? String(input.assigneeId) : undefined,
      dueDate: toDate(input.dueDate),
      type: String(payload.operationType ?? input.type ?? 'OTHER'),
      payload,
    });
    return toTask(record.toObject() as OperationDoc);
  }

  async updateTask(empresaId: string, id: string, input: Record<string, unknown>) {
    const current = await findTask(empresaId, id);
    const updated = await OperationRecord.findOneAndUpdate(
      { _id: id, empresaId, kind: 'task' },
      {
        $set: {
          title: input.title !== undefined ? String(input.title) : current.title,
          domain: input.domain !== undefined ? String(input.domain) : current.domain,
          priority: input.priority !== undefined ? String(input.priority) : current.priority,
          status: input.status !== undefined ? String(input.status) : current.status,
          assigneeId: input.assigneeId !== undefined ? String(input.assigneeId) : current.assigneeId,
          dueDate: input.dueDate !== undefined ? toDate(input.dueDate) : current.dueDate,
          payload: { ...current.payload, ...input },
        },
      },
      { new: true },
    ).lean<OperationDoc>();
    if (!updated) throw new AppError('Tarefa operacional nao encontrada.', 404);
    return toTask(updated);
  }

  async getById(empresaId: string, id: string) {
    const task = await findTask(empresaId, id);
    return toTask(task);
  }

  async startTask(empresaId: string, id: string, input: Record<string, unknown> = {}) {
    const task = await findTask(empresaId, id);
    const currentStatus = normalizeOperationStatusValue(
      (task.payload as Record<string, unknown>)?.operationStatus ?? task.status,
    );
    if (currentStatus === 'DONE' || currentStatus === 'CANCELLED') {
      throw new AppError(`Operacao nao pode ser iniciada: status atual e ${currentStatus}.`, 409);
    }
    if (currentStatus === 'IN_PROGRESS') {
      throw new AppError('Operacao ja esta em andamento.', 409);
    }

    const now = new Date();
    const payload = task.payload ?? {};
    const operationType = normalizeOperationTypeValue(payload.operationType ?? task.type ?? 'OTHER');

    const updated = await OperationRecord.findOneAndUpdate(
      { _id: id, empresaId, kind: 'task' },
      {
        $set: {
          status: 'IN_PROGRESS',
          payload: {
            ...payload,
            operationStatus: 'IN_PROGRESS',
            startedAt: now.toISOString(),
            updatedBy: stringOrNull(input.updatedBy) ?? payload.updatedBy ?? null,
          },
        },
      },
      { new: true },
    ).lean<OperationDoc>();
    if (!updated) throw new AppError('Tarefa operacional nao encontrada.', 404);

    const timelineType = operationType === 'BLOCK' ? 'OPERATION_PLATE_BLOCKED' : 'OPERATION_STARTED';
    await OperationRecord.create({
      empresaId,
      kind: 'event',
      type: timelineType,
      domain: task.domain ?? 'operations',
      status: 'created',
      payload: {
        operationId: id,
        operationType,
        plateId: stringOrNull(payload.plateId),
        regionId: stringOrNull(payload.regionId),
        startedAt: now.toISOString(),
        startedBy: stringOrNull(input.startedBy) ?? stringOrNull(input.updatedBy),
      },
    });

    return toTask(updated);
  }

  async completeTask(empresaId: string, id: string, input: Record<string, unknown> = {}) {
    const task = await findTask(empresaId, id);
    const now = new Date();
    const payload = task.payload ?? {};
    const operationType = normalizeOperationTypeValue(payload.operationType ?? task.type ?? 'OTHER');

    const newAddress = stringOrNull(input.newAddress ?? input.address);
    const newLat = input.newLatitude != null ? Number(input.newLatitude) : null;
    const newLon = input.newLongitude != null ? Number(input.newLongitude) : null;
    const plateId = stringOrNull(payload.plateId);

    if (operationType === 'INSTALLATION' && plateId && (newAddress || (newLat != null && newLon != null))) {
      const changedFields: string[] = [];
      if (newAddress) changedFields.push('nomeDaRua', 'endereco', 'localizacao');
      if (newLat != null && newLon != null) changedFields.push('latitude', 'longitude', 'coordenadas');

      await temporalEngine.assertPlateCanBeEdited(plateId, changedFields, {
        empresaId,
        createdBy: stringOrNull(input.updatedBy) ?? undefined,
      });

      const plateUpdate: Record<string, unknown> = {};
      if (newAddress) {
        plateUpdate.nomeDaRua = newAddress;
        plateUpdate.endereco = newAddress;
        plateUpdate.localizacao = newAddress;
      }
      if (newLat != null && newLon != null) {
        plateUpdate.latitude = newLat;
        plateUpdate.longitude = newLon;
      }

      await Placa.updateOne({ _id: plateId, empresaId: empresaQuery(empresaId) }, { $set: plateUpdate });

      await temporalEngine.recordEvent({
        empresaId,
        plateId,
        sourceType: 'OPERATION',
        sourceId: id,
        eventType: 'TEMPORAL_PLATE_RELEASED',
        message: `Instalacao concluida: endereco/coordenadas atualizados pela operacao ${id}.`,
        metadata: { operationId: id, newAddress, newLat, newLon },
        createdBy: stringOrNull(input.updatedBy) ?? undefined,
      });
    }

    const timelineType = operationType === 'INSTALLATION' ? 'OPERATION_INSTALLATION_COMPLETED'
      : operationType === 'SCRAPING' ? 'OPERATION_SCRAPING_COMPLETED'
      : operationType === 'MAINTENANCE' ? 'OPERATION_MAINTENANCE_COMPLETED'
      : operationType === 'BLOCK' ? 'OPERATION_PLATE_UNBLOCKED'
      : 'OPERATION_COMPLETED';

    const extraPayload: Record<string, unknown> = {};
    if (newAddress) extraPayload.installationAddress = newAddress;
    if (newLat != null) { extraPayload.installationLatitude = newLat; extraPayload.installationLongitude = newLon; }

    const updated = await OperationRecord.findOneAndUpdate(
      { _id: id, empresaId, kind: 'task' },
      {
        $set: {
          status: 'completed',
          completedAt: now,
          payload: {
            ...payload,
            ...extraPayload,
            operationStatus: 'DONE',
            completedAt: now.toISOString(),
            updatedBy: stringOrNull(input.updatedBy) ?? payload.updatedBy ?? null,
          },
        },
      },
      { new: true },
    ).lean<OperationDoc>();
    if (!updated) throw new AppError('Tarefa operacional nao encontrada.', 404);

    await OperationRecord.create({
      empresaId,
      kind: 'event',
      type: timelineType,
      domain: task.domain ?? 'operations',
      status: 'created',
      payload: {
        operationId: id,
        operationType,
        plateId: stringOrNull(payload.plateId),
        regionId: stringOrNull(payload.regionId),
        completedAt: now.toISOString(),
        completedBy: stringOrNull(input.completedBy) ?? stringOrNull(input.updatedBy),
        ...(newAddress ? { newAddress } : {}),
        ...(newLat != null ? { newLatitude: newLat, newLongitude: newLon } : {}),
      },
    });

    return toTask(updated);
  }

  async cancelTask(empresaId: string, id: string, input: Record<string, unknown> = {}) {
    const task = await findTask(empresaId, id);
    const currentStatus = normalizeOperationStatusValue(
      (task.payload as Record<string, unknown>)?.operationStatus ?? task.status,
    );
    if (currentStatus === 'DONE') {
      throw new AppError('Operacao concluida nao pode ser cancelada.', 409);
    }
    if (currentStatus === 'CANCELLED') {
      throw new AppError('Operacao ja esta cancelada.', 409);
    }

    const now = new Date();
    const payload = task.payload ?? {};
    const operationType = normalizeOperationTypeValue(payload.operationType ?? task.type ?? 'OTHER');

    const updated = await OperationRecord.findOneAndUpdate(
      { _id: id, empresaId, kind: 'task' },
      {
        $set: {
          status: 'CANCELLED',
          payload: {
            ...payload,
            operationStatus: 'CANCELLED',
            cancelledAt: now.toISOString(),
            cancellationReason: stringOrNull(input.reason) ?? stringOrNull(input.notes) ?? null,
            updatedBy: stringOrNull(input.updatedBy) ?? payload.updatedBy ?? null,
          },
        },
      },
      { new: true },
    ).lean<OperationDoc>();
    if (!updated) throw new AppError('Tarefa operacional nao encontrada.', 404);

    const timelineType = operationType === 'BLOCK' ? 'OPERATION_PLATE_UNBLOCKED' : 'OPERATION_CANCELLED';
    await OperationRecord.create({
      empresaId,
      kind: 'event',
      type: timelineType,
      domain: task.domain ?? 'operations',
      status: 'created',
      payload: {
        operationId: id,
        operationType,
        plateId: stringOrNull(payload.plateId),
        regionId: stringOrNull(payload.regionId),
        cancelledAt: now.toISOString(),
        reason: stringOrNull(input.reason),
        cancelledBy: stringOrNull(input.cancelledBy) ?? stringOrNull(input.updatedBy),
      },
    });

    return toTask(updated);
  }

  async assignTask(empresaId: string, id: string, assigneeId: string) {
    await findTask(empresaId, id);
    const updated = await OperationRecord.findOneAndUpdate(
      { _id: id, empresaId, kind: 'task' },
      { $set: { assigneeId } },
      { new: true },
    ).lean<OperationDoc>();
    if (!updated) throw new AppError('Tarefa operacional nao encontrada.', 404);
    return toTask(updated);
  }

  async listOperations(empresaId: string, query: Record<string, unknown> = {}) {
    const filter: Record<string, unknown> = { empresaId, kind: 'task' };

    const rawType = query.type ?? query.operationType;
    if (rawType) filter['payload.operationType'] = normalizeOperationTypeValue(rawType);

    const rawStatus = query.status ?? query.operationStatus;
    if (rawStatus) filter['payload.operationStatus'] = normalizeOperationStatusValue(rawStatus);

    const rawPriority = query.priority;
    if (rawPriority) filter['payload.priority'] = normalizeOperationPriorityValue(rawPriority);

    const rawPlateId = stringOrNull(query.plateId);
    if (rawPlateId) filter['payload.plateId'] = rawPlateId;

    const rawRegionId = stringOrNull(query.regionId);
    if (rawRegionId) filter['payload.regionId'] = rawRegionId;

    const tasks = await OperationRecord.find(filter).sort({ createdAt: -1 }).lean<OperationDoc[]>();
    let result = tasks.map(toTask);

    const rawSlaStatus = stringOrNull(query.slaStatus);
    if (rawSlaStatus) {
      const target = rawSlaStatus.toUpperCase();
      result = result.filter((task) => task.slaStatus === target);
    }

    return { tasks: result, total: result.length };
  }

  async getByPlate(empresaId: string, plateId: string) {
    if (!mongoose.Types.ObjectId.isValid(plateId)) throw new AppError('plateId invalido.', 400);
    const tasks = await OperationRecord.find({
      empresaId,
      kind: 'task',
      'payload.plateId': plateId,
    }).sort({ createdAt: -1 }).lean<OperationDoc[]>();
    return { tasks: tasks.map(toTask), total: tasks.length };
  }

  async getByRegion(empresaId: string, regionId: string) {
    if (!mongoose.Types.ObjectId.isValid(regionId)) throw new AppError('regionId invalido.', 400);
    const tasks = await OperationRecord.find({
      empresaId,
      kind: 'task',
      'payload.regionId': regionId,
    }).sort({ createdAt: -1 }).lean<OperationDoc[]>();
    return { tasks: tasks.map(toTask), total: tasks.length };
  }

  async createEvent(empresaId: string, input: Record<string, unknown>) {
    const record = await OperationRecord.create({
      empresaId,
      kind: 'event',
      type: String(input.type ?? 'manual'),
      domain: String(input.domain ?? 'system'),
      status: 'created',
      payload: input.payload && typeof input.payload === 'object'
        ? input.payload as Record<string, unknown>
        : input,
    });
    return toEvent(record.toObject() as OperationDoc);
  }

  async getLinkResolutionContext(empresaId: string, operationId: string) {
    const operation = await findTask(empresaId, operationId);
    const payload = operation.payload ?? {};
    const candidates: ReturnType<typeof safePlateCandidate>[] = [];
    let reason = 'no-safe-match';

    for (const candidate of getLegacyIdCandidates(payload)) {
      const plate = await findPlateForOperation(empresaId, candidate);
      if (plate) candidates.push(safePlateCandidate(plate, 'legacyId', candidate));
    }

    for (const candidate of getPlateNumberCandidates(payload)) {
      const plates = await findPlatesByNumberForOperation(empresaId, candidate);
      if (plates.length > 1) reason = 'ambiguous-plateNumber';
      if (plates.length === 1) reason = 'legacy-plate-number';
      plates.forEach((plate) => candidates.push(safePlateCandidate(plate, 'plateNumber', candidate)));
    }

    if (hasAddressDiagnostic(payload) && candidates.length === 0) {
      reason = 'address-only-diagnostic';
    }

    const uniqueCandidates = Array.from(
      new Map(candidates.map((candidate) => [candidate.plateId, candidate])).values(),
    );

    return {
      operation: safeOperationSample(operation, reason),
      candidates: uniqueCandidates,
      reason,
      legacyFields: {
        legacyIds: getLegacyIdCandidates(payload),
        plateNumbers: getPlateNumberCandidates(payload),
        addressHint: stringOrNull(payload.address) ?? stringOrNull(payload.endereco),
      },
    };
  }

  async resolveOperationPlateLink(
    empresaId: string,
    operationId: string,
    plateId: string,
    input: { reason?: unknown; resolvedBy?: string | null } = {},
  ) {
    const operation = await findTask(empresaId, operationId);
    const plate = await findPlateForOperation(empresaId, plateId);
    if (!plate) throw new AppError('Placa da operacao nao encontrada para a empresa.', 404);

    const now = new Date();
    const payload = operation.payload ?? {};
    const metadata = payload.metadata && typeof payload.metadata === 'object'
      ? payload.metadata as Record<string, unknown>
      : {};
    const nextPayload = {
      ...payload,
      plateId: String(plate._id),
      regionId: getPlateRegionId(plate),
      regionalLot: getPlateRegionalLot(plate),
      operationType: normalizeOperationTypeValue(payload.operationType ?? payload.type ?? operation.type ?? operation.title),
      operationStatus: normalizeOperationStatusValue(payload.operationStatus ?? payload.status ?? operation.status),
      priority: normalizeOperationPriorityValue(payload.priority ?? operation.priority),
      operationScope: normalizeOperationScope(payload.operationScope, String(plate._id)),
      metadata: {
        ...metadata,
        manualResolution: true,
        manualResolutionReason: stringOrNull(input.reason) ?? 'Correcao manual da operacao legacy',
        manualResolvedAt: now.toISOString(),
        manualResolvedBy: input.resolvedBy ?? null,
        canonicalizationDiagnostic: {
          status: 'CANONICAL',
          reason: 'manual-resolution',
          lastCheckedAt: now.toISOString(),
          candidateCount: 1,
          matchedBy: 'plateId',
          safeHints: getSafeHints(payload),
        } satisfies CanonicalizationDiagnostic,
      },
    };

    const updated = await OperationRecord.findOneAndUpdate(
      { _id: operation._id, empresaId, kind: 'task' },
      { $set: { payload: nextPayload } },
      { new: true },
    ).lean<OperationDoc>();
    if (!updated) throw new AppError('Tarefa operacional nao encontrada.', 404);

    return {
      task: toTask(updated),
      before: safeOperationSample(operation, 'before-manual-resolution'),
      after: safeOperationSample(updated, 'manual-resolution'),
      plate: safePlateCandidate(plate, 'manual', String(plate._id)),
    };
  }

  async backfillOperationPlateLinks(empresaId: string) {
    const report = {
      totalAnalyzed: 0,
      updated: 0,
      skippedAlreadyCanonical: 0,
      unresolved: 0,
      ambiguous: 0,
      matchedById: 0,
      matchedByLegacyId: 0,
      matchedByPlateNumber: 0,
      errors: [] as Array<{ operationId: string; message: string }>,
    };

    const operations = await OperationRecord.find({ empresaId, kind: 'task' }).lean<OperationDoc[]>();
    report.totalAnalyzed = operations.length;

    for (const operation of operations) {
      const operationId = String(operation._id);
      const payload = operation.payload ?? {};

      if (stringOrNull(payload.plateId)) {
        const diagnostic = await buildCanonicalizationDiagnostic(empresaId, operation);
        const metadata = getPayloadMetadata(payload);
        await OperationRecord.updateOne(
          { _id: operation._id, empresaId, kind: 'task' },
          { $set: { payload: { ...payload, metadata: { ...metadata, canonicalizationDiagnostic: diagnostic } } } },
        );
        report.skippedAlreadyCanonical += 1;
        continue;
      }

      try {
        const resolution = await resolvePlateForBackfill(empresaId, payload);
        const diagnostic = await buildCanonicalizationDiagnostic(empresaId, operation);
        const metadata = getPayloadMetadata(payload);
        if (resolution.status === 'ambiguous') {
          await OperationRecord.updateOne(
            { _id: operation._id, empresaId, kind: 'task' },
            { $set: { payload: { ...payload, metadata: { ...metadata, canonicalizationDiagnostic: diagnostic } } } },
          );
          report.ambiguous += 1;
          continue;
        }
        if (resolution.status === 'unresolved') {
          await OperationRecord.updateOne(
            { _id: operation._id, empresaId, kind: 'task' },
            { $set: { payload: { ...payload, metadata: { ...metadata, canonicalizationDiagnostic: diagnostic } } } },
          );
          report.unresolved += 1;
          continue;
        }

        const { plate, candidate, source } = resolution;

        const canonicalPayload = {
          ...payload,
          plateId: String(plate._id),
          placaId: payload.placaId ?? candidate,
          boardId: payload.boardId ?? candidate,
          regionId: getPlateRegionId(plate),
          regionalLot: getPlateRegionalLot(plate),
          operationType: normalizeOperationTypeValue(payload.operationType ?? payload.type ?? operation.type ?? operation.title),
          operationStatus: normalizeOperationStatusValue(payload.operationStatus ?? payload.status ?? operation.status),
          priority: normalizeOperationPriorityValue(payload.priority ?? operation.priority),
          operationScope: normalizeOperationScope(payload.operationScope, String(plate._id)),
          metadata: {
            ...metadata,
            canonicalizationDiagnostic: {
              ...diagnostic,
              status: 'CANONICAL',
              reason: `backfill-${source}`,
              matchedBy: sourceToMatchedBy(source, candidate, payload),
              candidateCount: 1,
            } satisfies CanonicalizationDiagnostic,
          },
        };

        await OperationRecord.updateOne(
          { _id: operation._id, empresaId, kind: 'task' },
          { $set: { payload: canonicalPayload } },
        );
        report.updated += 1;
        if (source === 'plateId') report.matchedById += 1;
        if (source === 'legacyId') report.matchedByLegacyId += 1;
        if (source === 'plateNumber') report.matchedByPlateNumber += 1;
      } catch (error: any) {
        report.errors.push({ operationId, message: error?.message ?? 'Erro desconhecido' });
      }
    }

    return report;
  }
}
