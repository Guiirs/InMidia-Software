/**
 * Relatorio Service
 * Lógica de negócio para relatórios
 */

import { Result, DomainError, ValidationError } from '@shared/core';
import { ZodError } from 'zod';
import type { IRelatorioRepository } from '../repositories/relatorio.repository';
import type {
  PeriodoQuery,
  DashboardSummary,
  PlacasPorRegiao,
  RelatorioOcupacao,
} from '../dtos/relatorio.dto';

export class RelatorioService {
  constructor(private readonly repository: IRelatorioRepository) {}

  /**
   * Busca resumo do dashboard
   */
  async getDashboardSummary(empresaId: string): Promise<Result<DashboardSummary, DomainError>> {
    try {
      return await this.repository.getDashboardSummary(empresaId);
    } catch (error: any) {
      return Result.fail(
        new ValidationError(
          [{ field: 'empresaId', message: 'Erro ao buscar resumo do dashboard' }],
          'Erro ao buscar resumo do dashboard'
        )
      );
    }
  }

  /**
   * Busca placas agrupadas por região
   */
  async getPlacasPorRegiao(empresaId: string): Promise<Result<PlacasPorRegiao[], DomainError>> {
    try {
      return await this.repository.getPlacasPorRegiao(empresaId);
    } catch (error: any) {
      return Result.fail(
        new ValidationError(
          [{ field: 'empresaId', message: 'Erro ao buscar placas por região' }],
          'Erro ao buscar placas por região'
        )
      );
    }
  }

  /**
   * Calcula ocupação por período
   */
  async getOcupacaoPorPeriodo(
    empresaId: string,
    periodo: PeriodoQuery
  ): Promise<Result<RelatorioOcupacao, DomainError>> {
    try {
      const rawDataInicio = (periodo as any).dataInicio || (periodo as any).data_inicio;
      const rawDataFim = (periodo as any).dataFim || (periodo as any).data_fim;

      const dataInicio = new Date(rawDataInicio);
      const dataFim = new Date(rawDataFim);

      if (isNaN(dataInicio.getTime()) || isNaN(dataFim.getTime())) {
        return Result.fail(
          new ValidationError(
            [{ field: 'dataInicio', message: 'Datas inválidas' }],
            'Datas de relatório inválidas'
          )
        );
      }

      if (dataFim < dataInicio) {
        return Result.fail(
          new ValidationError(
            [{ field: 'dataFim', message: 'Data fim deve ser posterior à data início' }],
            'Período inválido'
          )
        );
      }

      return await this.repository.getOcupacaoPorPeriodo(empresaId, dataInicio, dataFim);
    } catch (error: any) {
      if (error instanceof ZodError) {
        const validationErrors = error.issues.map((err: any) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        return Result.fail(new ValidationError(validationErrors));
      }
      return Result.fail(
        new ValidationError(
          [{ field: 'periodo', message: 'Erro ao calcular ocupação' }],
          'Erro ao calcular ocupação'
        )
      );
    }
  }
}
