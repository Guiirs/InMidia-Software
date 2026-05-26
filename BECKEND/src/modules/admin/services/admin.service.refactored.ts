import { Result } from '@shared/core/Result';
import { DomainError, ValidationError } from '@shared/core/DomainError';
import { AdminRepository } from '../repositories/admin.repository';
import { GetDashboardStatsQuery, DashboardStats, BulkOperationInput, BulkOperationResult, ClearCacheInput } from '../dtos/admin.dto';

/**
 * Service para operações administrativas
 */
export class AdminService {
  constructor(
    private readonly adminRepository: AdminRepository,
    private readonly cacheManager?: any // Redis ou similar
  ) {}

  /**
   * Obter estatísticas do dashboard
   */
  async getDashboardStats(query: GetDashboardStatsQuery): Promise<Result<DashboardStats, DomainError>> {
    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    return this.adminRepository.getDashboardStats(startDate, endDate, query.empresaId);
  }

  /**
   * Executar operação em lote
   */
  async bulkOperation(data: BulkOperationInput): Promise<Result<BulkOperationResult, DomainError>> {
    const result = await this.adminRepository.bulkOperation(
      data.entityType,
      data.operation,
      data.ids,
      data.data
    );

    if (result.isFailure) {
      return Result.fail(result.error);
    }

    return Result.ok({
      success: true,
      processed: result.value.processed,
      succeeded: result.value.succeeded,
      failed: result.value.failed,
      errors: result.value.errors
    });
  }

  /**
   * Limpar cache
   */
  async clearCache(data: ClearCacheInput): Promise<Result<{ cleared: number }, DomainError>> {
    try {
      if (!this.cacheManager) {
        return Result.fail(
          new ValidationError([{
            field: 'cache',
            message: 'Cache manager não configurado'
          }])
        );
      }

      let cleared = 0;

      if (data.cacheKey) {
        // Limpar chave específica
        await this.cacheManager.del(data.cacheKey);
        cleared = 1;
      } else if (data.pattern) {
        // Limpar por padrão
        const keys = await this.cacheManager.keys(data.pattern);
        if (keys.length > 0) {
          await this.cacheManager.del(...keys);
          cleared = keys.length;
        }
      } else {
        // Limpar tudo
        await this.cacheManager.flushall();
        cleared = -1; // Indica "tudo"
      }

      return Result.ok({ cleared });
    } catch (error: any) {
      return Result.fail(
        new ValidationError([{
          field: 'cache',
          message: error.message
        }])
      );
    }
  }

  /**
   * Obter informações do sistema
   */
  async getSystemInfo(): Promise<Result<any, DomainError>> {
    try {
      const info = {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        env: process.env.NODE_ENV || 'development'
      };

      return Result.ok(info);
    } catch (error: any) {
      return Result.fail(
        new ValidationError([{
          field: 'system',
          message: error.message
        }])
      );
    }
  }
}
