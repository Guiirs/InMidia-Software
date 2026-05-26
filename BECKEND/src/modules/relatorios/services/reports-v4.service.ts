import mongoose, { Model, Schema } from 'mongoose';
import AppError from '@shared/container/AppError';
import Placa from '@modules/placas/Placa';
import Aluguel from '@modules/alugueis/Aluguel';

function safeOid(id: string): mongoose.Types.ObjectId | null {
  return mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null;
}

function getRegisteredModel<T>(name: string): Model<T> | null {
  return (mongoose.models[name] as Model<T> | undefined) ?? null;
}

const MONTHS_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'] as const;

function monthLabel(year: number, month: number): string {
  return `${MONTHS_PT[(month - 1) % 12]} ${year}`;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function sumByField<T extends Record<string, unknown>>(arr: T[], field: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of arr) {
    const key = String(item[field] ?? '');
    out[key] = (out[key] ?? 0) + (Number(item['count']) || 0);
  }
  return out;
}

function sumByNestedField<T extends Record<string, unknown>>(arr: T[], field: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of arr) {
    const id = item['_id'] as Record<string, unknown>;
    const key = String(id?.[field] ?? '');
    out[key] = (out[key] ?? 0) + (Number(item['count']) || 0);
  }
  return out;
}

function quarterFromMonth(month: number): number {
  return Math.ceil(month / 3);
}

function byQuarterFromMonthly(monthly: Array<{ _id: { year: number; month: number }; count: number }>) {
  const map: Record<string, { period: string; label: string; count: number }> = {};
  for (const row of monthly) {
    const q = quarterFromMonth(row._id.month);
    const key = `${row._id.year}-Q${q}`;
    if (!map[key]) map[key] = { period: key, label: `T${q}/${row._id.year}`, count: 0 };
    map[key].count += row.count;
  }
  return Object.values(map);
}

type ReportKind = 'export' | 'schedule';

type ReportDoc = {
  _id: mongoose.Types.ObjectId;
  empresaId: string;
  kind: ReportKind;
  type: string;
  status: string;
  format?: string;
  filters: Record<string, unknown>;
  cron?: string;
  recipients: string[];
  createdAt?: Date;
  updatedAt?: Date;
};

const reportSchema = new Schema<ReportDoc>({
  empresaId: { type: String, required: true, index: true },
  kind: { type: String, enum: ['export', 'schedule'], required: true, index: true },
  type: { type: String, required: true },
  status: { type: String, default: 'pending', index: true },
  format: { type: String },
  filters: { type: Schema.Types.Mixed, default: {} },
  cron: { type: String },
  recipients: { type: [String], default: [] },
}, { timestamps: true, collection: 'reports_v4_records' });

reportSchema.index({ empresaId: 1, kind: 1, createdAt: -1 });

const ReportRecord: Model<ReportDoc> = (mongoose.models.ReportV4Record as Model<ReportDoc> | undefined)
  || mongoose.model<ReportDoc>('ReportV4Record', reportSchema);

function toExport(doc: ReportDoc) {
  const id = String(doc._id);
  return {
    id,
    realId: id,
    type: doc.type,
    status: doc.status,
    format: doc.format ?? null,
    filters: doc.filters ?? {},
    createdAt: doc.createdAt?.toISOString?.() ?? null,
    updatedAt: doc.updatedAt?.toISOString?.() ?? null,
  };
}

function toSchedule(doc: ReportDoc) {
  const id = String(doc._id);
  return {
    id,
    realId: id,
    type: doc.type,
    status: doc.status,
    cron: doc.cron ?? null,
    recipients: doc.recipients ?? [],
    filters: doc.filters ?? {},
    createdAt: doc.createdAt?.toISOString?.() ?? null,
    updatedAt: doc.updatedAt?.toISOString?.() ?? null,
  };
}

async function findReportRecord(empresaId: string, id: string, kind: ReportKind): Promise<ReportDoc> {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError('Registro de relatorio invalido.', 400);
  const record = await ReportRecord.findOne({ _id: id, empresaId, kind }).lean<ReportDoc>();
  if (!record) throw new AppError('Registro de relatorio nao encontrado.', 404);
  return record;
}

export class ReportsV4Service {
  async getSummary(empresaId: string) {
    const [exportsTotal, schedulesTotal, exportsPending, exportsCompleted] = await Promise.all([
      ReportRecord.countDocuments({ empresaId, kind: 'export' }),
      ReportRecord.countDocuments({ empresaId, kind: 'schedule' }),
      ReportRecord.countDocuments({ empresaId, kind: 'export', status: 'pending' }),
      ReportRecord.countDocuments({ empresaId, kind: 'export', status: 'completed' }),
    ]);

    const executiveReports = [
      {
        id: 'rep-exports',
        label: 'Exportações',
        icone: 'file_download',
        periodo: 'Total acumulado',
        estado: exportsTotal > 0 ? 'healthy' : 'pending',
        ultimaGeracao: 'Agora',
        tamanho: '—',
        insights: [
          `${exportsTotal} exportaç${exportsTotal !== 1 ? 'ões' : 'ão'} criada${exportsTotal !== 1 ? 's' : ''}`,
          `${exportsPending} pendente${exportsPending !== 1 ? 's' : ''}`,
          `${exportsCompleted} concluída${exportsCompleted !== 1 ? 's' : ''}`,
        ],
      },
      {
        id: 'rep-schedules',
        label: 'Agendamentos',
        icone: 'schedule',
        periodo: 'Ativos',
        estado: schedulesTotal > 0 ? 'healthy' : 'pending',
        ultimaGeracao: 'Agora',
        tamanho: '—',
        insights: [
          `${schedulesTotal} agendamento${schedulesTotal !== 1 ? 's' : ''} configurado${schedulesTotal !== 1 ? 's' : ''}`,
        ],
      },
    ];

    return {
      kpis: { exportsTotal, schedulesTotal },
      // Backward compat fields kept for test contract
      performance: {} as Record<string, unknown>,
      revenue: {} as Record<string, unknown>,
      occupancy: {} as Record<string, unknown>,
      // New fields
      executiveReports,
      generatedAt: new Date().toISOString(),
    };
  }

  async getAnalytics(empresaId: string) {
    const oid = safeOid(empresaId);
    const since = daysAgo(365);

    const [byPeriodRaw, byRegionRaw, alertsTotal, opsTotal, commercialTotal, reportsTotal, placasTotal, alugeisTotal] =
      await Promise.all([
        oid
          ? Aluguel.aggregate([
              { $match: { empresaId: oid, createdAt: { $gte: since } } },
              { $group: { _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } }, count: { $sum: 1 } } },
              { $sort: { '_id.y': 1, '_id.m': 1 } },
            ])
          : [],
        oid
          ? Placa.aggregate([
              { $match: { empresaId: oid } },
              { $group: { _id: '$regiaoId', total: { $sum: 1 }, available: { $sum: { $cond: ['$disponivel', 1, 0] } } } },
              { $lookup: { from: 'regioes', localField: '_id', foreignField: '_id', as: 'r' } },
              { $unwind: { path: '$r', preserveNullAndEmptyArrays: true } },
            ])
          : [],
        getRegisteredModel('AlertV4Record')?.countDocuments({ empresaId }) ?? 0,
        getRegisteredModel('OperationV4Record')?.countDocuments({ empresaId }) ?? 0,
        getRegisteredModel('CommercialV4Record')?.countDocuments({ empresaId }) ?? 0,
        ReportRecord.countDocuments({ empresaId }),
        oid ? Placa.countDocuments({ empresaId: oid }) : 0,
        oid ? Aluguel.countDocuments({ empresaId: oid }) : 0,
      ]);

    type PeriodRow = { _id: { y: number; m: number }; count: number };
    type RegionRow = { _id: unknown; total: number; available: number; r?: { nome?: string; name?: string } };

    const byPeriod = (byPeriodRaw as PeriodRow[]).map((p) => ({
      period: `${p._id.y}-${String(p._id.m).padStart(2, '0')}`,
      label: monthLabel(p._id.y, p._id.m),
      count: p.count,
    }));

    const byRegion = (byRegionRaw as RegionRow[]).map((r) => ({
      regionId: String(r._id ?? ''),
      region: r.r?.nome ?? r.r?.name ?? 'Sem região',
      total: r.total,
      available: r.available,
      occupied: r.total - r.available,
    }));

    // Derive performance from period data (contract activity by month)
    const perfHistory = byPeriod.map((p) => ({
      mes: p.label,
      receita: p.count,
      contratos: p.count,
      ocupacao: 0,
      campanhas: 0,
    }));
    const perfCounts = perfHistory.map((h) => h.contratos);
    const perfTotal = perfCounts.reduce((a, b) => a + b, 0);
    const perfMax = Math.max(...perfCounts, 0);
    const perfAvg = perfHistory.length > 0 ? Math.round(perfTotal / perfHistory.length) : 0;
    const perfFirst = perfHistory[0]?.contratos ?? 0;
    const perfLast = perfHistory[perfHistory.length - 1]?.contratos ?? 0;
    const perfGrowth = perfHistory.length >= 2
      ? Math.round(((perfLast - perfFirst) / Math.max(perfFirst, 1)) * 100)
      : 0;

    const performance = perfHistory.length > 0 ? {
      history: perfHistory,
      growthLabel: `${perfGrowth >= 0 ? '+' : ''}${perfGrowth}%`,
      peakRevenueLabel: `${perfMax} contratos`,
      averageRevenueLabel: `${perfAvg}/mês`,
      occupancyLabel: '—',
    } : null;

    // Derive regional ranking from inventory data (occupancy rate)
    const ranking = byRegion
      .map((r) => ({
        regiao: r.region,
        receita: 0,
        ocupacao: r.total > 0 ? (r.total - r.available) / r.total : 0,
        crescimento: 0,
        meta: 0,
        pontos: r.total,
        campanhas: 0,
      }))
      .sort((a, b) => b.ocupacao - a.ocupacao);

    const regional = ranking.length > 0 ? {
      ranking,
      bestRegion: ranking[0]?.regiao ?? null,
      worstRegion: ranking[ranking.length - 1]?.regiao ?? null,
      opportunitiesLabel: '—',
    } : null;

    return {
      byPeriod,
      byRegion,
      byDomain: [
        { domain: 'inventory',  label: 'Inventário', total: placasTotal },
        { domain: 'contracts',  label: 'Contratos',  total: alugeisTotal },
        { domain: 'commercial', label: 'Comercial',  total: commercialTotal },
        { domain: 'alerts',     label: 'Alertas',    total: alertsTotal },
        { domain: 'operations', label: 'Operações',  total: opsTotal },
        { domain: 'reports',    label: 'Relatórios', total: reportsTotal },
      ],
      // Derived analytics for the UI
      performance,
      regional,
      revenue: null as null,
      occupancy: null as null,
    };
  }

  async listExports(empresaId: string) {
    const exports = await ReportRecord.find({ empresaId, kind: 'export' }).sort({ createdAt: -1 }).lean<ReportDoc[]>();
    return {
      exports: exports.map(toExport),
      total: exports.length,
    };
  }

  async getByDomain(empresaId: string) {
    const oid = safeOid(empresaId);

    const [placaStats, alertsByStatus, opsByKindStatus, commercialByKind, reportsByKindStatus, alugeisTotal] =
      await Promise.all([
        oid
          ? Placa.aggregate([
              { $match: { empresaId: oid } },
              { $group: { _id: null, total: { $sum: 1 }, available: { $sum: { $cond: ['$disponivel', 1, 0] } } } },
            ])
          : [],
        getRegisteredModel('AlertV4Record')?.aggregate([
          { $match: { empresaId } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]) ?? [],
        getRegisteredModel('OperationV4Record')?.aggregate([
          { $match: { empresaId } },
          { $group: { _id: { kind: '$kind', status: '$status' }, count: { $sum: 1 } } },
        ]) ?? [],
        getRegisteredModel('CommercialV4Record')?.aggregate([
          { $match: { empresaId } },
          { $group: { _id: '$kind', count: { $sum: 1 } } },
        ]) ?? [],
        ReportRecord.aggregate([
          { $match: { empresaId } },
          { $group: { _id: { kind: '$kind', status: '$status' }, count: { $sum: 1 } } },
        ]),
        oid ? Aluguel.countDocuments({ empresaId: oid }) : 0,
      ]);

    const ps = (placaStats as Array<{ total: number; available: number }>)[0] ?? { total: 0, available: 0 };
    const alertMap = sumByField(alertsByStatus as Array<{ _id: string; count: number }>, '_id');
    const opKindMap = sumByNestedField(opsByKindStatus as Array<{ _id: { kind: string; status: string }; count: number }>, 'kind');
    const opStatusMap = sumByNestedField(opsByKindStatus as Array<{ _id: { kind: string; status: string }; count: number }>, 'status');
    const comMap = sumByField(commercialByKind as Array<{ _id: string; count: number }>, '_id');
    const repKindMap = sumByNestedField(reportsByKindStatus as Array<{ _id: { kind: string; status: string }; count: number }>, 'kind');
    const repStatusMap = sumByNestedField(reportsByKindStatus as Array<{ _id: { kind: string; status: string }; count: number }>, 'status');

    return {
      inventory: {
        total: ps.total,
        available: ps.available,
        occupied: ps.total - ps.available,
        lastUpdated: new Date().toISOString(),
      },
      contracts: {
        total: alugeisTotal,
        lastUpdated: new Date().toISOString(),
      },
      commercial: {
        opportunities: comMap['opportunity'] ?? 0,
        proposals:     comMap['proposal']     ?? 0,
        conversions:   comMap['conversion']   ?? 0,
        activities:    comMap['activity']     ?? 0,
        total: Object.values(comMap).reduce((a, b) => a + b, 0),
        lastUpdated: new Date().toISOString(),
      },
      alerts: {
        total:     Object.values(alertMap).reduce((a, b) => a + b, 0),
        open:      alertMap['open']      ?? 0,
        resolved:  alertMap['resolved']  ?? 0,
        dismissed: alertMap['dismissed'] ?? 0,
        lastUpdated: new Date().toISOString(),
      },
      operations: {
        tasks:     opKindMap['task']        ?? 0,
        events:    opKindMap['event']       ?? 0,
        pending:   opStatusMap['pending']   ?? 0,
        completed: opStatusMap['completed'] ?? 0,
        lastUpdated: new Date().toISOString(),
      },
      reports: {
        exports:   repKindMap['export']      ?? 0,
        schedules: repKindMap['schedule']    ?? 0,
        pending:   repStatusMap['pending']   ?? 0,
        completed: repStatusMap['completed'] ?? 0,
        lastUpdated: new Date().toISOString(),
      },
    };
  }

  async getByPeriod(empresaId: string, params: { start?: string; end?: string } = {}) {
    const oid = safeOid(empresaId);
    if (!oid) return { byWeek: [], byMonth: [], byQuarter: [], meta: {} };

    const endDate = params.end ? new Date(params.end) : new Date();
    const startDate = params.start ? new Date(params.start) : daysAgo(90);

    const [byMonthRaw, byWeekRaw] = await Promise.all([
      Aluguel.aggregate([
        { $match: { empresaId: oid, createdAt: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),
      Aluguel.aggregate([
        { $match: { empresaId: oid, createdAt: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: { year: { $year: '$createdAt' }, week: { $isoWeek: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { '_id.year': 1, '_id.week': 1 } },
      ]),
    ]);

    type MonthRow = { _id: { year: number; month: number }; count: number };
    type WeekRow  = { _id: { year: number; week: number };  count: number };

    return {
      byMonth: (byMonthRaw as MonthRow[]).map((p) => ({
        period: `${p._id.year}-${String(p._id.month).padStart(2, '0')}`,
        label: monthLabel(p._id.year, p._id.month),
        count: p.count,
      })),
      byWeek: (byWeekRaw as WeekRow[]).map((p) => ({
        period: `${p._id.year}-W${String(p._id.week).padStart(2, '0')}`,
        label: `Semana ${p._id.week}/${p._id.year}`,
        count: p.count,
      })),
      byQuarter: byQuarterFromMonthly(byMonthRaw as MonthRow[]),
      meta: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
    };
  }

  async createExport(empresaId: string, input: Record<string, unknown>) {
    const record = await ReportRecord.create({
      empresaId,
      kind: 'export',
      type: String(input.type ?? 'summary'),
      status: 'pending',
      format: String(input.format ?? 'json'),
      filters: input.filters && typeof input.filters === 'object'
        ? input.filters as Record<string, unknown>
        : {},
    });
    return toExport(record.toObject() as ReportDoc);
  }

  async cancelExport(empresaId: string, id: string) {
    await findReportRecord(empresaId, id, 'export');
    const record = await ReportRecord.findOneAndUpdate(
      { _id: id, empresaId, kind: 'export' },
      { $set: { status: 'cancelled' } },
      { new: true },
    ).lean<ReportDoc>();
    if (!record) throw new AppError('Exportacao nao encontrada.', 404);
    return toExport(record);
  }

  async createSchedule(empresaId: string, input: Record<string, unknown>) {
    const record = await ReportRecord.create({
      empresaId,
      kind: 'schedule',
      type: String(input.type ?? 'summary'),
      status: 'active',
      cron: String(input.cron ?? ''),
      recipients: Array.isArray(input.recipients) ? input.recipients.map(String) : [],
      filters: input.filters && typeof input.filters === 'object'
        ? input.filters as Record<string, unknown>
        : {},
    });
    return toSchedule(record.toObject() as ReportDoc);
  }

  async updateSchedule(empresaId: string, id: string, input: Record<string, unknown>) {
    const current = await findReportRecord(empresaId, id, 'schedule');
    const record = await ReportRecord.findOneAndUpdate(
      { _id: id, empresaId, kind: 'schedule' },
      {
        $set: {
          type: input.type !== undefined ? String(input.type) : current.type,
          status: input.status !== undefined ? String(input.status) : current.status,
          cron: input.cron !== undefined ? String(input.cron) : current.cron,
          recipients: Array.isArray(input.recipients) ? input.recipients.map(String) : current.recipients,
          filters: input.filters && typeof input.filters === 'object'
            ? input.filters as Record<string, unknown>
            : current.filters,
        },
      },
      { new: true },
    ).lean<ReportDoc>();
    if (!record) throw new AppError('Agenda de relatorio nao encontrada.', 404);
    return toSchedule(record);
  }

  async deleteSchedule(empresaId: string, id: string) {
    await findReportRecord(empresaId, id, 'schedule');
    await ReportRecord.deleteOne({ _id: id, empresaId, kind: 'schedule' });
    return { deleted: true };
  }
}
