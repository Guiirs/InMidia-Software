import path from 'path';
import type {
  MediaSource,
  MediaValidationIssue,
  MediaValidationResult,
} from '../contracts/media.contracts';

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif']);
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/avif']);
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

function getExtension(source: MediaSource): string | undefined {
  const value = source.filename ?? source.originalname ?? source.path ?? source.url ?? source.raw ?? source.key;
  if (!value) return undefined;
  return path.extname(value.split('?')[0] || '').toLowerCase();
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isUnsafe(value: string): boolean {
  const lower = value.toLowerCase();
  return lower.startsWith('javascript:') || lower.startsWith('data:') || value.includes('..\\') || value.includes('../');
}

export class MediaValidator {
  validateMediaAsset(source: MediaSource, knownAssetIds: string[] = []): MediaValidationResult {
    const issues: MediaValidationIssue[] = [];
    const raw = source.url ?? source.path ?? source.filename ?? source.raw ?? source.key;

    if (!raw) {
      issues.push({
        code: 'ASSET_MISSING',
        level: 'warning',
        message: 'Media asset ausente ou nao informado.',
      });
      return { ok: false, status: 'unknown', issues };
    }

    if (isUnsafe(raw)) {
      issues.push({
        code: 'UNSAFE_SOURCE',
        level: 'error',
        message: 'Fonte de media insegura ou invalida.',
      });
    }

    if ((source.sourceType === 'remote-url' || source.sourceType === 'external-url') && !isHttpUrl(raw)) {
      issues.push({
        code: 'INVALID_URL',
        level: 'error',
        message: 'URL de media invalida.',
      });
    }

    if (source.sourceType === 'local-path' && raw.trim().length === 0) {
      issues.push({
        code: 'INVALID_LOCAL_PATH',
        level: 'error',
        message: 'Path local de media invalido.',
      });
    }

    const extension = getExtension(source);
    if (!extension) {
      issues.push({
        code: 'INSUFFICIENT_METADATA',
        level: 'warning',
        message: 'Extensao do asset nao identificada.',
      });
    } else if (!ALLOWED_EXTENSIONS.has(extension)) {
      issues.push({
        code: 'EXTENSION_NOT_ALLOWED',
        level: 'error',
        message: 'Extensao de media nao permitida.',
        meta: { extension },
      });
    }

    if (source.mimetype && !ALLOWED_MIME_TYPES.has(source.mimetype)) {
      issues.push({
        code: 'MIME_TYPE_NOT_ALLOWED',
        level: 'error',
        message: 'Mime type de media nao permitido.',
        meta: { mimeType: source.mimetype },
      });
    }

    if (typeof source.size === 'number' && source.size > MAX_SIZE_BYTES) {
      issues.push({
        code: 'SIZE_TOO_LARGE',
        level: 'error',
        message: 'Media asset excede tamanho maximo permitido.',
        meta: { size: source.size, maxSize: MAX_SIZE_BYTES },
      });
    }

    if (knownAssetIds.includes(raw)) {
      issues.push({
        code: 'DUPLICATE_ASSET',
        level: 'warning',
        message: 'Media asset duplicado no contexto informado.',
      });
    }

    const hasError = issues.some((issue) => issue.level === 'error');
    return {
      ok: !hasError,
      status: hasError ? 'invalid' : 'valid',
      issues,
    };
  }
}
