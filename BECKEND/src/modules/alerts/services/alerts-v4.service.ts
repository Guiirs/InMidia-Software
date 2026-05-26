import mongoose, { Model, Schema } from 'mongoose';
import AppError from '@shared/container/AppError';
import { resolveOperationPlateId, resolveOperationSla } from '@modules/operations/services/operations-v4.service';

type AlertDoc = {
  _id: mongoose.Types.ObjectId;
  empresaId: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  domain: string;
  status: 'open' | 'read' | 'dismissed' | 'resolved';
  read: boolean;
  resolution?: string;
  payload: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
};

const alertSchema = new Schema<AlertDoc>({
  empresaId: { type: String, required: true, index: true },
  type: { type: String, required: true },
  severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'info', index: true },
  message: { type: String, required: true },
  domain: { type: String, default: 'system', index: true },
  status: { type: String, enum: ['open', 'read', 'dismissed', 'resolved'], default: 'open', index: true },
  read: { type: Boolean, default: false, index: true },
  resolution: { type: String },
  payload: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true, collection: 'alerts_v4_records' });

alertSchema.index({ empresaId: 1, status: 1, createdAt: -1 });

export const AlertRecord: Model<AlertDoc> = (mongoose.models.AlertV4Record as Model<AlertDoc> | undefined)
  || mongoose.model<AlertDoc>('AlertV4Record', alertSchema);

function toSeveridadeLegacy(severity: string): string {
  if (severity === 'critical') return 'critical';
  if (severity === 'warning') return 'medium';
  return 'info';
}

function toEstadoLegacy(severity: string): string {
  if (severity === 'critical') return 'critical';
  if (severity === 'warning') return 'warning';
  return 'healthy';
}

function toPriorityLegacy(severity: string): string {
  if (severity === 'critical') return 'urgent';
  if (severity === 'warning') return 'high';
  return 'normal';
}

function toAlert(doc: AlertDoc) {
  const id = String(doc._id);
  const p = doc.payload ?? {};
  const plateId = resolveOperationPlateId(p);
  const regionId = (p.regionId as string | undefined) ?? null;
  const title = (p.title as string) ?? doc.message;
  const description = (p.description as string) ?? doc.message;
  const category = (p.category as string) ?? doc.domain;
  const owner = (p.owner as string) ?? '—';
  const sla = (p.sla as string) ?? '24h';
  const region = (p.region as string) ?? 'Todos';
  const impact = (p.impact as string) ?? 'Monitorar';
  const recommendation = (p.recommendation as string) ?? null;

  return {
    id,
    realId: id,
    type: doc.type,
    severity: doc.severity,
    message: doc.message,
    title,
    description,
    category,
    domain: doc.domain,
    region,
    owner,
    sla,
    impact,
    recommendation,
    plateId,
    regionId,
    status: doc.status,
    read: doc.read,
    lido: doc.read,
    resolution: doc.resolution ?? null,
    payload: p,
    createdAt: doc.createdAt?.toISOString?.() ?? null,
    updatedAt: doc.updatedAt?.toISOString?.() ?? null,
    // Legacy aliases for frontend UI components
    titulo: title,
    descricao: description,
    severidade: toSeveridadeLegacy(doc.severity),
    categoria: category,
    estado: toEstadoLegacy(doc.severity),
    prioridade: toPriorityLegacy(doc.severity),
    impacto: impact,
    acao: recommendation,
    regioesAfetadas: [region],
    timestamp: doc.createdAt?.toISOString?.() ?? null,
    historico: [] as { tempo: string; evento: string }[],
  };
}

export function prepareOperationSlaAlert(operation: { _id?: unknown; id?: unknown; title?: unknown; payload?: Record<string, unknown>; priority?: unknown; status?: unknown; dueDate?: unknown; completedAt?: unknown; createdAt?: unknown }) {
  const sla = resolveOperationSla(operation);
  const plateId = resolveOperationPlateId(operation);
  const payload = operation.payload ?? {};
  const regionId = (payload.regionId as string | undefined) ?? null;
  const operationId = operation._id ?? operation.id;

  if (sla.slaStatus === 'OVERDUE' && sla.slaPriority === 'CRITICAL') {
    return {
      type: 'OPERATION_SLA_OVERDUE',
      severity: 'critical' as const,
      domain: 'operations',
      message: `Operacao critica atrasada: ${String(operation.title ?? operationId ?? '')}`.trim(),
      payload: {
        operationId: operationId ? String(operationId) : null,
        plateId,
        regionId,
        slaStatus: sla.slaStatus,
        slaPriority: sla.slaPriority,
        overdueMinutes: sla.overdueMinutes,
        referenceDueAt: sla.referenceDueAt,
      },
    };
  }

  if (sla.slaStatus === 'DUE_SOON') {
    return {
      type: 'OPERATION_SLA_DUE_SOON',
      severity: 'warning' as const,
      domain: 'operations',
      message: `Operacao vencendo em breve: ${String(operation.title ?? operationId ?? '')}`.trim(),
      payload: {
        operationId: operationId ? String(operationId) : null,
        plateId,
        regionId,
        slaStatus: sla.slaStatus,
        slaPriority: sla.slaPriority,
        referenceDueAt: sla.referenceDueAt,
      },
    };
  }

  return null;
}

async function findAlert(empresaId: string, id: string): Promise<AlertDoc> {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError('Alerta invalido.', 400);
  const alert = await AlertRecord.findOne({ _id: id, empresaId }).lean<AlertDoc>();
  if (!alert) throw new AppError('Alerta nao encontrado.', 404);
  return alert;
}

export class AlertsV4Service {
  async listAlerts(empresaId: string) {
    const alerts = await AlertRecord.find({ empresaId }).sort({ createdAt: -1 }).lean<AlertDoc[]>();
    return { alerts: alerts.map(toAlert), total: alerts.length, unread: alerts.filter((item) => !item.read).length };
  }

  async getSummary(empresaId: string) {
    const alerts = await AlertRecord.find({ empresaId }).lean<AlertDoc[]>();
    const criticalCount = alerts.filter((a) => a.severity === 'critical' && a.status !== 'resolved').length;
    const warningCount = alerts.filter((a) => a.severity === 'warning' && a.status !== 'resolved').length;
    const infoCount = alerts.filter((a) => a.severity === 'info' && a.status !== 'resolved').length;
    const resolvedCount = alerts.filter((a) => a.status === 'resolved').length;
    const dismissedCount = alerts.filter((a) => a.status === 'dismissed').length;
    const unreadCount = alerts.filter((a) => !a.read).length;
    const openCount = alerts.filter((a) => a.status !== 'resolved' && a.status !== 'dismissed').length;

    const byDomainMap = new Map<string, number>();
    alerts.forEach((alert) => byDomainMap.set(alert.domain, (byDomainMap.get(alert.domain) ?? 0) + 1));

    return {
      // Backward compat
      total: alerts.length,
      critical: criticalCount,
      unread: unreadCount,
      byDomain: Array.from(byDomainMap.entries()).map(([domain, count]) => ({ domain, count })),
      // New rich fields consumed by AlertsProvider
      totals: {
        open: openCount,
        critical: criticalCount,
        warning: warningCount,
        info: infoCount,
        resolved: resolvedCount,
        dismissed: dismissedCount,
      },
      severityOverview: {
        critical: { count: criticalCount, cor: 'var(--v4p-danger)',  label: 'Critico' },
        high:     { count: warningCount,  cor: 'var(--v4p-warning)', label: 'Alto' },
        medium:   { count: 0,             cor: 'var(--v4p-warning)', label: 'Medio' },
        low:      { count: 0,             cor: 'var(--v4p-text-4)',  label: 'Baixo' },
        info:     { count: infoCount,     cor: 'var(--v4p-info)',    label: 'Informativo' },
      },
      generatedAt: new Date().toISOString(),
    };
  }

  async getCritical(empresaId: string) {
    const alerts = await AlertRecord.find({ empresaId, severity: 'critical', status: { $ne: 'resolved' } }).sort({ createdAt: -1 }).lean<AlertDoc[]>();
    return { alerts: alerts.map(toAlert) };
  }

  async getUnread(empresaId: string) {
    const alerts = await AlertRecord.find({ empresaId, read: false }).sort({ createdAt: -1 }).lean<AlertDoc[]>();
    return { alerts: alerts.map(toAlert), count: alerts.length };
  }

  async getByDomain(empresaId: string) {
    const alerts = await AlertRecord.find({ empresaId }).sort({ createdAt: -1 }).lean<AlertDoc[]>();
    const byDomain = alerts.reduce<Record<string, ReturnType<typeof toAlert>[]>>((acc, alert) => {
      const domain = alert.domain || 'system';
      acc[domain] = [...(acc[domain] ?? []), toAlert(alert)];
      return acc;
    }, {});
    return { byDomain };
  }

  async markRead(empresaId: string, id: string) {
    await findAlert(empresaId, id);
    const alert = await AlertRecord.findOneAndUpdate(
      { _id: id, empresaId },
      { $set: { read: true, status: 'read' } },
      { new: true },
    ).lean<AlertDoc>();
    if (!alert) throw new AppError('Alerta nao encontrado.', 404);
    return toAlert(alert);
  }

  async markAllRead(empresaId: string) {
    const result = await AlertRecord.updateMany({ empresaId, read: false }, { $set: { read: true, status: 'read' } });
    return { count: result.modifiedCount ?? 0 };
  }

  async dismiss(empresaId: string, id: string) {
    await findAlert(empresaId, id);
    const alert = await AlertRecord.findOneAndUpdate(
      { _id: id, empresaId },
      { $set: { read: true, status: 'dismissed' } },
      { new: true },
    ).lean<AlertDoc>();
    if (!alert) throw new AppError('Alerta nao encontrado.', 404);
    return toAlert(alert);
  }

  async resolve(empresaId: string, id: string, resolution?: string) {
    await findAlert(empresaId, id);
    const alert = await AlertRecord.findOneAndUpdate(
      { _id: id, empresaId },
      { $set: { read: true, status: 'resolved', resolution } },
      { new: true },
    ).lean<AlertDoc>();
    if (!alert) throw new AppError('Alerta nao encontrado.', 404);
    return toAlert(alert);
  }

  async createManual(empresaId: string, input: Record<string, unknown>) {
    const payload = { ...input };
    const plateId = resolveOperationPlateId(payload);
    if (plateId) payload.plateId = plateId;

    const record = await AlertRecord.create({
      empresaId,
      type: String(input.type ?? 'manual'),
      severity: ['info', 'warning', 'critical'].includes(String(input.severity))
        ? String(input.severity) as AlertDoc['severity']
        : 'info',
      message: String(input.message ?? input.title ?? 'Alerta manual'),
      domain: String(input.domain ?? 'system'),
      status: 'open',
      read: false,
      payload,
    });
    return toAlert(record.toObject() as AlertDoc);
  }
}
