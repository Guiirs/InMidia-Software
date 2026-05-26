import { Result } from '@shared/core/Result';
import { DomainError, NotFoundError } from '@shared/core/DomainError';
import { WebhookRepository } from '../repositories/webhook.repository';
import { CreateWebhookInput, UpdateWebhookInput, ListWebhooksQuery, WebhookEntity, PaginatedWebhooksResponse, WebhookExecutionLog } from '../dtos/webhook.dto';

/**
 * Service para Webhooks
 */
export class WebhookService {
  constructor(private readonly webhookRepository: WebhookRepository) {}

  async createWebhook(data: CreateWebhookInput): Promise<Result<WebhookEntity, DomainError>> {
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

  async listWebhooks(query: ListWebhooksQuery): Promise<Result<PaginatedWebhooksResponse, DomainError>> {
    return this.webhookRepository.list(query);
  }

  async updateWebhook(id: string, data: UpdateWebhookInput): Promise<Result<WebhookEntity, DomainError>> {
    return this.webhookRepository.update(id, data);
  }

  async deleteWebhook(id: string): Promise<Result<void, DomainError>> {
    return this.webhookRepository.delete(id);
  }

  async executeWebhook(id: string, event: string, payload: any): Promise<Result<WebhookExecutionLog, DomainError>> {
    return this.webhookRepository.execute(id, event, payload);
  }
}
