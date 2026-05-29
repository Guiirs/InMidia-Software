import mongoose, { Model } from 'mongoose';
import { commercialAvailabilityProjection, type CommercialAvailabilityResult } from '@modules/commercial-availability';
import { recordProjectionMetric } from '@shared/infra/monitoring/projection-metrics';
import { dashboardReadModel } from './read-models/dashboard-read-model';
import { regionReadModel, type RegionSummary } from '@modules/regions/read-models/region-read-model';
import { CACHE_TTL_MS } from '@shared/infra/cache';

type AnyDoc = Record<string, any>;

export interface DashboardProjectionModels {
  placaModel: Model<any>;
  aluguelModel: Model<any>;
  regiaoModel: Model<any>;
  propostaModel: Model<any>;
  contratoModel: Model<any>;
}

export interface DashboardProjectionOverview {
  totalPlacas: number;
  placasDisponiveis: number;
  placasOcupadas: number;
  placasReservadas: number;
  placasManutencao: number;
  propostasEmAberto: number;
  contratosAtivos: number;
  regioesAtivas: number;
  receitaEstimadaMensal: number;
}

export interface DashboardProjectionRegion {
  regiaoId: string;
  regiao: string;
  totalPlacas: number;
  placasAlugadas: number;
  placasDisponiveis: number;
  taxaOcupacao: number;
  receitaEstimada: number;
  propostasAbertas: number;
  contratosAtivos: number;
}

export interface DashboardProjectionOverviewWithMeta extends DashboardProjectionOverview {
  cacheHit: boolean;
  source: 'read_model' | 'projection';
}

export interface DashboardProjectionRegionWithMeta {
  data: DashboardProjectionRegion[];
  cacheHit: boolean;
  source: 'read_model' | 'projection';
}

const DAY_MS = 24 * 60 * 60 * 1000;

function safeDate(input: unknown): Date | null {
  if (!input) return null;
  const d = new Date(input as any);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toMoney(value: number): number {
  return Number(value.toFixed(2));
}

function toRate(value: number): number {
  return Number(value.toFixed(2));
}

function isOccupied(status?: CommercialAvailabilityResult): boolean {
  return status?.status === 'CONTRACTED_ACTIVE' || status?.status === 'RESERVED' || status?.status === 'FUTURE_RESERVED';
}

function monthlyRevenue(items: AnyDoc[]): number {
  return items.reduce((sum: number, item: AnyDoc) => {
    const valorTotal = Number(item.valorTotal || 0);
    const start = safeDate(item.startDate);
    const end = safeDate(item.endDate);

    if (!start || !end || end <= start) return sum + valorTotal;

    const totalDays = Math.max(1, (end.getTime() - start.getTime()) / DAY_MS);
    const months = Math.max(1, totalDays / 30);
    return sum + valorTotal / months;
  }, 0);
}

function statusCounts(statuses: Iterable<CommercialAvailabilityResult>) {
  const counts = {
    available: 0,
    occupied: 0,
    reserved: 0,
    maintenance: 0,
  };

  Array.from(statuses).forEach((status) => {
    if (status.isCommerciallyAvailable) counts.available += 1;
    else if (status.status === 'CONTRACTED_ACTIVE') counts.occupied += 1;
    else if (status.status === 'RESERVED' || status.status === 'FUTURE_RESERVED') counts.reserved += 1;
    else if (status.status === 'MAINTENANCE') counts.maintenance += 1;
  });

  return counts;
}

export class DashboardProjectionService {
  constructor(private readonly models: DashboardProjectionModels) {}

  async getOverview(
    empresaId: string,
    at: Date = new Date(),
    options: { skipCache?: boolean } = {},
  ): Promise<DashboardProjectionOverviewWithMeta> {
    // Serve from read model if fresh (TTL: dashboard 60s)
    if (!options.skipCache && !dashboardReadModel.isStale(empresaId, CACHE_TTL_MS.DASHBOARD)) {
      const snapshot = dashboardReadModel.get(empresaId);
      if (snapshot) {
        recordProjectionMetric({
          projection: 'dashboard',
          durationMs: 0,
          plateCount: snapshot.overview.totalPlacas,
          cacheHit: true,
        });
        return { ...snapshot.overview, cacheHit: true, source: 'read_model' };
      }
    }

    const startedAt = Date.now();
    const empresaObjectId = new mongoose.Types.ObjectId(empresaId);

    const [
      placas,
      propostasEmAberto,
      contratosAtivos,
      regioesAtivas,
      contratosComPi,
    ] = await Promise.all([
      this.models.placaModel.find({ empresaId: empresaObjectId }).select('_id').lean(),
      this.models.propostaModel.countDocuments({ empresaId: empresaObjectId, status: 'em_andamento' }),
      this.models.contratoModel.countDocuments({ empresaId: empresaObjectId, status: 'ativo' }),
      this.models.regiaoModel.countDocuments({ empresaId: empresaObjectId, ativo: true }),
      this.models.contratoModel.aggregate([
        { $match: { empresaId: empresaObjectId, status: 'ativo' } },
        {
          $lookup: {
            from: 'propostainternas',
            localField: 'piId',
            foreignField: '_id',
            as: 'pi',
          },
        },
        { $unwind: { path: '$pi', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            valorTotal: { $ifNull: ['$pi.valorTotal', 0] },
            startDate: { $ifNull: ['$pi.startDate', '$pi.dataInicio'] },
            endDate: { $ifNull: ['$pi.endDate', '$pi.dataFim'] },
          },
        },
      ]),
    ]);

    const commercialStatuses = await commercialAvailabilityProjection.resolveManyPlateCommercialStatuses({
      empresaId,
      placaIds: placas.map((placa: AnyDoc) => String(placa._id)),
      at,
    });
    const counts = statusCounts(commercialStatuses.values());

    const overview: DashboardProjectionOverview = {
      totalPlacas: placas.length,
      placasDisponiveis: counts.available,
      placasOcupadas: counts.occupied,
      placasReservadas: counts.reserved,
      placasManutencao: counts.maintenance,
      propostasEmAberto,
      contratosAtivos,
      regioesAtivas,
      receitaEstimadaMensal: toMoney(monthlyRevenue(contratosComPi)),
    };

    const durationMs = Date.now() - startedAt;
    recordProjectionMetric({
      projection: 'dashboard',
      durationMs,
      plateCount: placas.length,
      fallbackCount: Array.from(commercialStatuses.values()).filter((status) => status.source === 'fallback_legacy').length,
      cacheHit: false,
      rebuild: true,
    });

    // Store in read model (regions will be populated on next getRegionPerformance call)
    const existingSnapshot = dashboardReadModel.get(empresaId);
    dashboardReadModel.put(empresaId, overview, existingSnapshot?.regions ?? []);

    return { ...overview, cacheHit: false, source: 'projection' };
  }

  async getRegionPerformance(
    empresaId: string,
    at: Date = new Date(),
    options: { skipCache?: boolean } = {},
  ): Promise<DashboardProjectionRegionWithMeta> {
    // Serve from read model if fresh
    if (!options.skipCache && !dashboardReadModel.isStale(empresaId, CACHE_TTL_MS.DASHBOARD)) {
      const snapshot = dashboardReadModel.get(empresaId);
      if (snapshot && snapshot.regions.length > 0) {
        recordProjectionMetric({
          projection: 'dashboard',
          durationMs: 0,
          plateCount: snapshot.overview.totalPlacas,
          cacheHit: true,
        });
        return { data: snapshot.regions, cacheHit: true, source: 'read_model' };
      }
    }

    const startedAt = Date.now();
    const empresaObjectId = new mongoose.Types.ObjectId(empresaId);

    const [placasPorRegiao, propostasByRegion, contratosByRegion] = await Promise.all([
      this.models.placaModel.aggregate([
        { $match: { empresaId: empresaObjectId } },
        { $group: { _id: '$regiaoId', totalPlacas: { $sum: 1 }, placaIds: { $addToSet: '$_id' } } },
        {
          $lookup: {
            from: 'regiaos',
            localField: '_id',
            foreignField: '_id',
            as: 'regiaoDetalhes',
          },
        },
        { $unwind: { path: '$regiaoDetalhes', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 1,
            regiao: { $ifNull: ['$regiaoDetalhes.nome', 'Sem Regiao'] },
            totalPlacas: 1,
            placaIds: 1,
          },
        },
      ]),
      this.models.propostaModel.aggregate([
        { $match: { empresaId: empresaObjectId, status: 'em_andamento' } },
        { $unwind: { path: '$placas', preserveNullAndEmptyArrays: false } },
        { $lookup: { from: 'placas', localField: 'placas', foreignField: '_id', as: 'placa' } },
        { $unwind: { path: '$placa', preserveNullAndEmptyArrays: false } },
        // Guard: reject any plate whose empresaId doesn't match the tenant.
        // Normally unreachable, but prevents cross-tenant data if referential
        // integrity ever drifts (e.g. a PI referencing a plate from another tenant).
        { $match: { 'placa.empresaId': empresaObjectId } },
        { $group: { _id: '$placa.regiaoId', propostasAbertas: { $sum: 1 } } },
      ]),
      this.models.contratoModel.aggregate([
        { $match: { empresaId: empresaObjectId, status: 'ativo' } },
        { $lookup: { from: 'propostainternas', localField: 'piId', foreignField: '_id', as: 'pi' } },
        { $unwind: { path: '$pi', preserveNullAndEmptyArrays: false } },
        { $unwind: { path: '$pi.placas', preserveNullAndEmptyArrays: false } },
        { $lookup: { from: 'placas', localField: 'pi.placas', foreignField: '_id', as: 'placa' } },
        { $unwind: { path: '$placa', preserveNullAndEmptyArrays: false } },
        // Guard: same tenant isolation invariant as above.
        { $match: { 'placa.empresaId': empresaObjectId } },
        {
          $group: {
            _id: '$placa.regiaoId',
            receitaEstimada: { $sum: { $ifNull: ['$pi.valorTotal', 0] } },
            contratosAtivos: { $sum: 1 },
          },
        },
      ]),
    ]);

    const allPlateIds = placasPorRegiao.flatMap((row: AnyDoc) =>
      Array.isArray(row.placaIds) ? row.placaIds.map((id: unknown) => String(id)) : [],
    );
    const commercialStatuses = await commercialAvailabilityProjection.resolveManyPlateCommercialStatuses({
      empresaId,
      placaIds: allPlateIds,
      at,
    });
    const propostasMap = new Map<string, number>();
    propostasByRegion.forEach((r: AnyDoc) => propostasMap.set(String(r._id), Number(r.propostasAbertas || 0)));
    const contratosMap = new Map<string, AnyDoc>();
    contratosByRegion.forEach((r: AnyDoc) => contratosMap.set(String(r._id), r));

    const regions: DashboardProjectionRegion[] = placasPorRegiao
      .map((row: AnyDoc) => {
        const regiaoId = String(row._id);
        const totalPlacas = Number(row.totalPlacas || 0);
        const statuses = (row.placaIds || []).map((id: unknown) => commercialStatuses.get(String(id)));
        const placasAlugadas = Math.min(totalPlacas, statuses.filter(isOccupied).length);
        const placasDisponiveis = statuses.filter((status: CommercialAvailabilityResult | undefined) => status?.isCommerciallyAvailable).length;
        const contratoData = contratosMap.get(regiaoId);

        return {
          regiaoId,
          regiao: row.regiao,
          totalPlacas,
          placasAlugadas,
          placasDisponiveis,
          taxaOcupacao: totalPlacas > 0 ? toRate((placasAlugadas / totalPlacas) * 100) : 0,
          receitaEstimada: toMoney(Number(contratoData?.receitaEstimada || 0)),
          propostasAbertas: Number(propostasMap.get(regiaoId) || 0),
          contratosAtivos: Number(contratoData?.contratosAtivos || 0),
        };
      })
      .sort((a, b) => {
        if (b.taxaOcupacao !== a.taxaOcupacao) return b.taxaOcupacao - a.taxaOcupacao;
        return b.receitaEstimada - a.receitaEstimada;
      });

    const durationMs = Date.now() - startedAt;
    recordProjectionMetric({
      projection: 'dashboard',
      durationMs,
      plateCount: allPlateIds.length,
      fallbackCount: Array.from(commercialStatuses.values()).filter((status) => status.source === 'fallback_legacy').length,
      cacheHit: false,
      rebuild: true,
    });

    // Update read model with region data
    const regionSummaries: RegionSummary[] = regions.map((r) => ({
      regiaoId: r.regiaoId,
      nome: r.regiao,
      totalPlacas: r.totalPlacas,
      placasOcupadas: r.placasAlugadas,
      placasDisponiveis: r.placasDisponiveis,
      taxaOcupacao: r.taxaOcupacao,
      builtAt: Date.now(),
    }));
    regionReadModel.put(empresaId, regionSummaries);

    const existingSnapshot = dashboardReadModel.get(empresaId);
    dashboardReadModel.put(empresaId, existingSnapshot?.overview ?? {
      totalPlacas: allPlateIds.length,
      placasDisponiveis: 0,
      placasOcupadas: 0,
      placasReservadas: 0,
      placasManutencao: 0,
      propostasEmAberto: 0,
      contratosAtivos: 0,
      regioesAtivas: regions.length,
      receitaEstimadaMensal: 0,
    }, regions);

    return { data: regions, cacheHit: false, source: 'projection' };
  }
}
