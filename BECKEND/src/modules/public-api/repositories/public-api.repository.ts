import { Result } from '@shared/core/Result';
import { DomainError, NotFoundError, ValidationError } from '@shared/core/DomainError';
import Placa from '@modules/placas/Placa';
import Cliente from '@modules/clientes/Cliente';
import { PublicPlacaInfo, RegisterPlacaInput } from '../dtos/public-api.dto';

/**
 * Repository para Public API
 */
export class PublicApiRepository {
  /**
   * Buscar informações de uma placa
   */
  async getPlacaInfo(placa: string, apiKey: string): Promise<Result<PublicPlacaInfo, DomainError>> {
    try {
      // Validar API key (simplificado - deveria vir de uma tabela de API keys)
      if (!apiKey || apiKey.length < 20) {
        return Result.fail(new ValidationError([{ field: 'apiKey', message: 'API key inválida' }]));
      }

      // Buscar placa
      const placaDoc = await Placa.findOne({ numero_placa: placa }).lean();

      if (!placaDoc) {
        return Result.fail(new NotFoundError('Placa', placa));
      }

      // Buscar cliente se houver
      let clienteInfo = null;
      if ((placaDoc as any).clienteId) {
        const clienteDoc = await Cliente.findById((placaDoc as any).clienteId).lean();
        if (clienteDoc) {
          clienteInfo = {
            nome: (clienteDoc as any).nome || '',
            email: (clienteDoc as any).email || '',
            telefone: (clienteDoc as any).telefone || ''
          };
        }
      }

      const result: PublicPlacaInfo = {
        placa: (placaDoc as any).numero_placa || placa,
        status: (placaDoc as any).status || 'disponivel',
        localizacao: (placaDoc as any).localizacao || 'Não informada',
        ultimaAtualizacao: (placaDoc as any).updatedAt || new Date(),
        cliente: clienteInfo
      };

      return Result.ok(result);
    } catch (error) {
      return Result.fail(
        new ValidationError([{
          field: 'geral',
          message: 'Erro ao buscar informações da placa'
        }])
      );
    }
  }

  /**
   * Registrar nova placa via API pública
   */
  async registerPlaca(data: RegisterPlacaInput, apiKey: string): Promise<Result<PublicPlacaInfo, DomainError>> {
    try {
      // Validar API key
      if (!apiKey || apiKey.length < 20) {
        return Result.fail(new ValidationError([{ field: 'apiKey', message: 'API key inválida' }]));
      }

      // Verificar se placa já existe
      const existing = await Placa.findOne({ numero_placa: data.placa }).lean();
      if (existing) {
        return Result.fail(new ValidationError([{ field: 'placa', message: 'Placa já cadastrada' }]));
      }

      // Criar nova placa
      const newPlaca = new Placa({
        numero_placa: data.placa,
        status: 'disponivel',
        localizacao: data.localizacao || 'Não informada',
        observacoes: data.observacoes || '',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await newPlaca.save();

      const result: PublicPlacaInfo = {
        placa: data.placa,
        status: 'disponivel',
        localizacao: data.localizacao || 'Não informada',
        ultimaAtualizacao: new Date(),
        cliente: null
      };

      return Result.ok(result);
    } catch (error) {
      return Result.fail(
        new ValidationError([{
          field: 'geral',
          message: 'Erro ao registrar placa'
        }])
      );
    }
  }

  /**
   * Verificar disponibilidade de uma placa
   */
  async checkAvailability(placa: string, apiKey: string): Promise<Result<{ disponivel: boolean }, DomainError>> {
    try {
      // Validar API key
      if (!apiKey || apiKey.length < 20) {
        return Result.fail(new ValidationError([{ field: 'apiKey', message: 'API key inválida' }]));
      }

      const placaDoc = await Placa.findOne({ numero_placa: placa }).lean();

      if (!placaDoc) {
        return Result.ok({ disponivel: false });
      }

      const disponivel = (placaDoc as any).status === 'disponivel';

      return Result.ok({ disponivel });
    } catch (error) {
      return Result.fail(
        new ValidationError([{
          field: 'geral',
          message: 'Erro ao verificar disponibilidade'
        }])
      );
    }
  }

  /**
   * Validar API key (método auxiliar)
   */
  async validateApiKey(apiKey: string): Promise<Result<boolean, DomainError>> {
    try {
      // Implementação simplificada
      // Em produção, deveria verificar em uma tabela de API keys
      if (!apiKey || apiKey.length < 20) {
        return Result.ok(false);
      }

      // TODO: Verificar em tabela de API keys
      // const keyDoc = await ApiKey.findOne({ key: apiKey, active: true }).lean();
      // return Result.ok(!!keyDoc);

      return Result.ok(true);
    } catch (error) {
      return Result.fail(
        new ValidationError([{
          field: 'geral',
          message: 'Erro ao validar API key'
        }])
      );
    }
  }
}
