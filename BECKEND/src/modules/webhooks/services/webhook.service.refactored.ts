import { Result } from '@shared/core/Result';
import { DomainError, NotFoundError } from '@shared/core/DomainError';
import { WebhookRepository } from '../repositories/webhook.repository';
import { CreateWebhookInput, UpdateWebhookInput, ListWebhooksQuery, WebhookEntity, PaginatedWebhooksResponse, WebhookExecutionLog } from '../dtos/webhook.dto';

/**
 * Service para Webhooks
 */
export class WebhookService {
  constructor(private readonly webhookRepository: WebhookRepository) {}

  async createWebhook(data: CreateWebhookInput & { empresaId: string }): Promise<Result<WebhookEntity, DomainError>> {
    return this.webhookRepository.create(data);
  }

  async getWebhookById(id: string): Promise<Result<WebhookEntity, DomainError>> {
    const result = await this.webhookRepository.findById(id);

    if (result.isFailure) {
      return Result.fail(result.error);
    }

    if (!result.value) {
      return Result.fail(new NotFoundError('Webhook', id));
    }

    return Result.ok(result.value);
  }

  async listWebhooks(query: ListWebhooksQuery, empresaId: string): Promise<Result<PaginatedWebhooksResponse, DomainError>> {
    return this.webhookRepository.list({ ...query, empresaId });
  }

  async updateWebhook(id: string, empresaId: string, data: UpdateWebhookInput): Promise<Result<WebhookEntity, DomainError>> {
    return this.webhookRepository.update(id, empresaId, data);
  }

  async deleteWebhook(id: string, empresaId: string): Promise<Result<void, DomainError>> {
    return this.webhookRepository.delete(id, empresaId);
  }

  async executeWebhook(id: string, event: string, payload: any): Promise<Result<WebhookExecutionLog, DomainError>> {
    return this.webhookRepository.execute(id, event, payload);
  }
}
