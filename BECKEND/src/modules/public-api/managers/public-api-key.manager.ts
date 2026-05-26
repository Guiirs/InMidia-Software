import bcrypt from 'bcryptjs';
import Empresa from '@modules/empresas/Empresa';
import type {
  PublicApiAuthContext,
  PublicApiError,
  PublicApiKey,
  PublicApiScope,
} from '../contracts/public-api.contracts';

const DEFAULT_SCOPES: PublicApiScope[] = [
  'inventory:read',
  'inventory:availability',
  'media:read',
  'geo:read',
  'catalog:read',
];

const CACHE_TTL_MS = 60_000;

interface CacheEntry {
  context: PublicApiAuthContext;
  expiresAt: number;
}

function makeError(
  code: PublicApiError['code'],
  message: string,
  status: number,
): { ok: false; error: PublicApiError } {
  return { ok: false, error: { code, message, status } };
}

function cryptoId(): string {
  return `pub_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Centraliza validação de API Key pública:
 * - Parse do formato prefix_secret
 * - Lookup por prefix no MongoDB
 * - Comparação bcrypt do secret com hash
 * - Cache em memória com TTL de 60s para evitar bcrypt em cada request
 * - Atualização assíncrona de lastUsedAt
 * - Suporte futuro a "Authorization: Bearer prefix_secret"
 */
export class PublicApiKeyManager {
  private readonly cache = new Map<string, CacheEntry>();

  /**
   * Valida rawKey lida do header x-api-key (ou Authorization: Bearer).
   * Retorna contexto completo com empresaId, scopes e requestId único.
   */
  async validate(
    rawKey: string | undefined,
  ): Promise<{ ok: true; context: PublicApiAuthContext } | { ok: false; error: PublicApiError }> {
    if (!rawKey) {
      return makeError('PUBLIC_API_KEY_MISSING', 'API key ausente.', 401);
    }

    const normalized = rawKey.startsWith('Bearer ') ? rawKey.slice(7).trim() : rawKey;

    const cached = this.cache.get(normalized);
    if (cached) {
      if (cached.expiresAt > Date.now()) {
        return {
          ok: true,
          context: { ...cached.context, requestId: cryptoId() },
        };
      }
      this.cache.delete(normalized);
    }

    const underscoreIdx = normalized.lastIndexOf('_');
    if (underscoreIdx < 1) {
      return makeError('PUBLIC_API_KEY_INVALID', 'API key invalida.', 403);
    }

    const prefix = normalized.slice(0, underscoreIdx);
    const secret = normalized.slice(underscoreIdx + 1);

    if (!secret) {
      return makeError('PUBLIC_API_KEY_INVALID', 'API key invalida.', 403);
    }

    const empresa = await Empresa.findOne({ api_key_prefix: prefix })
      .select('_id nome ativo api_key_hash')
      .lean();

    if (!empresa || !empresa.api_key_hash) {
      return makeError('PUBLIC_API_KEY_INVALID', 'API key invalida.', 403);
    }

    if (empresa.ativo === false) {
      return makeError('PUBLIC_API_KEY_INACTIVE', 'API key inativa.', 403);
    }

    const match = await bcrypt.compare(secret, empresa.api_key_hash);
    if (!match) {
      return makeError('PUBLIC_API_KEY_INVALID', 'API key invalida.', 403);
    }

    const empresaId = empresa._id.toString();

    const key: PublicApiKey = {
      id: prefix,
      keyPrefix: prefix,
      partnerId: `empresa-${empresaId}`,
      empresaId,
      scopes: DEFAULT_SCOPES,
      active: true,
      createdAt: new Date().toISOString(),
    };

    const context: PublicApiAuthContext = {
      key,
      partner: {
        id: key.partnerId,
        name: (empresa as any).nome ?? '',
        empresaId,
        active: true,
        scopes: DEFAULT_SCOPES,
      },
      requestId: cryptoId(),
    };

    this.cache.set(normalized, { context, expiresAt: Date.now() + CACHE_TTL_MS });
    this.updateLastUsed(empresaId);

    return { ok: true, context };
  }

  private updateLastUsed(empresaId: string): void {
    Empresa.findByIdAndUpdate(empresaId, {
      $set: { api_key_last_used_at: new Date() },
    }).catch(() => {});
  }

  /** Invalida entrada de cache pelo rawKey (usado quando a chave é conhecida). */
  invalidate(rawKey: string): void {
    this.cache.delete(rawKey);
  }

  /**
   * Invalida todas as entradas de cache associadas a uma empresa.
   * Chamado após regeneração de API Key para evitar que a chave antiga
   * permaneça válida no cache pelo TTL restante.
   */
  invalidateByEmpresaId(empresaId: string): void {
    for (const [key, entry] of this.cache.entries()) {
      if (entry.context.key.empresaId === empresaId) {
        this.cache.delete(key);
      }
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const publicApiKeyManager = new PublicApiKeyManager();
