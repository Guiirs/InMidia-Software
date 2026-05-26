import { Model } from 'mongoose';
import { Result } from '@shared/core/Result';
import { DomainError, ValidationError, NotFoundError } from '@shared/core/DomainError';
import { CreateBiWeekInput, UpdateBiWeekInput, BiWeekEntity, ListBiWeeksQuery, PaginatedBiWeeksResponse, GenerateBiWeeksResult } from '../dtos/biweek.dto';

/**
 * Repository para BiWeeks
 */
export class BiWeekRepository {
  constructor(private readonly model: Model<any>) {}

  /**
   * Criar BiWeek
   */
  async create(data: CreateBiWeekInput): Promise<Result<BiWeekEntity, DomainError>> {
    try {
      // Verificar se já existe
      const existing = await this.model.findOne({
        empresaId: data.empresaId,
        ano: data.ano,
        numero: data.numero
      }).lean().exec();

      if (existing) {
        return Result.fail(
          new ValidationError([{
            field: 'numero',
            message: `BiWeek ${data.numero}/${data.ano} já existe para esta empresa`
          }])
        );
      }

      const biweek = new this.model({
        ...data,
        nome: data.nome || `Quinzena ${data.numero}/${data.ano}`,
        ativo: true
      });

      await biweek.save();

      return Result.ok(biweek.toObject() as BiWeekEntity);
    } catch (error: any) {
      return Result.fail(
        new ValidationError([{
          field: 'database',
          message: error.message
        }])
      );
    }
  }

  /**
   * Buscar por ID
   */
  async findById(id: string): Promise<Result<BiWeekEntity | null, DomainError>> {
    try {
      const biweek = await this.model
        .findById(id)
        .lean<BiWeekEntity | null>()
        .exec();

      return Result.ok(biweek);
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
   * Listar BiWeeks
   */
  async list(query: ListBiWeeksQuery): Promise<Result<PaginatedBiWeeksResponse, DomainError>> {
    try {
      const {
        empresaId,
        ano,
        ativo,
        page = 1,
        limit = 26
      } = query;

      const filter: any = {};
      if (empresaId) filter.empresaId = empresaId;
      if (ano) filter.ano = ano;
      if (ativo !== undefined) filter.ativo = ativo;

      const skip = (page - 1) * limit;

      const [biweeks, total] = await Promise.all([
        this.model
          .find(filter)
          .sort({ ano: -1, numero: 1 })
          .skip(skip)
          .limit(limit)
          .lean<BiWeekEntity[]>()
          .exec(),
        this.model.countDocuments(filter)
      ]);

      return Result.ok({
        biweeks,
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
   * Atualizar BiWeek
   */
  async update(id: string, data: UpdateBiWeekInput): Promise<Result<BiWeekEntity, DomainError>> {
    try {
      const biweek = await this.model
        .findByIdAndUpdate(id, data, { new: true })
        .lean<BiWeekEntity | null>()
        .exec();

      if (!biweek) {
        return Result.fail(
          new NotFoundError('BiWeek', id)
        );
      }

      return Result.ok(biweek);
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
   * Deletar BiWeek
   */
  async delete(id: string): Promise<Result<void, DomainError>> {
    try {
      const result = await this.model.findByIdAndDelete(id).exec();

      if (!result) {
        return Result.fail(
          new NotFoundError('BiWeek', id)
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
   * Gerar BiWeeks automaticamente para um ano
   */
  async generateForYear(empresaId: string, ano: number): Promise<Result<GenerateBiWeeksResult, DomainError>> {
    try {
      const created: BiWeekEntity[] = [];
      let skipped = 0;

      // 26 quinzenas por ano (aproximadamente 14 dias cada)
      for (let numero = 1; numero <= 26; numero++) {
        // Calcular datas aproximadas
        const diasPorQuinzena = 14;
        const inicioAno = new Date(ano, 0, 1);
        const diasDesdeInicio = (numero - 1) * diasPorQuinzena;
        
        const data_inicio = new Date(inicioAno);
        data_inicio.setDate(data_inicio.getDate() + diasDesdeInicio);
        
        const data_fim = new Date(data_inicio);
        data_fim.setDate(data_fim.getDate() + diasPorQuinzena - 1);

        // Verificar se já existe
        const existing = await this.model.findOne({
          empresaId,
          ano,
          numero
        }).lean().exec();

        if (existing) {
          skipped++;
          continue;
        }

        // Criar
        const result = await this.create({
          empresaId,
          ano,
          numero,
          data_inicio,
          data_fim,
          nome: `Quinzena ${numero}/${ano}`
        });

        if (result.isSuccess) {
          created.push(result.value);
        }
      }

      return Result.ok({
        created: created.length,
        skipped,
        biweeks: created
      });
    } catch (error: any) {
      return Result.fail(
        new ValidationError([{
          field: 'generate',
          message: error.message
        }])
      );
    }
  }
}
