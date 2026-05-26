import { Model, Types } from 'mongoose';
import { Result } from '@shared/core/Result';
import { DomainError, ValidationError } from '@shared/core/DomainError';
import { DashboardStats } from '../dtos/admin.dto';

/**
 * Repository para operações administrativas
 */
export class AdminRepository {
  constructor(
    private readonly clienteModel: Model<any>,
    private readonly placaModel: Model<any>,
    private readonly aluguelModel: Model<any>,
    private readonly contratoModel: Model<any>,
    private readonly userModel: Model<any>,
    private readonly empresaModel: Model<any>,
    private readonly regiaoModel: Model<any>
  ) {}

  /**
   * Buscar estatísticas do dashboard
   */
  async getDashboardStats(startDate?: Date, endDate?: Date, empresaId?: string): Promise<Result<DashboardStats, DomainError>> {
    try {
      const filter: any = {};
      
      if (empresaId) {
        filter.empresaId = new Types.ObjectId(empresaId);
      }

      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = startDate;
        if (endDate) filter.createdAt.$lte = endDate;
      }

      // Overview
      const [totalClientes, totalPlacas, totalAlugueis, totalContratos, totalUsers] = await Promise.all([
        this.clienteModel.countDocuments(filter),
        this.placaModel.countDocuments(filter),
        this.aluguelModel.countDocuments(filter),
        this.contratoModel.countDocuments(filter),
        this.userModel.countDocuments()
      ]);

      // Aluguéis por status
      const alugueisAggregate = await this.aluguelModel.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            valorTotal: { $sum: '$valor_mensal' }
          }
        }
      ]);

      const alugueisStats = {
        ativos: alugueisAggregate.find(a => a._id === 'ATIVO')?.count || 0,
        inativos: alugueisAggregate.find(a => a._id === 'INATIVO')?.count || 0,
        aguardandoAprovacao: alugueisAggregate.find(a => a._id === 'AGUARDANDO_APROVACAO')?.count || 0,
        valorTotal: alugueisAggregate.reduce((sum, a) => sum + (a.valorTotal || 0), 0)
      };

      // Financeiro
      const receitaMensal = alugueisStats.valorTotal;
      const receitaAnual = receitaMensal * 12;
      const ticketMedio = totalAlugueis > 0 ? receitaMensal / totalAlugueis : 0;

      // Estatísticas por região
      const regioes = await this.regiaoModel.aggregate([
        {
          $lookup: {
            from: 'placas',
            localField: '_id',
            foreignField: 'regiaoId',
            as: 'placas'
          }
        },
        {
          $project: {
            nome: 1,
            totalPlacas: { $size: '$placas' }
          }
        }
      ]);

      // Estatísticas por empresa
      const empresas = await this.empresaModel.aggregate([
        {
          $lookup: {
            from: 'clientes',
            localField: '_id',
            foreignField: 'empresaId',
            as: 'clientes'
          }
        },
        {
          $lookup: {
            from: 'alugueis',
            localField: '_id',
            foreignField: 'empresaId',
            as: 'alugueis'
          }
        },
        {
          $project: {
            nome: 1,
            totalClientes: { $size: '$clientes' },
            totalAlugueis: { $size: '$alugueis' },
            receita: {
              $sum: '$alugueis.valor_mensal'
            }
          }
        }
      ]);

      const stats: DashboardStats = {
        overview: {
          totalClientes,
          totalPlacas,
          totalAlugueis,
          totalContratos,
          totalUsers
        },
        alugueis: alugueisStats,
        financeiro: {
          receitaMensal,
          receitaAnual,
          ticketMedio
        },
        regioes: regioes.map(r => ({
          nome: r.nome,
          totalPlacas: r.totalPlacas,
          totalAlugueis: 0 // TODO: adicionar lookup de alugueis
        })),
        empresas: empresas.map(e => ({
          nome: e.nome,
          totalClientes: e.totalClientes,
          totalAlugueis: e.totalAlugueis,
          receita: e.receita || 0
        }))
      };

      return Result.ok(stats);
    } catch (error: any) {
      return Result.fail(
        new ValidationError([{
          field: 'stats',
          message: error.message
        }])
      );
    }
  }

  /**
   * Executar operação em lote
   */
  async bulkOperation(
    entityType: string,
    operation: string,
    ids: string[],
    data?: Record<string, any>
  ): Promise<Result<{ processed: number; succeeded: number; failed: number; errors: any[] }, DomainError>> {
    try {
      const model = this._getModel(entityType);
      
      if (!model) {
        return Result.fail(
          new ValidationError([{
            field: 'entityType',
            message: 'Tipo de entidade inválido'
          }])
        );
      }

      const objectIds = ids.map(id => new Types.ObjectId(id));
      let result;
      const errors: any[] = [];

      switch (operation) {
        case 'DELETE':
          result = await model.deleteMany({ _id: { $in: objectIds } });
          break;
        
        case 'UPDATE':
          if (!data) {
            return Result.fail(
              new ValidationError([{
                field: 'data',
                message: 'Dados são obrigatórios para operação UPDATE'
              }])
            );
          }
          result = await model.updateMany(
            { _id: { $in: objectIds } },
            { $set: data }
          );
          break;
        
        case 'ACTIVATE':
          result = await model.updateMany(
            { _id: { $in: objectIds } },
            { $set: { status: 'ATIVO' } }
          );
          break;
        
        case 'DEACTIVATE':
          result = await model.updateMany(
            { _id: { $in: objectIds } },
            { $set: { status: 'INATIVO' } }
          );
          break;
        
        default:
          return Result.fail(
            new ValidationError([{
              field: 'operation',
              message: 'Operação inválida'
            }])
          );
      }

      const succeeded = 'modifiedCount' in result ? result.modifiedCount : ('deletedCount' in result ? result.deletedCount : 0);

      return Result.ok({
        processed: ids.length,
        succeeded,
        failed: ids.length - succeeded,
        errors
      });
    } catch (error: any) {
      return Result.fail(
        new ValidationError([{
          field: 'bulkOperation',
          message: error.message
        }])
      );
    }
  }

  /**
   * Obter modelo baseado no tipo de entidade
   */
  private _getModel(entityType: string): Model<any> | null {
    const models: Record<string, Model<any>> = {
      'CLIENTE': this.clienteModel,
      'PLACA': this.placaModel,
      'ALUGUEL': this.aluguelModel,
      'CONTRATO': this.contratoModel,
      'USER': this.userModel
    };

    return models[entityType] || null;
  }
}
