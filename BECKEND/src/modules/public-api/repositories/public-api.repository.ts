import { Result } from '@shared/core/Result';
import { DomainError, NotFoundError, ValidationError } from '@shared/core/DomainError';
import Placa from '@modules/placas/Placa';
import Cliente from '@modules/clientes/Cliente';
import { publicApiKeyManager } from '../managers/public-api-key.manager';
import { PublicPlacaInfo, RegisterPlacaInput } from '../dtos/public-api.dto';

/**
 * Repository para Public API.
 * Todas as leituras/escritas tenant-scoped derivam empresaId da API key validada.
 */
export class PublicApiRepository {
  private async resolveEmpresaId(apiKey: string): Promise<Result<string, DomainError>> {
    const auth = await publicApiKeyManager.validate(apiKey);
    if (!auth.ok) {
      return Result.fail(new ValidationError([{ field: 'apiKey', message: auth.error.message }]));
    }
    return Result.ok(auth.context.key.empresaId);
  }

  async getPlacaInfo(placa: string, apiKey: string): Promise<Result<PublicPlacaInfo, DomainError>> {
    try {
      const tenantResult = await this.resolveEmpresaId(apiKey);
      if (tenantResult.isFailure) return Result.fail(tenantResult.error);
      const empresaId = tenantResult.value;

      const placaDoc = await Placa.findOne({ numero_placa: placa, empresaId }).lean();
      if (!placaDoc) {
        return Result.fail(new NotFoundError('Placa', placa));
      }

      let clienteInfo = null;
      if ((placaDoc as any).clienteId) {
        const clienteDoc = await Cliente.findOne({ _id: (placaDoc as any).clienteId, empresaId }).lean();
        if (clienteDoc) {
          clienteInfo = {
            nome: (clienteDoc as any).nome || '',
            email: (clienteDoc as any).email || '',
            telefone: (clienteDoc as any).telefone || '',
          };
        }
      }

      return Result.ok({
        placa: (placaDoc as any).numero_placa || placa,
        status: (placaDoc as any).status || 'disponivel',
        localizacao: (placaDoc as any).localizacao || 'Nao informada',
        ultimaAtualizacao: (placaDoc as any).updatedAt || new Date(),
        cliente: clienteInfo,
      });
    } catch {
      return Result.fail(
        new ValidationError([{ field: 'geral', message: 'Erro ao buscar informacoes da placa' }]),
      );
    }
  }

  async registerPlaca(data: RegisterPlacaInput, apiKey: string): Promise<Result<PublicPlacaInfo, DomainError>> {
    try {
      const tenantResult = await this.resolveEmpresaId(apiKey);
      if (tenantResult.isFailure) return Result.fail(tenantResult.error);
      const empresaId = tenantResult.value;

      const existing = await Placa.findOne({ numero_placa: data.placa, empresaId }).lean();
      if (existing) {
        return Result.fail(new ValidationError([{ field: 'placa', message: 'Placa ja cadastrada' }]));
      }

      await Placa.create({
        numero_placa: data.placa,
        status: 'disponivel',
        localizacao: data.localizacao || 'Nao informada',
        observacoes: data.observacoes || '',
        empresaId,
      });

      return Result.ok({
        placa: data.placa,
        status: 'disponivel',
        localizacao: data.localizacao || 'Nao informada',
        ultimaAtualizacao: new Date(),
        cliente: null,
      });
    } catch {
      return Result.fail(
        new ValidationError([{ field: 'geral', message: 'Erro ao registrar placa' }]),
      );
    }
  }

  async checkAvailability(placa: string, apiKey: string): Promise<Result<{ disponivel: boolean }, DomainError>> {
    try {
      const tenantResult = await this.resolveEmpresaId(apiKey);
      if (tenantResult.isFailure) return Result.fail(tenantResult.error);
      const empresaId = tenantResult.value;

      const placaDoc = await Placa.findOne({ numero_placa: placa, empresaId }).lean();
      if (!placaDoc) {
        return Result.ok({ disponivel: false });
      }

      return Result.ok({ disponivel: (placaDoc as any).status === 'disponivel' });
    } catch {
      return Result.fail(
        new ValidationError([{ field: 'geral', message: 'Erro ao verificar disponibilidade' }]),
      );
    }
  }

  async validateApiKey(apiKey: string): Promise<Result<boolean, DomainError>> {
    try {
      const auth = await publicApiKeyManager.validate(apiKey);
      return Result.ok(auth.ok);
    } catch {
      return Result.fail(
        new ValidationError([{ field: 'geral', message: 'Erro ao validar API key' }]),
      );
    }
  }
}
