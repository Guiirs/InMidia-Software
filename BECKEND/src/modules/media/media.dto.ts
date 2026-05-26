import { z } from 'zod';
import { MediaCategories, MediaOwnerTypes, MediaSources } from '@database/schemas/mediaAsset.schema';

export const MAX_MEDIA_UPLOAD_SIZE = 5 * 1024 * 1024;
export const ALLOWED_MEDIA_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

const BooleanLikeSchema = z.union([z.boolean(), z.string()]).optional().transform((value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === 'true' || value === '1';
  return false;
});

export const UploadMediaSchema = z.object({
  ownerType: z.enum(MediaOwnerTypes),
  ownerId: z.string().min(1),
  category: z.enum(MediaCategories).default('OTHER'),
  source: z.enum(MediaSources).default('UPLOAD'),
  setAsMain: BooleanLikeSchema,
  preservePreviousMain: BooleanLikeSchema,
  generatedBy: z.string().optional(),
  templateId: z.string().optional(),
  generationSource: z.string().optional(),
  overlayData: z.union([z.record(z.string(), z.unknown()), z.string()]).optional(),
  version: z.coerce.number().int().positive().default(1),
  metadata: z.union([z.record(z.string(), z.unknown()), z.string()]).optional(),
});

export const ByOwnerParamsSchema = z.object({
  ownerType: z.enum(MediaOwnerTypes),
  ownerId: z.string().min(1),
});

export type UploadMediaDTO = z.infer<typeof UploadMediaSchema>;

export function parseJsonLike(value: unknown): Record<string, unknown> | undefined {
  if (!value) return undefined;
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== 'string') return undefined;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function validateUploadFile(file: Express.Multer.File | undefined): asserts file is Express.Multer.File {
  if (!file) throw new Error('Arquivo de imagem e obrigatorio.');
  if (!ALLOWED_MEDIA_MIME_TYPES.includes(file.mimetype as (typeof ALLOWED_MEDIA_MIME_TYPES)[number])) {
    throw new Error('Use uma imagem JPG, PNG ou WebP.');
  }
  if (file.size > MAX_MEDIA_UPLOAD_SIZE) {
    throw new Error('Imagem muito grande. Limite atual: 5 MB.');
  }
}
