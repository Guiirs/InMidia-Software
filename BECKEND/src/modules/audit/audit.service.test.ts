import logger from '@shared/container/logger';
import { AuditService } from './audit.service';
import type { AuditLogDocument, AuditQuery, RecordAuditEventInput } from './audit.types';

jest.mock('@shared/container/logger', () => ({
  __esModule: true,
  default: {
    warn: jest.fn(),
  },
}));

class FailingAuditRepository {
  async create(_input: RecordAuditEventInput): Promise<AuditLogDocument> {
    const error = new Error('Validation failed: password=super-secret token=abc.def.ghi apiKey=my-key');
    Object.assign(error, {
      name: 'ValidationError',
      code: 'AUDIT_VALIDATION',
      errors: {
        empresaId: { message: 'Cast to ObjectId failed' },
        metadata: { message: 'Invalid metadata' },
      },
    });
    throw error;
  }

  async find(_query: AuditQuery): Promise<{ data: AuditLogDocument[]; total: number; page: number; limit: number }> {
    return { data: [], total: 0, page: 1, limit: 25 };
  }

  async findById(_id: string, _query: Pick<AuditQuery, 'empresaId' | 'isSuperadmin'>): Promise<AuditLogDocument | null> {
    return null;
  }

  async findByEntity(
    _entityType: string,
    _entityId: string,
    _query: AuditQuery
  ): Promise<{ data: AuditLogDocument[]; total: number; page: number; limit: number }> {
    return { data: [], total: 0, page: 1, limit: 25 };
  }
}

describe('AuditService failure logging', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loga erro com causa sanitizada e contexto seguro', async () => {
    const service = new AuditService(new FailingAuditRepository());

    await service.recordAuditEvent({
      empresaId: '699deac081306d4261f00d33',
      actor: { userId: 'user-123' },
      action: 'auth.login',
      module: 'auth',
      correlationId: 'rid-123',
      metadata: {
        password: 'input-password',
        token: 'input-token',
        apiKey: 'input-api-key',
      },
    });

    expect(logger.warn).toHaveBeenCalledTimes(1);
    const message = String((logger.warn as jest.Mock).mock.calls[0]?.[0]);
    expect(message).toContain('[AuditService] Falha ao registrar evento de auditoria');
    expect(message).toContain('code=AUDIT_VALIDATION');
    expect(message).toContain('reason=Validation failed: password=[REDACTED] token=[REDACTED] apiKey=[REDACTED]');
    expect(message).toContain('eventType=auth.login');
    expect(message).toContain('userId=user-123');
    expect(message).toContain('empresaId=699deac081306d4261f00d33');
    expect(message).toContain('rid=rid-123');
    expect(message).toContain('validationPaths=empresaId,metadata');
  });

  it('nao derruba fluxo principal em falha nao critica', async () => {
    const service = new AuditService(new FailingAuditRepository());

    await expect(
      service.recordAuditEvent({
        action: 'auth.login',
        module: 'auth',
      })
    ).resolves.toBeNull();
  });

  it('nao loga senha, token ou api-key', async () => {
    const service = new AuditService(new FailingAuditRepository());

    await service.recordAuditEvent({
      action: 'auth.login',
      module: 'auth',
      metadata: {
        senha: 'minha-senha',
        accessToken: 'token-secreto',
        api_key: 'api-key-secreta',
      },
    });

    const message = String((logger.warn as jest.Mock).mock.calls[0]?.[0]);
    expect(message).not.toContain('super-secret');
    expect(message).not.toContain('abc.def.ghi');
    expect(message).not.toContain('my-key');
    expect(message).not.toContain('minha-senha');
    expect(message).not.toContain('token-secreto');
    expect(message).not.toContain('api-key-secreta');
  });
});
