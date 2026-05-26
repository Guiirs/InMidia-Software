/**
 * DashboardV4Service — dados reais dos domínios V4.
 * Não depende de DashboardService v1.
 */

import mongoose, { Model } from 'mongoose';
import Placa from '@modules/placas/Placa';
import Aluguel from '@modules/alugueis/Aluguel';
import { resolveOperationPlateId, resolveOperationSla } from '@modules/operations/services/operations-v4.service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function safeOid(id: string): mongoose.Types.ObjectId | null {
  return mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null;
}

function getModel<T>(name: string): Model<T> | null {
  return (mongoose.models[name] as Model<T> | undefined) ?? null;
}

function rate(part: number, total: number): number {
  if (!total) return 0;
  return Number(((part / total) * 100).toFixed(2));
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class DashboardV4Service {

  // ── KPIs ───────────────────────────────────────────────────────────────────

  async getKpis(empresaId: string) {
    const oid = safeOid(empresaId);
    const now = new Date();

    const alertModel  = getModel<{ empresaId: string; severity: string; status: string }>('AlertV4Record');
    const opModel     = getModel<{ empresaId: string; kind: string; status: string; type?: string; priority?: string; payload?: Record<string, unknown> }>('OperationV4Record');
    const comModel    = getModel<{ empresaId: string; kind: string; value?: number; status?: string }>('CommercialV4Record');

    const [
      totalBoards,
      availableBoards,
      activeContracts,
      criticalAlerts,
      pendingTasks,
      pipelineAgg,
    ] = await Promise.all([
      oid ? Placa.countDocuments({ empresaId: oid }) : 0,
      oid ? Placa.countDocuments({ empresaId: oid, disponivel: true }) : 0,
      oid ? Aluguel.countDocuments({
        empresaId: oid,
        status: { $ne: 'cancelado' },
        $or: [
          { startDate: { $lte: now }, endDate: { $gte: now } },
          { data_inicio: { $lte: now }, data_fim: { $gte: now } },
        ],
      }) : 0,
      alertModel?.countDocuments({ empresaId, severity: 'critical', status: 'open' }) ?? 0,
      opModel?.countDocuments({ empresaId, kind: 'task', status: 'pending' }) ?? 0,
      comModel?.aggregate([
        { $match: { empresaId, kind: { $in: ['opportunity', 'proposal'] } } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$value', 0] } } } },
      ]) ?? [],
    ]);

    const occupiedBoards = totalBoards - availableBoards;
    const occupancyRate  = rate(occupiedBoards, totalBoards);
    const commercialPipelineValue = (pipelineAgg as Array<{ total: number }>)[0]?.total ?? 0;

    const operations = opModel
      ? await opModel.find({ empresaId, kind: 'task' }).select('status type priority payload dueDate completedAt createdAt').lean()
      : [];
    const linkedOperations = (operations as any[]).filter((operation) => resolveOperationPlateId(operation));
    const slaList = (operations as any[]).map((operation) => resolveOperationSla(operation));
    const activeOperations = (operations as any[]).filter((operation) => {
      const sla = resolveOperationSla(operation);
      return sla.slaStatus !== 'RESOLVED' && sla.slaStatus !== 'CANCELLED';
    });
    const resolvedWithTime = slaList.filter((sla) => typeof sla.resolutionMinutes === 'number') as Array<typeof slaList[number] & { resolutionMinutes: number }>;
    const overdueOperations = slaList.filter((sla) => sla.slaStatus === 'OVERDUE').length;
    const dueSoonOperations = slaList.filter((sla) => sla.slaStatus === 'DUE_SOON').length;
    const criticalBacklog = activeOperations.filter((operation) => resolveOperationSla(operation).slaPriority === 'CRITICAL').length;
    const highPriorityBacklog = activeOperations.filter((operation) => resolveOperationSla(operation).slaPriority === 'HIGH').length;

    return {
      totalBoards,
      availableBoards,
      occupiedBoards,
      occupancyRate,
      activeContracts,
      monthlyRevenue: 0,
      commercialPipelineValue,
      criticalAlerts,
      pendingTasks,
      operations: {
        pending: activeOperations.length,
        backlog: activeOperations.length,
        linkedToPlate: linkedOperations.length,
        installations: activeOperations.filter((operation) => String(operation.payload?.operationType ?? operation.type ?? '').toUpperCase() === 'INSTALLATION').length,
        scrapings: activeOperations.filter((operation) => String(operation.payload?.operationType ?? operation.type ?? '').toUpperCase() === 'SCRAPING').length,
        maintenances: activeOperations.filter((operation) => String(operation.payload?.operationType ?? operation.type ?? '').toUpperCase() === 'MAINTENANCE').length,
        blocks: activeOperations.filter((operation) => String(operation.payload?.operationType ?? operation.type ?? '').toUpperCase() === 'BLOCK').length,
        critical: activeOperations.filter((operation) => String(operation.payload?.priority ?? operation.priority ?? '').toUpperCase() === 'CRITICAL').length,
        overdueOperations,
        dueSoonOperations,
        resolvedOperations: slaList.filter((sla) => sla.slaStatus === 'RESOLVED').length,
        averageResolutionMinutes: resolvedWithTime.length
          ? Math.round(resolvedWithTime.reduce((sum, sla) => sum + sla.resolutionMinutes, 0) / resolvedWithTime.length)
          : null,
        criticalBacklog,
        highPriorityBacklog,
        operationsSlaHealth: overdueOperations > 0 || criticalBacklog > 0
          ? 'CRITICAL'
          : dueSoonOperations > 0 || highPriorityBacklog > 0
            ? 'ATTENTION'
            : 'HEALTHY',
        backlogByPriority: {
          critical: criticalBacklog,
          high: highPriorityBacklog,
          medium: activeOperations.filter((operation) => resolveOperationSla(operation).slaPriority === 'MEDIUM').length,
          low: activeOperations.filter((operation) => resolveOperationSla(operation).slaPriority === 'LOW').length,
        },
      },
    };
  }

  // ── Overview ───────────────────────────────────────────────────────────────

  async getOverview(empresaId: string) {
    const oid = safeOid(empresaId);

    const alertModel  = getModel<{ empresaId: string; status: string }>('AlertV4Record');
    const opModel     = getModel<{ empresaId: string; kind: string; status: string }>('OperationV4Record');
    const comModel    = getModel<{ empresaId: string; kind: string }>('CommercialV4Record');

    const [regionsRaw, alertsTotal, opTasksTotal, comTotal, reportsTotal, alugeisTotal] = await Promise.all([
      oid ? Placa.aggregate([
        { $match: { empresaId: oid } },
        { $group: {
          _id: '$regiaoId',
          total: { $sum: 1 },
          available: { $sum: { $cond: ['$disponivel', 1, 0] } },
        }},
        { $lookup: { from: 'regioes', localField: '_id', foreignField: '_id', as: 'r' } },
        { $unwind: { path: '$r', preserveNullAndEmptyArrays: true } },
        { $sort: { total: -1 } },
      ]) : [],
      alertModel?.countDocuments({ empresaId }) ?? 0,
      opModel?.countDocuments({ empresaId, kind: 'task' }) ?? 0,
      comModel?.countDocuments({ empresaId }) ?? 0,
      getModel('ReportV4Record')?.countDocuments({ empresaId }) ?? 0,
      oid ? Aluguel.countDocuments({ empresaId: oid }) : 0,
    ]);

    type RegionRow = { _id: unknown; total: number; available: number; r?: { nome?: string } };

    return {
      regions: (regionsRaw as RegionRow[]).map((r) => ({
        regionId:  String(r._id ?? ''),
        name:      r.r?.nome ?? 'Sem região',
        total:     r.total,
        available: r.available,
        occupied:  r.total - r.available,
        occupancyRate: rate(r.total - r.available, r.total),
      })),
      domains: {
        inventory:  { total: (regionsRaw as RegionRow[]).reduce((s, r) => s + r.total, 0) },
        contracts:  { total: alugeisTotal },
        commercial: { total: comTotal },
        alerts:     { total: alertsTotal },
        operations: { total: opTasksTotal },
        reports:    { total: reportsTotal },
      },
    };
  }

  // ── Activity ───────────────────────────────────────────────────────────────

  async getActivity(empresaId: string) {
    const oid  = safeOid(empresaId);
    const since = daysAgo(30);
    const LIMIT = 20;

    const alertModel = getModel<{ empresaId: string; type: string; message: string; severity: string; createdAt?: Date }>('AlertV4Record');
    const opModel    = getModel<{ empresaId: string; kind: string; title?: string; type?: string; domain: string; payload?: Record<string, unknown>; createdAt?: Date }>('OperationV4Record');

    const [recentAlerts, recentOps, recentAlugueis] = await Promise.all([
      alertModel?.find({ empresaId, createdAt: { $gte: since } })
        .sort({ createdAt: -1 }).limit(LIMIT).lean() ?? [],
      opModel?.find({ empresaId, createdAt: { $gte: since } })
        .sort({ createdAt: -1 }).limit(LIMIT).lean() ?? [],
      oid ? Aluguel.find({ empresaId: oid, createdAt: { $gte: since } })
        .sort({ createdAt: -1 }).limit(LIMIT).lean() : [],
    ]);

    type WithDate = { createdAt?: Date };

    const items = [
      ...(recentAlerts as unknown as WithDate[]).map((a: any) => ({
        id:        String(a._id),
        type:      'alert' as const,
        domain:    a.domain ?? 'system',
        label:     a.message ?? a.type,
        severity:  a.severity ?? 'info',
        occurredAt: (a.createdAt as Date)?.toISOString() ?? new Date().toISOString(),
      })),
      ...(recentOps as unknown as WithDate[]).map((o: any) => ({
        id:        String(o._id),
        type:      'operation' as const,
        domain:    o.domain ?? 'system',
        label:     o.title ?? o.type ?? o.kind,
        severity:  'info' as const,
        plateId:   resolveOperationPlateId(o),
        regionId:  o.payload?.regionId ?? null,
        occurredAt: (o.createdAt as Date)?.toISOString() ?? new Date().toISOString(),
      })),
      ...(recentAlugueis as unknown as WithDate[]).map((al: any) => ({
        id:        String(al._id),
        type:      'contract' as const,
        domain:    'contracts',
        label:     `Contrato placa ${String(al.placaId)}`,
        severity:  'info' as const,
        occurredAt: (al.createdAt as Date)?.toISOString() ?? new Date().toISOString(),
      })),
    ]
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
      .slice(0, LIMIT);

    return {
      items,
      cursor: items.length === LIMIT ? items[items.length - 1]?.occurredAt ?? null : null,
    };
  }

  // ── Performance ────────────────────────────────────────────────────────────

  async getPerformance(empresaId: string) {
    const oid  = safeOid(empresaId);
    const now  = new Date();
    const in30 = daysFromNow(30);

    const comModel = getModel<{ empresaId: string; kind: string; status?: string; value?: number }>('CommercialV4Record');

    const [idleBoardsRaw, regionsRaw, expiringRaw, comStats, reportsStats] = await Promise.all([
      // Placas disponíveis (ociosas — disponivel=true há +90 dias)
      oid ? Placa.find({ empresaId: oid, disponivel: true })
        .select('numero_placa regiaoId updatedAt createdAt')
        .limit(50).lean() : [],

      // Ocupação por região
      oid ? Placa.aggregate([
        { $match: { empresaId: oid } },
        { $group: {
          _id: '$regiaoId',
          total: { $sum: 1 },
          available: { $sum: { $cond: ['$disponivel', 1, 0] } },
        }},
        { $lookup: { from: 'regioes', localField: '_id', foreignField: '_id', as: 'r' } },
        { $unwind: { path: '$r', preserveNullAndEmptyArrays: true } },
      ]) : [],

      // Contratos expirando em 30 dias
      oid ? Aluguel.find({
        empresaId: oid,
        status: { $ne: 'cancelado' },
        $or: [
          { endDate: { $gte: now, $lte: in30 } },
          { data_fim: { $gte: now, $lte: in30 } },
        ],
      }).select('placaId clienteId endDate data_fim status').limit(20).lean() : [],

      // Pipeline comercial
      comModel?.aggregate([
        { $match: { empresaId } },
        { $group: {
          _id: '$kind',
          count: { $sum: 1 },
          totalValue: { $sum: { $ifNull: ['$value', 0] } },
        }},
      ]) ?? [],

      // Reports recentes
      getModel('ReportV4Record')?.find({ empresaId })
        .sort({ createdAt: -1 }).limit(5).lean() ?? [],
    ]);

    type RegionRow = { _id: unknown; total: number; available: number; r?: { nome?: string } };
    type ComRow    = { _id: string; count: number; totalValue: number };

    const comByKind = Object.fromEntries(
      (comStats as ComRow[]).map((r) => [r._id, { count: r.count, totalValue: r.totalValue }]),
    );

    return {
      idleBoards: (idleBoardsRaw as any[]).map((p) => ({
        id:          String(p._id),
        numeroPlaca: p.numero_placa,
        regionId:    String(p.regiaoId ?? ''),
        since:       (p.updatedAt as Date)?.toISOString() ?? (p.createdAt as Date)?.toISOString(),
      })),
      regions: (regionsRaw as RegionRow[]).map((r) => ({
        regionId:     String(r._id ?? ''),
        name:         r.r?.nome ?? 'Sem região',
        total:        r.total,
        available:    r.available,
        occupied:     r.total - r.available,
        occupancyRate: rate(r.total - r.available, r.total),
      })),
      expiringContracts: (expiringRaw as any[]).map((a) => ({
        id:        String(a._id),
        placaId:   String(a.placaId),
        clienteId: String(a.clienteId),
        expiresAt: (a.endDate as Date)?.toISOString() ?? (a.data_fim as Date)?.toISOString(),
        status:    a.status,
      })),
      commercial: {
        opportunities: comByKind['opportunity'] ?? { count: 0, totalValue: 0 },
        proposals:     comByKind['proposal']     ?? { count: 0, totalValue: 0 },
        conversions:   comByKind['conversion']   ?? { count: 0, totalValue: 0 },
      },
      reports: {
        recent: (reportsStats as any[]).map((r) => ({
          id:     String(r._id),
          kind:   r.kind,
          type:   r.type,
          status: r.status,
        })),
      },
    };
  }

  // ── Alerts Summary ─────────────────────────────────────────────────────────

  async getAlertsSummary(empresaId: string) {
    const alertModel = getModel<{
      empresaId: string;
      severity: string;
      status: string;
      read: boolean;
      domain: string;
    }>('AlertV4Record');

    if (!alertModel) {
      return { total: 0, critical: 0, unread: 0, byDomain: [] };
    }

    const [total, critical, unread, byDomainRaw] = await Promise.all([
      alertModel.countDocuments({ empresaId }),
      alertModel.countDocuments({ empresaId, severity: 'critical', status: 'open' }),
      alertModel.countDocuments({ empresaId, read: false }),
      alertModel.aggregate([
        { $match: { empresaId } },
        { $group: { _id: '$domain', count: { $sum: 1 }, open: { $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] } } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    type DomainRow = { _id: string; count: number; open: number };

    return {
      total,
      critical,
      unread,
      byDomain: (byDomainRaw as DomainRow[]).map((d) => ({
        domain: d._id ?? 'system',
        count:  d.count,
        open:   d.open,
      })),
    };
  }
}
