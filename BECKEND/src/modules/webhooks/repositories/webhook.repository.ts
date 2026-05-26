import { Result } from '@shared/core/Result';
import { DomainError, NotFoundError, ValidationError } from '@shared/core/DomainError';
import { CreateWebhookInput, UpdateWebhookInput, ListWebhooksQuery, PaginatedWebhooksResponse, WebhookEntity, WebhookExecutionLog } from '../dtos/webhook.dto';

// Mock Webhook Model - Replace with actual import
const Webhook = {
  async findOne(_query: any) {
    return null;
  },
  async find(_query: any) {
    return { lean: () => [] };
  },
  async countDocuments(_query: any) {
    return 0;
  },
  async findById(_id: string) {
    return null;
  },
  async findByIdAndUpdate(_id: string, _data: any, _options: any) {
    return null;
  },
  async findByIdAndDelete(_id: string) {
    return null;
  },
  create(data: any) {
    return {
      save: async () => ({ _id: '123', ...data })
    };
  }
};

/**
 * Repository para Webhooks
 */
export class WebhookRepository {
  /**
   * Criar webhook
   */
  async create(data: CreateWebhookInput): Promise<Result<WebhookEntity, DomainError>> {
    try {
      // Verificar se já existe webhook com mesma URL
      const existing = await Webhook.findOne({ url: data.url });
      if (existing) {
        return Result.fail(
          new ValidationError([{
            field: 'url',
            message: 'Já existe um webhook com esta URL'
          }])
        );
      }

      const webhook = Webhook.create({
        url: data.url,
        events: data.events,
        secret: data.secret || this.generateSecret(),
        active: data.active ?? true,
        empresaId: data.empresaId,
        retryAttempts: data.retryAttempts ?? 3,
        timeout: data.timeout ?? 5000,
        statistics: {
          totalCalls: 0,
          successfulCalls: 0,
          failedCalls: 0
        },
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const saved = await webhook.save();

      return Result.ok({
        _id: saved._id,
        url: saved.url,
        events: saved.events,
        secret: saved.secret,
        active: saved.active,
        empresaId: saved.empresaId,
        retryAttempts: saved.retryAttempts ?? 3,
        timeout: saved.timeout ?? 5000,
        statistics: saved.statistics || {
          totalCalls: 0,
          successfulCalls: 0,
          failedCalls: 0
        },
        createdAt: saved.createdAt || new Date(),
        updatedAt: saved.updatedAt || new Date()
      });
    } catch (error) {
      return Result.fail(
        new ValidationError([{
          field: 'geral',
          message: 'Erro ao criar webhook'
        }])
      );
    }
  }

  /**
   * Buscar webhook por ID
   */
  async findById(id: string): Promise<Result<WebhookEntity | null, DomainError>> {
    try {
      const webhook = await Webhook.findById(id);

      if (!webhook) {
        return Result.ok(null);
      }

      return Result.ok({
        _id: (webhook as any)._id,
        url: (webhook as any).url,
        events: (webhook as any).events,
        secret: (webhook as any).secret,
        active: (webhook as any).active,
        empresaId: (webhook as any).empresaId,
        retryAttempts: (webhook as any).retryAttempts ?? 3,
        timeout: (webhook as any).timeout ?? 5000,
        statistics: (webhook as any).statistics || {
          totalCalls: 0,
          successfulCalls: 0,
          failedCalls: 0
        },
        createdAt: (webhook as any).createdAt || new Date(),
        updatedAt: (webhook as any).updatedAt || new Date()
      });
    } catch (error) {
      return Result.fail(
        new ValidationError([{
          field: 'geral',
          message: 'Erro ao buscar webhook'
        }])
      );
    }
  }

  /**
   * Listar webhooks
   */
  async list(query: ListWebhooksQuery): Promise<Result<PaginatedWebhooksResponse, DomainError>> {
    try {
      const { page = 1, limit = 10, active } = query;

      const filter: any = {};
      if (active !== undefined) {
        filter.active = active;
      }

      const webhooks = await (await Webhook.find(filter)).lean();
      const total = await Webhook.countDocuments(filter);

      const webhooksData: WebhookEntity[] = (webhooks as any[]).map((w: any) => ({
        _id: w._id,
        url: w.url,
        events: w.events,
        secret: w.secret,
        active: w.active,
        empresaId: w.empresaId,
        retryAttempts: w.retryAttempts ?? 3,
        timeout: w.timeout ?? 5000,
        statistics: w.statistics || {
          totalCalls: 0,
          successfulCalls: 0,
          failedCalls: 0
        },
        createdAt: w.createdAt || new Date(),
        updatedAt: w.updatedAt || new Date()
      }));

      return Result.ok({
        webhooks: webhooksData,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      return Result.fail(
        new ValidationError([{
          field: 'geral',
          message: 'Erro ao listar webhooks'
        }])
      );
    }
  }

  /**
   * Atualizar webhook
   */
  async update(id: string, data: UpdateWebhookInput): Promise<Result<WebhookEntity, DomainError>> {
    try {
      const webhook = await Webhook.findByIdAndUpdate(
        id,
        {
          ...data,
          updatedAt: new Date()
        },
        { new: true, runValidators: true }
      );

      if (!webhook) {
        return Result.fail(new NotFoundError('Webhook', id));
      }

      return Result.ok({
        _id: (webhook as any)._id,
        url: (webhook as any).url,
        events: (webhook as any).events,
        secret: (webhook as any).secret,
        active: (webhook as any).active,
        empresaId: (webhook as any).empresaId,
        retryAttempts: (webhook as any).retryAttempts ?? 3,
        timeout: (webhook as any).timeout ?? 5000,
        statistics: (webhook as any).statistics || {
          totalCalls: 0,
          successfulCalls: 0,
          failedCalls: 0
        },
        createdAt: (webhook as any).createdAt || new Date(),
        updatedAt: (webhook as any).updatedAt || new Date()
      });
    } catch (error) {
      return Result.fail(
        new ValidationError([{
          field: 'geral',
          message: 'Erro ao atualizar webhook'
        }])
      );
    }
  }

  /**
   * Deletar webhook
   */
  async delete(id: string): Promise<Result<void, DomainError>> {
    try {
      const webhook = await Webhook.findByIdAndDelete(id);

      if (!webhook) {
        return Result.fail(new NotFoundError('Webhook', id));
      }

      return Result.ok(undefined);
    } catch (error) {
      return Result.fail(
        new ValidationError([{
          field: 'geral',
          message: 'Erro ao deletar webhook'
        }])
      );
    }
  }

  /**
   * Executar webhook (enviar requisição)
   */
  async execute(id: string, event: string, payload: any): Promise<Result<WebhookExecutionLog, DomainError>> {
    try {
      const webhookResult = await this.findById(id);

      if (webhookResult.isFailure) {
        return Result.fail(webhookResult.error);
      }

      const webhook = webhookResult.value;

      if (!webhook) {
        return Result.fail(new NotFoundError('Webhook', id));
      }

      if (!webhook.active) {
        return Result.fail(
          new ValidationError([{
            field: 'webhook',
            message: 'Webhook está inativo'
          }])
        );
      }

      // TODO: Implementar envio real de HTTP request
      // const response = await fetch(webhook.url, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'X-Webhook-Secret': webhook.secret
      //   },
      //   body: JSON.stringify({ event, data: payload })
      // });

      const executionLog: WebhookExecutionLog = {
        webhookId: id,
        event,
        payload,
        status: 'success',
        statusCode: 200,
        executedAt: new Date()
      };

      return Result.ok(executionLog);
    } catch (error) {
      return Result.fail(
        new ValidationError([{
          field: 'geral',
          message: 'Erro ao executar webhook'
        }])
      );
    }
  }

  /**
   * Gerar secret aleatório
   */
  private generateSecret(): string {
    return Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
  }
}
