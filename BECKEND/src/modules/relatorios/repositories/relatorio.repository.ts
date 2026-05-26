/**
 * Relatorio Repository
 * Agregações e queries de relatórios
 */

import { Model } from 'mongoose';
import mongoose from 'mongoose';
import { Result, DomainError, ValidationError } from '@shared/core';
import type {
  DashboardSummary,
  PlacasPorRegiao,
  RelatorioOcupacao,
} from '../dtos/relatorio.dto';

export interface IRelatorioRepository {
  /**
   * Busca resumo para dashboard
   */
  getDashboardSummary(empresaId: string): Promise<Result<DashboardSummary, DomainError>>;

  /**
   * Agrupa placas por região
   */
  getPlacasPorRegiao(empresaId: string): Promise<Result<PlacasPorRegiao[], DomainError>>;

  /**
   * Calcula ocupação por período
   */
  getOcupacaoPorPeriodo(
    empresaId: string,
    dataInicio: Date,
    dataFim: Date
  ): Promise<Result<RelatorioOcupacao, DomainError>>;
}

export class RelatorioRepository implements IRelatorioRepository {
  constructor(
    private readonly placaModel: Model<any>,
    private readonly aluguelModel: Model<any>,
    // @ts-expect-error - Usado nas agregações via collection name 'regiaos'
    private readonly _regiaoModel: Model<any>,
    // @ts-expect-error - Usado nas agregações via collection name 'clientes'
    private readonly _clienteModel: Model<any>
  ) {}

  async getDashboardSummary(empresaId: string): Promise<Result<DashboardSummary, DomainError>> {
    try {
      const empresaObjectId = new mongoose.Types.ObjectId(empresaId);

      const [totalPlacas, placasDisponiveis, regiaoResult] = await Promise.all([
        this.placaModel.countDocuments({ empresaId: empresaObjectId }),
        this.placaModel.countDocuments({ empresaId: empresaObjectId, disponivel: true }),
        this.placaModel.aggregate([
          { $match: { empresaId: empresaObjectId } },
          { $group: { _id: '$regiaoId', total: { $sum: 1 } } },
          { $sort: { total: -1 } },
          { $limit: 1 },
          {
            $lookup: {
              from: 'regiaos',
              localField: '_id',
              foreignField: '_id',
              as: 'regiaoDetalhes'
            }
          },
          { $unwind: { path: '$regiaoDetalhes', preserveNullAndEmptyArrays: true } },
          { $project: { _id: 0, nome: { $ifNull: ['$regiaoDetalhes.nome', 'N/A'] } } }
        ])
      ]);

      const regiaoPrincipal = regiaoResult.length > 0 ? regiaoResult[0].nome : 'N/A';

      return Result.ok({
        totalPlacas,
        placasDisponiveis,
        regiaoPrincipal,
      });
    } catch (error: any) {
      return Result.fail(
        new ValidationError([{ field: 'geral', message: 'Erro ao buscar resumo do dashboard' }])
      );
    }
  }

  async getPlacasPorRegiao(empresaId: string): Promise<Result<PlacasPorRegiao[], DomainError>> {
    try {
      const empresaObjectId = new mongoose.Types.ObjectId(empresaId);

      const data = await this.placaModel.aggregate([
        { $match: { empresaId: empresaObjectId } },
        { $group: { _id: '$regiaoId', total_placas: { $sum: 1 } } },
        { $sort: { total_placas: -1 } },
        {
          $lookup: {
            from: 'regiaos',
            localField: '_id',
            foreignField: '_id',
            as: 'regiaoDetalhes'
          }
        },
        { $unwind: { path: '$regiaoDetalhes', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            regiao: { $ifNull: ['$regiaoDetalhes.nome', 'Sem Região'] },
            total_placas: 1
          }
        }
      ]);

      return Result.ok(data);
    } catch (error: any) {
      return Result.fail(
        new ValidationError([{ field: 'geral', message: 'Erro ao buscar placas por região' }])
      );
    }
  }

  async getOcupacaoPorPeriodo(
    empresaId: string,
    dataInicio: Date,
    dataFim: Date
  ): Promise<Result<RelatorioOcupacao, DomainError>> {
    try {
      const empresaObjectId = new mongoose.Types.ObjectId(empresaId);
      const inicio = new Date(dataInicio);
      const fim = new Date(dataFim);
      fim.setDate(fim.getDate() + 1);

      const numDiasPeriodo = (fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24);

      // Ocupação por região
      const ocupacaoPorRegiao = await this.placaModel.aggregate([
        { $match: { empresaId: empresaObjectId } },
        {
          $lookup: {
            from: 'alugueis',
            let: { placaId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$$placaId', '$placaId'] },
                      { $lt: ['$data_inicio', fim] },
                      { $gt: ['$data_fim', inicio] }
                    ]
                  }
                }
              }
            ],
            as: 'alugueisNoPeriodo'
          }
        },
        {
          $project: {
            regiao: '$regiaoId',
            diasAlugados: {
              $sum: {
                $map: {
                  input: '$alugueisNoPeriodo',
                  as: 'aluguel',
                  in: {
                    $let: {
                      vars: {
                        effectiveStart: { $max: ['$$aluguel.data_inicio', inicio] },
                        effectiveEnd: { $min: ['$$aluguel.data_fim', fim] }
                      },
                      in: {
                        $divide: [
                          { $subtract: ['$$effectiveEnd', '$$effectiveStart'] },
                          1000 * 60 * 60 * 24
                        ]
                      }
                    }
                  }
                }
              }
            }
          }
        },
        {
          $group: {
            _id: '$regiao',
            totalPlacas: { $sum: 1 },
            totalDiasAlugados: { $sum: '$diasAlugados' }
          }
        },
        {
          $lookup: {
            from: 'regiaos',
            localField: '_id',
            foreignField: '_id',
            as: 'regiaoDetalhes'
          }
        },
        { $unwind: { path: '$regiaoDetalhes', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            regiao: { $ifNull: ['$regiaoDetalhes.nome', 'Sem Região'] },
            totalPlacas: 1,
            totalDiasAlugados: { $round: ['$totalDiasAlugados', 0] },
            totalDiasPlacas: { $multiply: ['$totalPlacas', numDiasPeriodo] },
            taxa_ocupacao_regiao: {
              $cond: {
                if: { $eq: [{ $multiply: ['$totalPlacas', numDiasPeriodo] }, 0] },
                then: 0,
                else: {
                  $multiply: [
                    { $divide: ['$totalDiasAlugados', { $multiply: ['$totalPlacas', numDiasPeriodo] }] },
                    100
                  ]
                }
              }
            }
          }
        }
      ]);

      // Novos aluguéis por cliente
      const novosAlugueisPorCliente = await this.aluguelModel.aggregate([
        {
          $match: {
            empresaId: empresaObjectId,
            data_inicio: { $gte: inicio, $lt: fim }
          }
        },
        {
          $group: {
            _id: '$clienteId',
            total_novos_alugueis: { $sum: 1 }
          }
        },
        { $sort: { total_novos_alugueis: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'clientes',
            localField: '_id',
            foreignField: '_id',
            as: 'clienteDetalhes'
          }
        },
        { $unwind: { path: '$clienteDetalhes', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            cliente_nome: { $ifNull: ['$clienteDetalhes.nome', 'Cliente Desconhecido'] },
            total_novos_alugueis: 1
          }
        }
      ]);

      // Cálculos globais
      const totalDiasAlugados = ocupacaoPorRegiao.reduce((sum, item) => sum + item.totalDiasAlugados, 0);
      const totalPlacas = ocupacaoPorRegiao.reduce((sum, item) => sum + item.totalPlacas, 0);
      const totalDiasPlacas = totalPlacas * numDiasPeriodo;
      const percentagem = totalDiasPlacas === 0 ? 0 : (totalDiasAlugados / totalDiasPlacas) * 100;
      const totalAlugueisNoPeriodo = novosAlugueisPorCliente.reduce((sum, item) => sum + item.total_novos_alugueis, 0);

      return Result.ok({
        totalDiasPlacas: Math.round(totalDiasPlacas),
        totalDiasAlugados: Math.round(totalDiasAlugados),
        percentagem: parseFloat(percentagem.toFixed(2)),
        totalAlugueisNoPeriodo,
        ocupacaoPorRegiao,
        novosAlugueisPorCliente,
      });
    } catch (error: any) {
      return Result.fail(
        new ValidationError([{ field: 'geral', message: 'Erro ao calcular ocupação por período' }])
      );
    }
  }
}
