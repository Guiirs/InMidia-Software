/**
 * Validação isolada do JWT_SECRET — extraída de config.ts para ser testável
 * sem disparar os efeitos colaterais (process.exit) do carregamento do config.
 */

export const JWT_SECRET_MIN_LENGTH = 64;

export interface JwtSecretValidationResult {
  /** true se o segredo atende ao tamanho mínimo recomendado */
  ok: boolean;
  /** true se a aplicação deve abortar a inicialização */
  fatal: boolean;
  message?: string;
}

/**
 * Valida o JWT_SECRET para qualquer ambiente.
 * - Ausente: sempre fatal (não há fallback seguro).
 * - Curto (< JWT_SECRET_MIN_LENGTH) em produção: fatal.
 * - Curto em dev/test: apenas warning, não bloqueia.
 */
export function validateJwtSecret(
  secret: string | undefined,
  nodeEnv: string
): JwtSecretValidationResult {
  if (!secret) {
    return { ok: false, fatal: true, message: 'JWT_SECRET is not defined' };
  }

  if (secret.length < JWT_SECRET_MIN_LENGTH) {
    if (nodeEnv === 'production') {
      return {
        ok: false,
        fatal: true,
        message: `JWT_SECRET must be at least ${JWT_SECRET_MIN_LENGTH} characters in production`,
      };
    }

    return {
      ok: false,
      fatal: false,
      message: `JWT_SECRET is shorter than ${JWT_SECRET_MIN_LENGTH} characters — insecure for production`,
    };
  }

  return { ok: true, fatal: false };
}
