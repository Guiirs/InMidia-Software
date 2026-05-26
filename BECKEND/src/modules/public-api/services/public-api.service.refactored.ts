import { Result } from '@shared/core/Result';
import { DomainError } from '@shared/core/DomainError';
import type { PublicApiRepository } from '../repositories/public-api.repository';
import { PublicPlacaInfo, RegisterPlacaInput } from '../dtos/public-api.dto';

/**
 * Service para Public API
 */
export class PublicApiService {
  constructor(private readonly publicApiRepository: PublicApiRepository) {}

  async getPlacaInfo(placa: string, apiKey: string): Promise<Result<PublicPlacaInfo, DomainError>> {
    return this.publicApiRepository.getPlacaInfo(placa, apiKey);
  }

  async registerPlaca(data: RegisterPlacaInput, apiKey: string): Promise<Result<PublicPlacaInfo, DomainError>> {
    return this.publicApiRepository.registerPlaca(data, apiKey);
  }

  async checkAvailability(placa: string, apiKey: string): Promise<Result<{ disponivel: boolean }, DomainError>> {
    return this.publicApiRepository.checkAvailability(placa, apiKey);
  }

  async validateApiKey(apiKey: string): Promise<Result<boolean, DomainError>> {
    return this.publicApiRepository.validateApiKey(apiKey);
  }
}
