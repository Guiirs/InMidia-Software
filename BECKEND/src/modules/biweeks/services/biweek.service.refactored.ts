import { Result } from '@shared/core/Result';
import { DomainError, NotFoundError } from '@shared/core/DomainError';
import { BiWeekRepository } from '../repositories/biweek.repository';
import { CreateBiWeekInput, UpdateBiWeekInput, BiWeekEntity, ListBiWeeksQuery, PaginatedBiWeeksResponse, GenerateBiWeeksInput, GenerateBiWeeksResult } from '../dtos/biweek.dto';

/**
 * Service para BiWeeks
 */
export class BiWeekService {
  constructor(private readonly biweekRepository: BiWeekRepository) {}

  /**
   * Criar BiWeek
   */
  async createBiWeek(data: CreateBiWeekInput): Promise<Result<BiWeekEntity, DomainError>> {
    return this.biweekRepository.create(data);
  }

  /**
   * Buscar BiWeek por ID
   */
  async getBiWeekById(id: string): Promise<Result<BiWeekEntity, DomainError>> {
    const result = await this.biweekRepository.findById(id);
    
    if (result.isFailure) {
      return Result.fail(result.error);
    }

    if (!result.value) {
      return Result.fail(
        new NotFoundError('BiWeek', id)
      );
    }

    return Result.ok(result.value);
  }

  /**
   * Listar BiWeeks
   */
  async listBiWeeks(query: ListBiWeeksQuery): Promise<Result<PaginatedBiWeeksResponse, DomainError>> {
    return this.biweekRepository.list(query);
  }

  /**
   * Atualizar BiWeek
   */
  async updateBiWeek(id: string, data: UpdateBiWeekInput): Promise<Result<BiWeekEntity, DomainError>> {
    return this.biweekRepository.update(id, data);
  }

  /**
   * Deletar BiWeek
   */
  async deleteBiWeek(id: string): Promise<Result<void, DomainError>> {
    return this.biweekRepository.delete(id);
  }

  /**
   * Gerar BiWeeks automaticamente para um ano
   */
  async generateBiWeeks(data: GenerateBiWeeksInput): Promise<Result<GenerateBiWeeksResult, DomainError>> {
    return this.biweekRepository.generateForYear(data.empresaId, data.ano);
  }
}
