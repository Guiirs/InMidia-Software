/**
 * Validação isolada da configuração do Redis — extraída de config.ts para ser
 * testável sem disparar os efeitos colaterais (process.exit) do carregamento do config.
 */

export interface RedisConfigValidationInput {
  /** valor já normalizado de REDIS_ENABLED (config.redisEnabled) */
  enabled: boolean;
  /** true se REDIS_URL foi definido explicitamente no ambiente (sem fallback) */
  hasUrl: boolean;
  nodeEnv: string;
}

export interface RedisConfigValidationResult {
  ok: boolean;
  /** true se a aplicação deve abortar a inicialização */
  fatal: boolean;
  message?: string;
}

const FAIL_FAST_ENVIRONMENTS = new Set(['production', 'staging']);

/**
 * Em produção/staging, REDIS_ENABLED=true sem REDIS_URL é um erro de configuração
 * (o fallback para localhost nunca funciona nesses ambientes). Em dev/test,
 * o fallback é permitido (com warning emitido em config/redis.ts).
 */
export function validateRedisConfig(
  input: RedisConfigValidationInput
): RedisConfigValidationResult {
  const { enabled, hasUrl, nodeEnv } = input;

  if (enabled && !hasUrl && FAIL_FAST_ENVIRONMENTS.has(nodeEnv)) {
    return {
      ok: false,
      fatal: true,
      message: `REDIS_URL é obrigatório quando REDIS_ENABLED=true em NODE_ENV=${nodeEnv}`,
    };
  }

  return { ok: true, fatal: false };
}
