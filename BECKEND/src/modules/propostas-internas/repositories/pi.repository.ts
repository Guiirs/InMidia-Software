import { Model, Types } from 'mongoose';
import { Result } from '@shared/core/Result';
import { DomainError, ValidationError, NotFoundError } from '@shared/core/DomainError';
import { CreatePIInput, UpdatePIInput, PIEntity, ListPIsQuery, PaginatedPIsResponse } from '../dtos/pi.dto';

/**
 * 🎯 POC - REPOSITORY LAYER
 * 
 * Responsabilidade: Acesso a dados
 * - Queries ao MongoDB
 * - Conversão de documentos para entidades
 * - Result Pattern para error handling
 */
export class PIRepository {
  constructor(
    private readonly model: Model<any>,
    private readonly clienteModel: Model<any>,
    private readonly empresaModel: Model<any>,
    private readonly placaModel: Model<any>
  ) {}

  /**
   * Gera código único para PI
   */
  private _generatePICode(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `PI-${timestamp}-${random}`.toUpperCase();
  }

  /**
   * Criar nova PI
   */
  async create(data: CreatePIInput): Promise<Result<PIEntity, DomainError>> {
    try {
      // Validar cliente existe
      const cliente = await this.clienteModel
        .findById(data.clienteId)
        .lean<{ _id: Types.ObjectId; nome: string } | null>()
        .exec();

      if (!cliente) {
        return Result.fail(
          new NotFoundError('Cliente', data.clienteId)
        );
      }

      // Validar empresa existe
      const empresa = await this.empresaModel
        .findById(data.empresaId)
        .lean<{ _id: Types.ObjectId } | null>()
        .exec();

      if (!empresa) {
        return Result.fail(
          new NotFoundError('Empresa', data.empresaId)
        );
      }

      // Validar placas existem
      const placas = await this.placaModel
        .find({ _id: { $in: data.placaIds } })
        .lean<Array<{ _id: Types.ObjectId }>>()
        .exec();

      if (placas.length !== data.placaIds.length) {
        return Result.fail(
          new ValidationError([{
            field: 'placaIds',
            message: 'Uma ou mais placas não foram encontradas'
          }])
        );
      }

      // Criar PI com código único
      const pi = new this.model({
        pi_code: this._generatePICode(),
        clienteId: data.clienteId,
        empresaId: data.empresaId,
        placaIds: data.placaIds,
        // Período unificado
        periodType: data.period.periodType,
        startDate: data.period.startDate,
        endDate: data.period.endDate,
        biWeekIds: data.period.biWeekIds,
        // Campos legados (compatibilidade)
        data_inicio: data.period.startDate,
        data_fim: data.period.endDate,
        bi_week_ids: data.period.biWeekIds,
        // Valores
        valor_mensal: data.valor_mensal,
        desconto: data.desconto,
        observacoes: data.observacoes,
        produtorId: data.produtorId,
        status: 'PENDENTE',
      });

      await pi.save();

      return Result.ok(pi.toObject() as PIEntity);
    } catch (error: any) {
      return Result.fail(
        new ValidationError([{
          field: 'database',
          message: error.message || 'Erro ao criar PI'
        }])
      );
    }
  }

  /**
   * Buscar PI por ID com populate
   */
  async findById(id: string): Promise<Result<PIEntity | null, DomainError>> {
    try {
      const pi = await this.model
        .findById(id)
        .populate('clienteId', 'nome email')
        .populate('placaIds', 'numero_placa regiaoId')
        .lean<PIEntity | null>()
        .exec();

      return Result.ok(pi);
    } catch (error: any) {
      return Result.fail(
        new ValidationError([{
          field: 'id',
          message: 'ID inválido'
        }])
      );
    }
  }

  /**
   * Listar PIs com filtros e paginação
   */
  async list(query: ListPIsQuery): Promise<Result<PaginatedPIsResponse, DomainError>> {
    try {
      const {
        clienteId,
        empresaId,
        status,
        produtorId,
        startDate,
        endDate,
        page = 1,
        limit = 20
      } = query;

      // Construir filtro dinâmico
      const filter: any = {};
      if (clienteId) filter.clienteId = clienteId;
      if (empresaId) filter.empresaId = empresaId;
      if (status) filter.status = status;
      if (produtorId) filter.produtorId = produtorId;
      if (startDate || endDate) {
        filter.startDate = {};
        if (startDate) filter.startDate.$gte = new Date(startDate);
        if (endDate) filter.startDate.$lte = new Date(endDate);
      }

      const skip = (page - 1) * limit;

      // Query paginada
      const [pis, total] = await Promise.all([
        this.model
          .find(filter)
          .populate('clienteId', 'nome email')
          .populate('placaIds', 'numero_placa regiaoId')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean<PIEntity[]>()
          .exec(),
        this.model.countDocuments(filter)
      ]);

      return Result.ok({
        pis,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error: any) {
      return Result.fail(
        new ValidationError([{
          field: 'query',
          message: error.message
        }])
      );
    }
  }

  /**
   * Atualizar PI
   */
  async update(id: string, data: UpdatePIInput): Promise<Result<PIEntity, DomainError>> {
    try {
      // Se mudar placas, validar que existem
      if (data.placaIds) {
        const placas = await this.placaModel
          .find({ _id: { $in: data.placaIds } })
          .lean<Array<{ _id: Types.ObjectId }>>()
          .exec();

        if (placas.length !== data.placaIds.length) {
          return Result.fail(
            new ValidationError([{
              field: 'placaIds',
              message: 'Uma ou mais placas não foram encontradas'
            }])
          );
        }
      }

      const updateData: any = { ...data };

      // Se atualizar período, atualizar também campos legados
      if (data.period) {
        updateData.periodType = data.period.periodType;
        updateData.startDate = data.period.startDate;
        updateData.endDate = data.period.endDate;
        updateData.biWeekIds = data.period.biWeekIds;
        updateData.data_inicio = data.period.startDate;
        updateData.data_fim = data.period.endDate;
        updateData.bi_week_ids = data.period.biWeekIds;
        delete updateData.period;
      }

      const pi = await this.model
        .findByIdAndUpdate(id, updateData, { new: true })
        .populate('clienteId', 'nome email')
        .populate('placaIds', 'numero_placa regiaoId')
        .lean<PIEntity | null>()
        .exec();

      if (!pi) {
        return Result.fail(
          new NotFoundError('PI', id)
        );
      }

      return Result.ok(pi);
    } catch (error: any) {
      return Result.fail(
        new ValidationError([{
          field: 'update',
          message: error.message
        }])
      );
    }
  }

  /**
   * Deletar PI
   */
  async delete(id: string): Promise<Result<void, DomainError>> {
    try {
      const result = await this.model.findByIdAndDelete(id).exec();

      if (!result) {
        return Result.fail(
          new NotFoundError('PI', id)
        );
      }

      return Result.ok(undefined);
    } catch (error: any) {
      return Result.fail(
        new ValidationError([{
          field: 'delete',
          message: error.message
        }])
      );
    }
  }

  /**
   * Buscar PIs por cliente
   */
  async findByCliente(clienteId: string): Promise<Result<PIEntity[], DomainError>> {
    try {
      const pis = await this.model
        .find({ clienteId })
        .populate('placaIds', 'numero_placa regiaoId')
        .sort({ createdAt: -1 })
        .lean<PIEntity[]>()
        .exec();

      return Result.ok(pis);
    } catch (error: any) {
      return Result.fail(
        new ValidationError([{
          field: 'clienteId',
          message: error.message
        }])
      );
    }
  }
}
