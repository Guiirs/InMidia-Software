import mongoose, { Model } from 'mongoose';
import { Result, DomainError, ValidationError } from '@shared/core';
import type {
  DashboardOverview,
  MostRentedBoard,
  IdleBoard,
  RegionPerformance,
  SalesFunnel,
  DashboardAlert,
} from './dashboard.types';
import { commercialAvailabilityProjection, type CommercialAvailabilityResult } from '@modules/commercial-availability';
import { DashboardProjectionService } from './dashboard-projection.service';

type AnyDoc = Record<string, any>;

const DAY_MS = 24 * 60 * 60 * 1000;

function safeDate(input: unknown): Date | null {
  if (!input) return null;
  const d = new Date(input as any);
  return Number.isNaN(d.getTime()) ? null : d;
}

function overlapDays(
  start: Date,
  end: Date,
  windowStart: Date,
  windowEnd: Date
): number {
  const from = Math.max(start.getTime(), windowStart.getTime());
  const to = Math.min(end.getTime(), windowEnd.getTime());
  if (to <= from) return 0;
  return (to - from) / DAY_MS;
}

function toMoney(value: number): number {
  return Number(value.toFixed(2));
}

function toRate(value: number): number {
  return Number(value.toFixed(2));
}

function isCommerciallyOccupied(status?: CommercialAvailabilityResult): boolean {
  return status?.status === 'CONTRACTED_ACTIVE' || status?.status === 'RESERVED' || status?.status === 'FUTURE_RESERVED';
}

export class DashboardService {
  constructor(
    private readonly placaModel: Model<any>,
    private readonly aluguelModel: Model<any>,
    private readonly regiaoModel: Model<any>,
    private readonly propostaModel: Model<any>,
    private readonly contratoModel: Model<any>
  ) {}

  async getOverview(empresaId: string): Promise<Result<DashboardOverview, DomainError>> {
    try {
      const projection = new DashboardProjectionService({
        placaModel: this.placaModel,
        aluguelModel: this.aluguelModel,
        regiaoModel: this.regiaoModel,
        propostaModel: this.propostaModel,
        contratoModel: this.contratoModel,
      });
      const overview = await projection.getOverview(empresaId);
      const placasAlugadasOcupadas = overview.placasOcupadas + overview.placasReservadas;

      return Result.ok({
        totalPlacas: overview.totalPlacas,
        placasDisponiveis: overview.placasDisponiveis,
        placasAlugadasOcupadas,
        taxaOcupacao: overview.totalPlacas > 0 ? toRate((placasAlugadasOcupadas / overview.totalPlacas) * 100) : 0,
        propostasEmAberto: overview.propostasEmAberto,
        contratosAtivos: overview.contratosAtivos,
        receitaEstimadaMensal: overview.receitaEstimadaMensal,
        regioesAtivas: overview.regioesAtivas,
      });
    } catch {
      return Result.fail(
        new ValidationError([{ field: 'geral', message: 'Erro ao calcular overview do dashboard' }])
      );
    }
  }

  async getMostRentedBoards(empresaId: string): Promise<Result<MostRentedBoard[], DomainError>> {
    try {
      const empresaObjectId = new mongoose.Types.ObjectId(empresaId);
      const now = new Date();

      const [placas, contratosPorPlaca, alugueisPorPlaca] = await Promise.all([
        this.placaModel.aggregate([
          { $match: { empresaId: empresaObjectId } },
          {
            $lookup: {
              from: 'regiaos',
              localField: 'regiaoId',
              foreignField: '_id',
              as: 'regiaoDetalhes',
            },
          },
          { $unwind: { path: '$regiaoDetalhes', preserveNullAndEmptyArrays: true } },
          {
            $project: {
              _id: 1,
              numero_placa: 1,
              nomeDaRua: { $ifNull: ['$nomeDaRua', '$localizacao'] },
              regiao: { $ifNull: ['$regiaoDetalhes.nome', 'Sem Região'] },
              disponivel: { $ifNull: ['$disponivel', true] },
            },
          },
        ]),
        this.propostaModel.aggregate([
          { $match: { empresaId: empresaObjectId } },
          { $unwind: { path: '$placas', preserveNullAndEmptyArrays: false } },
          {
            $lookup: {
              from: 'contratos',
              localField: '_id',
              foreignField: 'piId',
              as: 'contratos',
            },
          },
          {
            $addFields: {
              contratosValidos: {
                $filter: {
                  input: '$contratos',
                  as: 'contrato',
                  cond: { $ne: ['$$contrato.status', 'cancelado'] },
                },
              },
            },
          },
          {
            $project: {
              placaId: '$placas',
              valorTotal: { $ifNull: ['$valorTotal', 0] },
              quantidadeContratos: { $size: '$contratosValidos' },
            },
          },
          {
            $group: {
              _id: '$placaId',
              quantidadeContratos: { $sum: '$quantidadeContratos' },
              receitaGerada: { $sum: '$valorTotal' },
            },
          },
        ]),
        this.aluguelModel.aggregate([
          { $match: { empresaId: empresaObjectId, status: { $ne: 'cancelado' } } },
          {
            $project: {
              placaId: 1,
              dataRef: { $ifNull: ['$endDate', '$data_fim'] },
              emCurso: {
                $or: [
                  {
                    $and: [
                      { $lte: [{ $ifNull: ['$startDate', '$data_inicio'] }, now] },
                      { $gte: [{ $ifNull: ['$endDate', '$data_fim'] }, now] },
                    ],
                  },
                ],
              },
            },
          },
          {
            $group: {
              _id: '$placaId',
              quantidadeAlugueis: { $sum: 1 },
              ultimaLocacao: { $max: '$dataRef' },
              ocupadaAgora: { $max: '$emCurso' },
            },
          },
        ]),
      ]);

      const contratosMap = new Map<string, AnyDoc>();
      contratosPorPlaca.forEach((item: AnyDoc) => {
        contratosMap.set(String(item._id), item);
      });

      const alugueisMap = new Map<string, AnyDoc>();
      alugueisPorPlaca.forEach((item: AnyDoc) => {
        alugueisMap.set(String(item._id), item);
      });

      const commercialStatuses = await commercialAvailabilityProjection.resolveManyPlateCommercialStatuses({
        empresaId,
        placaIds: placas.map((placa: AnyDoc) => String(placa._id)),
        at: now,
      });

      const ranking = placas
        .map((placa: AnyDoc) => {
          const placaId = String(placa._id);
          const contratos = contratosMap.get(placaId);
          const alugueis = alugueisMap.get(placaId);
          const commercialStatus = commercialStatuses.get(placaId);

          const quantidadeAlugueisContratos =
            Number(contratos?.quantidadeContratos || 0) + Number(alugueis?.quantidadeAlugueis || 0);

          const statusAtual: 'disponivel' | 'ocupada' =
            isCommerciallyOccupied(commercialStatus) || alugueis?.ocupadaAgora ? 'ocupada' : 'disponivel';

          return {
            placaId,
            placa: placa.numero_placa,
            localizacao: placa.nomeDaRua || 'Sem localização',
            regiao: placa.regiao || 'Sem Região',
            quantidadeAlugueisContratos,
            receitaGerada: toMoney(Number(contratos?.receitaGerada || 0)),
            ultimaLocacao: alugueis?.ultimaLocacao ? new Date(alugueis.ultimaLocacao).toISOString() : null,
            statusAtual,
          } satisfies MostRentedBoard;
        })
        .sort((a, b) => {
          if (b.quantidadeAlugueisContratos !== a.quantidadeAlugueisContratos) {
            return b.quantidadeAlugueisContratos - a.quantidadeAlugueisContratos;
          }
          return b.receitaGerada - a.receitaGerada;
        })
        .slice(0, 10);

      return Result.ok(ranking);
    } catch {
      return Result.fail(
        new ValidationError([{ field: 'geral', message: 'Erro ao calcular ranking de placas mais alugadas' }])
      );
    }
  }

  async getIdleBoards(empresaId: string): Promise<Result<IdleBoard[], DomainError>> {
    try {
      const empresaObjectId = new mongoose.Types.ObjectId(empresaId);
      const now = new Date();
      const occupancyWindowDays = 180;
      const idleThresholdDays = 60;
      const windowStart = new Date(now.getTime() - occupancyWindowDays * DAY_MS);

      const [placas, alugueis] = await Promise.all([
        this.placaModel.aggregate([
          { $match: { empresaId: empresaObjectId } },
          {
            $lookup: {
              from: 'regiaos',
              localField: 'regiaoId',
              foreignField: '_id',
              as: 'regiaoDetalhes',
            },
          },
          { $unwind: { path: '$regiaoDetalhes', preserveNullAndEmptyArrays: true } },
          {
            $project: {
              _id: 1,
              numero_placa: 1,
              disponivel: { $ifNull: ['$disponivel', true] },
              regiao: { $ifNull: ['$regiaoDetalhes.nome', 'Sem Região'] },
            },
          },
        ]),
        this.aluguelModel.aggregate([
          { $match: { empresaId: empresaObjectId, status: { $ne: 'cancelado' } } },
          {
            $project: {
              placaId: 1,
              startDate: { $ifNull: ['$startDate', '$data_inicio'] },
              endDate: { $ifNull: ['$endDate', '$data_fim'] },
            },
          },
          { $match: { startDate: { $ne: null }, endDate: { $ne: null } } },
          { $sort: { endDate: -1 } },
        ]),
      ]);

      const alugueisByPlaca = new Map<string, AnyDoc[]>();
      alugueis.forEach((aluguel: AnyDoc) => {
        const key = String(aluguel.placaId);
        const list = alugueisByPlaca.get(key) || [];
        list.push(aluguel);
        alugueisByPlaca.set(key, list);
      });

      const commercialStatuses = await commercialAvailabilityProjection.resolveManyPlateCommercialStatuses({
        empresaId,
        placaIds: placas.map((placa: AnyDoc) => String(placa._id)),
        at: now,
      });

      const idleBoards = placas
        .map((placa: AnyDoc) => {
          const placaId = String(placa._id);
          const historico = alugueisByPlaca.get(placaId) || [];

          const neverRented = historico.length === 0;
          const latestRental = historico[0];
          const lastRentalEnd = neverRented || !latestRental ? null : safeDate(latestRental.endDate);
          const daysSinceLastRental =
            !lastRentalEnd ? null : Math.floor((now.getTime() - lastRentalEnd.getTime()) / DAY_MS);

          const occupiedDays = historico.reduce((sum, aluguel) => {
            const start = safeDate(aluguel.startDate);
            const end = safeDate(aluguel.endDate);
            if (!start || !end) return sum;
            return sum + overlapDays(start, end, windowStart, now);
          }, 0);

          const taxaOcupacao = toRate((occupiedDays / occupancyWindowDays) * 100);
          const baixaTaxaOcupacao = taxaOcupacao < 15;

          const isIdle =
            neverRented ||
            (typeof daysSinceLastRental === 'number' && daysSinceLastRental >= idleThresholdDays) ||
            baixaTaxaOcupacao;

          if (!isIdle) return null;

          const suggestion = neverRented
            ? 'Criar campanha de ativacao comercial para primeira locacao.'
            : (daysSinceLastRental || 0) >= 120
            ? 'Revisar preco e reposicionar oferta com urgencia.'
            : baixaTaxaOcupacao
            ? 'Priorizar em propostas com desconto de entrada.'
            : 'Acionar vendedor responsavel para nova rodada de contatos.';

          return {
            placaId,
            placa: placa.numero_placa,
            diasSemAluguel: daysSinceLastRental,
            nuncaAlugada: neverRented,
            baixaTaxaOcupacao,
            taxaOcupacao,
            regiao: placa.regiao,
            status: commercialStatuses.get(placaId)?.isCommerciallyAvailable ? 'disponivel' : 'ocupada',
            sugestaoAcao: suggestion,
          } satisfies IdleBoard;
        })
        .filter(Boolean) as IdleBoard[];

      idleBoards.sort((a, b) => {
        if (a.nuncaAlugada !== b.nuncaAlugada) {
          return a.nuncaAlugada ? -1 : 1;
        }
        return (b.diasSemAluguel || 0) - (a.diasSemAluguel || 0);
      });

      return Result.ok(idleBoards.slice(0, 20));
    } catch {
      return Result.fail(
        new ValidationError([{ field: 'geral', message: 'Erro ao calcular placas paradas' }])
      );
    }
  }

  async getRegionPerformance(empresaId: string): Promise<Result<RegionPerformance[], DomainError>> {
    try {
      const projection = new DashboardProjectionService({
        placaModel: this.placaModel,
        aluguelModel: this.aluguelModel,
        regiaoModel: this.regiaoModel,
        propostaModel: this.propostaModel,
        contratoModel: this.contratoModel,
      });
      const regionResult = await projection.getRegionPerformance(empresaId);
      return Result.ok(regionResult.data);

      const empresaObjectId = new mongoose.Types.ObjectId(empresaId);
      const now = new Date();

      const [
        placasPorRegiao,
        alugadasNow,
        propostasByRegion,
        contratosByRegion,
      ] = await Promise.all([
        this.placaModel.aggregate([
          { $match: { empresaId: empresaObjectId } },
          {
            $group: {
              _id: '$regiaoId',
              totalPlacas: { $sum: 1 },
              placaIds: { $addToSet: '$_id' },
            },
          },
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
              regiao: { $ifNull: ['$regiaoDetalhes.nome', 'Sem Região'] },
              totalPlacas: 1,
              placaIds: 1,
            },
          },
        ]),
        this.aluguelModel.aggregate([
          {
            $match: {
              empresaId: empresaObjectId,
              status: { $ne: 'cancelado' },
              $or: [
                { startDate: { $lte: now }, endDate: { $gte: now } },
                { data_inicio: { $lte: now }, data_fim: { $gte: now } },
              ],
            },
          },
          {
            $lookup: {
              from: 'placas',
              localField: 'placaId',
              foreignField: '_id',
              as: 'placa',
            },
          },
          { $unwind: { path: '$placa', preserveNullAndEmptyArrays: false } },
          { $group: { _id: '$placa.regiaoId', placasAlugadas: { $addToSet: '$placaId' } } },
          { $project: { _id: 1, placasAlugadas: { $size: '$placasAlugadas' } } },
        ]),
        this.propostaModel.aggregate([
          { $match: { empresaId: empresaObjectId, status: 'em_andamento' } },
          { $unwind: { path: '$placas', preserveNullAndEmptyArrays: false } },
          {
            $lookup: {
              from: 'placas',
              localField: 'placas',
              foreignField: '_id',
              as: 'placa',
            },
          },
          { $unwind: { path: '$placa', preserveNullAndEmptyArrays: false } },
          { $group: { _id: '$placa.regiaoId', propostasAbertas: { $sum: 1 } } },
        ]),
        this.contratoModel.aggregate([
          { $match: { empresaId: empresaObjectId, status: 'ativo' } },
          {
            $lookup: {
              from: 'propostainternas',
              localField: 'piId',
              foreignField: '_id',
              as: 'pi',
            },
          },
          { $unwind: { path: '$pi', preserveNullAndEmptyArrays: false } },
          { $unwind: { path: '$pi.placas', preserveNullAndEmptyArrays: false } },
          {
            $lookup: {
              from: 'placas',
              localField: 'pi.placas',
              foreignField: '_id',
              as: 'placa',
            },
          },
          { $unwind: { path: '$placa', preserveNullAndEmptyArrays: false } },
          {
            $group: {
              _id: '$placa.regiaoId',
              receitaEstimada: { $sum: { $ifNull: ['$pi.valorTotal', 0] } },
              contratosAtivos: { $sum: 1 },
            },
          },
        ]),
      ]);

      const alugadasMap = new Map<string, number>();
      alugadasNow.forEach((r: AnyDoc) => alugadasMap.set(String(r._id), Number(r.placasAlugadas || 0)));

      const propostasMap = new Map<string, number>();
      propostasByRegion.forEach((r: AnyDoc) => propostasMap.set(String(r._id), Number(r.propostasAbertas || 0)));

      const contratosMap = new Map<string, AnyDoc>();
      contratosByRegion.forEach((r: AnyDoc) => contratosMap.set(String(r._id), r));

      const allRegionPlateIds = placasPorRegiao.flatMap((row: AnyDoc) =>
        Array.isArray(row.placaIds) ? row.placaIds.map((id: unknown) => String(id)) : [],
      );
      const commercialStatuses = await commercialAvailabilityProjection.resolveManyPlateCommercialStatuses({
        empresaId,
        placaIds: allRegionPlateIds,
        at: now,
      });

      const result = placasPorRegiao
        .map((row: AnyDoc) => {
          const regiaoId = String(row._id);
          const totalPlacas = Number(row.totalPlacas || 0);
          const projectedCommerciallyOccupied = (row.placaIds || [])
            .map((id: unknown) => commercialStatuses.get(String(id)))
            .filter(isCommerciallyOccupied)
            .length;
          const placasAlugadas = Math.min(
            totalPlacas,
            Math.max(projectedCommerciallyOccupied, Number(alugadasMap.get(regiaoId) || 0)),
          );
          const taxaOcupacao = totalPlacas > 0 ? toRate((placasAlugadas / totalPlacas) * 100) : 0;

          const contratoData = contratosMap.get(regiaoId);

          return {
            regiaoId,
            regiao: row.regiao,
            totalPlacas,
            placasAlugadas,
            taxaOcupacao,
            receitaEstimada: toMoney(Number(contratoData?.receitaEstimada || 0)),
            propostasAbertas: Number(propostasMap.get(regiaoId) || 0),
            contratosAtivos: Number(contratoData?.contratosAtivos || 0),
          } satisfies RegionPerformance;
        })
        .sort((a, b) => {
          if (b.taxaOcupacao !== a.taxaOcupacao) return b.taxaOcupacao - a.taxaOcupacao;
          return b.receitaEstimada - a.receitaEstimada;
        });

      return Result.ok(result);
    } catch {
      return Result.fail(
        new ValidationError([{ field: 'geral', message: 'Erro ao calcular performance por região' }])
      );
    }
  }

  async getSalesFunnel(empresaId: string): Promise<Result<SalesFunnel, DomainError>> {
    try {
      const empresaObjectId = new mongoose.Types.ObjectId(empresaId);

      const [propostasStats, contratosGerados] = await Promise.all([
        this.propostaModel.aggregate([
          { $match: { empresaId: empresaObjectId } },
          {
            $group: {
              _id: null,
              propostasCriadas: { $sum: 1 },
              propostasEmNegociacao: {
                $sum: { $cond: [{ $eq: ['$status', 'em_andamento'] }, 1, 0] },
              },
              propostasAprovadas: {
                $sum: { $cond: [{ $eq: ['$status', 'concluida'] }, 1, 0] },
              },
              propostasRecusadas: {
                $sum: { $cond: [{ $eq: ['$status', 'vencida'] }, 1, 0] },
              },
            },
          },
        ]),
        this.contratoModel.countDocuments({ empresaId: empresaObjectId }),
      ]);

      const stats = propostasStats[0] || {
        propostasCriadas: 0,
        propostasEmNegociacao: 0,
        propostasAprovadas: 0,
        propostasRecusadas: 0,
      };

      const taxaConversao =
        stats.propostasCriadas > 0
          ? toRate((contratosGerados / stats.propostasCriadas) * 100)
          : 0;

      return Result.ok({
        propostasCriadas: stats.propostasCriadas,
        propostasEmNegociacao: stats.propostasEmNegociacao,
        propostasAprovadas: stats.propostasAprovadas,
        propostasRecusadas: stats.propostasRecusadas,
        contratosGerados,
        taxaConversao,
      });
    } catch {
      return Result.fail(
        new ValidationError([{ field: 'geral', message: 'Erro ao calcular funil comercial' }])
      );
    }
  }

  async getAlerts(empresaId: string): Promise<Result<DashboardAlert[], DomainError>> {
    try {
      const [regionPerformanceResult, idleBoardsResult] = await Promise.all([
        this.getRegionPerformance(empresaId),
        this.getIdleBoards(empresaId),
      ]);

      if (regionPerformanceResult.isFailure) return Result.fail(regionPerformanceResult.error);
      if (idleBoardsResult.isFailure) return Result.fail(idleBoardsResult.error);

      const regionPerformance = regionPerformanceResult.value;
      const idleBoards = idleBoardsResult.value;

      const alerts: DashboardAlert[] = [];

      regionPerformance
        .filter((r) => r.taxaOcupacao >= 70 && (r.totalPlacas - r.placasAlugadas) > 0)
        .slice(0, 3)
        .forEach((r) => {
          alerts.push({
            id: `high-demand-${r.regiaoId}`,
            tipo: 'high-demand-availability',
            titulo: `Alta demanda em ${r.regiao}`,
            descricao: `${r.totalPlacas - r.placasAlugadas} placas ainda disponiveis em região com ${r.taxaOcupacao}% de ocupacao.`,
            severidade: 'info',
            acaoSugerida: 'Priorizar contato com leads dessa regiao nas proximas 24h.',
            meta: { regiaoId: r.regiaoId },
          });
        });

      idleBoards.slice(0, 5).forEach((board) => {
        const severe = board.nuncaAlugada || (board.diasSemAluguel || 0) >= 120;
        alerts.push({
          id: `idle-${board.placaId}`,
          tipo: 'idle-board',
          titulo: `Placa ${board.placa} com baixa tracao`,
          descricao: board.nuncaAlugada
            ? 'Placa nunca alugada desde o cadastro.'
            : `${board.diasSemAluguel || 0} dias sem locacao.`,
          severidade: severe ? 'critical' : 'warning',
          acaoSugerida: board.sugestaoAcao,
          meta: { placaId: board.placaId, regiao: board.regiao },
        });
      });

      const empresaObjectId = new mongoose.Types.ObjectId(empresaId);
      const staleProposalDate = new Date(Date.now() - 14 * DAY_MS);
      const expiringContractDate = new Date(Date.now() + 30 * DAY_MS);

      const [stalePropostas, expiringContracts] = await Promise.all([
        this.propostaModel.find({
          empresaId: empresaObjectId,
          status: 'em_andamento',
          updatedAt: { $lte: staleProposalDate },
        }).select('_id pi_code updatedAt').limit(5).lean(),
        this.contratoModel.aggregate([
          { $match: { empresaId: empresaObjectId, status: 'ativo' } },
          {
            $lookup: {
              from: 'propostainternas',
              localField: 'piId',
              foreignField: '_id',
              as: 'pi',
            },
          },
          { $unwind: { path: '$pi', preserveNullAndEmptyArrays: false } },
          {
            $project: {
              _id: 1,
              numero: 1,
              dataFim: { $ifNull: ['$pi.endDate', '$pi.dataFim'] },
            },
          },
          { $match: { dataFim: { $ne: null, $lte: expiringContractDate } } },
          { $sort: { dataFim: 1 } },
          { $limit: 5 },
        ]),
      ]);

      stalePropostas.forEach((pi: AnyDoc) => {
        alerts.push({
          id: `stale-pi-${String(pi._id)}`,
          tipo: 'stale-proposal',
          titulo: `Proposta ${pi.pi_code || String(pi._id)} sem atualizacao`,
          descricao: 'Proposta em andamento sem atualizacao relevante ha mais de 14 dias.',
          severidade: 'warning',
          acaoSugerida: 'Atualizar status e definir proxima acao com o cliente.',
          meta: { propostaId: String(pi._id) },
        });
      });

      expiringContracts.forEach((contrato: AnyDoc) => {
        alerts.push({
          id: `exp-contract-${String(contrato._id)}`,
          tipo: 'expiring-contract',
          titulo: `Contrato ${contrato.numero} proximo do vencimento`,
          descricao: `Vencimento previsto para ${new Date(contrato.dataFim).toISOString().slice(0, 10)}.`,
          severidade: 'warning',
          acaoSugerida: 'Acionar renovacao antes da data limite.',
          meta: { contratoId: String(contrato._id) },
        });
      });

      regionPerformance
        .filter((r) => (r.totalPlacas - r.placasAlugadas) / Math.max(1, r.totalPlacas) >= 0.6 && r.contratosAtivos <= 1)
        .slice(0, 3)
        .forEach((r) => {
          alerts.push({
            id: `low-sales-${r.regiaoId}`,
            tipo: 'low-sales-high-availability',
            titulo: `Baixa venda em ${r.regiao}`,
            descricao: `Alta disponibilidade (${toRate(((r.totalPlacas - r.placasAlugadas) / Math.max(1, r.totalPlacas)) * 100)}%) com baixa conversao local.`,
            severidade: 'critical',
            acaoSugerida: 'Revisar estratégia comercial e pricing da regiao.',
            meta: { regiaoId: r.regiaoId },
          });
        });

      return Result.ok(alerts.slice(0, 20));
    } catch {
      return Result.fail(
        new ValidationError([{ field: 'geral', message: 'Erro ao calcular alertas inteligentes' }])
      );
    }
  }
}
