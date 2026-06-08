/**
 * DEPRECADO: Use services/checking.service.ts
 * 
 * Mantido para compatibilidade com código legado.
 * Este arquivo será removido em versão futura.
 */

import Checking from './Checking';
import { CheckingRepository } from './repositories/checking.repository';
import { CheckingService as NewCheckingService } from './services/checking.service';
import type { IChecking } from './Checking';

const repository = new CheckingRepository(Checking);
const newService = new NewCheckingService(repository);

class CheckingService {
  async createChecking(data: {
    empresaId: string;
    aluguelId: string;
    placaId: string;
    installerId: string;
    photoUrl: string;
    gpsCoordinates: any;
  }): Promise<IChecking | null> {
    const result = await newService.createChecking(data);

    if (result.isFailure) {
      console.error('[CheckingService Legacy] Erro:', result.error.message);
      return null;
    }

    return result.value as any;
  }

  async getCheckingById(id: string, empresaId: string): Promise<IChecking | null> {
    const result = await newService.getCheckingById(id, empresaId);

    if (result.isFailure) {
      console.error('[CheckingService Legacy] Erro:', result.error.message);
      return null;
    }

    return result.value as any;
  }

  async getCheckingsByAluguel(aluguelId: string, empresaId: string): Promise<IChecking[]> {
    const result = await newService.getCheckingsByAluguel(aluguelId, empresaId);

    if (result.isFailure) {
      console.error('[CheckingService Legacy] Erro:', result.error.message);
      return [];
    }

    return result.value as any;
  }
}

export default new CheckingService();
