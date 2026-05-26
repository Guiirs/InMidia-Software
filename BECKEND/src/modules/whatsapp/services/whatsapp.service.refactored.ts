import { Result } from '@shared/core/Result';
import { DomainError, NotFoundError } from '@shared/core/DomainError';
import { WhatsAppRepository } from '../repositories/whatsapp.repository';
import {
  SendMessageInput,
  SendBulkMessagesInput,
  CreateTemplateInput,
  UpdateTemplateInput,
  ListTemplatesQuery,
  MessageEntity,
  TemplateEntity,
  PaginatedTemplatesResponse,
  BulkSendResult
} from '../dtos/whatsapp.dto';

/**
 * Service para WhatsApp
 */
export class WhatsAppService {
  constructor(private readonly whatsappRepository: WhatsAppRepository) {}

  async sendMessage(data: SendMessageInput): Promise<Result<MessageEntity, DomainError>> {
    return this.whatsappRepository.sendMessage(data);
  }

  async sendBulkMessages(data: SendBulkMessagesInput): Promise<Result<BulkSendResult, DomainError>> {
    return this.whatsappRepository.sendBulkMessages(data);
  }

  async getMessageStatus(id: string): Promise<Result<MessageEntity, DomainError>> {
    return this.whatsappRepository.getMessageStatus(id);
  }

  async createTemplate(data: CreateTemplateInput): Promise<Result<TemplateEntity, DomainError>> {
    return this.whatsappRepository.createTemplate(data);
  }

  async getTemplateById(id: string): Promise<Result<TemplateEntity, DomainError>> {
    const result = await this.whatsappRepository.findTemplateById(id);

    if (result.isFailure) {
      return Result.fail(result.error);
    }

    if (!result.value) {
      return Result.fail(new NotFoundError('Template', id));
    }

    return Result.ok(result.value);
  }

  async listTemplates(query: ListTemplatesQuery): Promise<Result<PaginatedTemplatesResponse, DomainError>> {
    return this.whatsappRepository.listTemplates(query);
  }

  async updateTemplate(id: string, data: UpdateTemplateInput): Promise<Result<TemplateEntity, DomainError>> {
    return this.whatsappRepository.updateTemplate(id, data);
  }

  async deleteTemplate(id: string): Promise<Result<void, DomainError>> {
    return this.whatsappRepository.deleteTemplate(id);
  }
}
