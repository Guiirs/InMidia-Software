const SENSITIVE_KEYS = [
  'password',
  'senha',
  'token',
  'jwt',
  'refreshToken',
  'refresh_token',
  'secret',
  'apiKey',
  'api_key',
  'authorization',
  'cookie',
  'set-cookie',
  'headers',
  'accessKey',
  'secretAccessKey',
];

const MAX_STRING_LENGTH = 500;
const MAX_ARRAY_LENGTH = 25;
const MAX_OBJECT_KEYS = 50;
const MAX_DEPTH = 4;

const isSensitiveKey = (key: string): boolean => {
  const normalized = key.toLowerCase();
  return SENSITIVE_KEYS.some((sensitive) => normalized.includes(sensitive.toLowerCase()));
};

export function redactAuditValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === 'string') {
    return value.length > MAX_STRING_LENGTH
      ? `${value.slice(0, MAX_STRING_LENGTH)}...[truncated]`
      : value;
  }

  if (typeof value !== 'object') return value;

  if (depth >= MAX_DEPTH) {
    return '[summary_truncated_depth]';
  }

  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_LENGTH).map((item) => redactAuditValue(item, depth + 1));
  }

  const output: Record<string, unknown> = {};
  const entries = Object.entries(value as Record<string, unknown>).slice(0, MAX_OBJECT_KEYS);

  for (const [key, item] of entries) {
    output[key] = isSensitiveKey(key) ? '[REDACTED]' : redactAuditValue(item, depth + 1);
  }

  if (Object.keys(value as Record<string, unknown>).length > MAX_OBJECT_KEYS) {
    output.__truncatedKeys = true;
  }

  return output;
}
