import { getR2BucketName } from '@shared/infra/storage/r2-client';
import { extractR2Key } from '@shared/infra/storage/r2-key.helper';

const ALLOWED_IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.avif',
  '.svg',
]);

type ImageLike = Record<string, any>;

export interface ResolvePlacaImageKeyResult {
  key: string | null;
  sourceField: string | null;
  rawValue: string | null;
}

export interface PlacaImageReference {
  hasImage: boolean;
  storageKey: string | null;
  sourceField: string | null;
}

function cleanString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function hasAllowedImageExtension(key: string): boolean {
  const path = key.split(/[?#]/, 1)[0] ?? '';
  const dotIdx = path.lastIndexOf('.');
  if (dotIdx === -1) return false;
  return ALLOWED_IMAGE_EXTENSIONS.has(path.slice(dotIdx).toLowerCase());
}

function isPathSafe(key: string): boolean {
  if (!key || key.startsWith('/') || key.includes('\0')) return false;
  return key.split('/').every((segment) => segment !== '.' && segment !== '..');
}

function storedUrlToKey(value: string): string | null {
  let raw = value.trim();
  if (!raw) return null;

  if (/^https?:\/\//i.test(raw)) {
    if (raw.includes('..')) return null;
    try {
      const parsed = new URL(raw);
      raw = parsed.pathname.replace(/^\/+/, '');
    } catch {
      return null;
    }
  } else {
    raw = (raw.split(/[?#]/, 1)[0] ?? '').replace(/^\/+/, '');
  }

  const bucket = getR2BucketName();
  if (bucket && raw.startsWith(`${bucket}/`)) {
    raw = raw.slice(bucket.length + 1);
  }

  if (!isPathSafe(raw) || !hasAllowedImageExtension(raw)) return null;
  return raw;
}

function keyFromStoredValue(value: unknown): string | null {
  const raw = cleanString(value);
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw) && !raw.includes('/')) return null;
  const extracted = extractR2Key(raw);
  if (extracted && extracted.includes('/')) return extracted;
  return storedUrlToKey(raw);
}

function mainImageFromGallery(images: unknown): ImageLike | null {
  if (!Array.isArray(images)) return null;
  return (
    images.find((image) => image?.isMain) ??
    images.find((image) => image?.category === 'MAIN') ??
    images[0] ??
    null
  );
}

function addCandidate(
  candidates: Array<{ field: string; value: unknown }>,
  field: string,
  value: unknown,
): void {
  if (cleanString(value)) candidates.push({ field, value });
}

function addImageObjectCandidates(
  candidates: Array<{ field: string; value: unknown }>,
  prefix: string,
  image: unknown,
): void {
  if (!image || typeof image !== 'object') return;
  const item = image as ImageLike;
  addCandidate(candidates, `${prefix}.storageKey`, item.storageKey);
  addCandidate(candidates, `${prefix}.imagemKey`, item.imagemKey);
  addCandidate(candidates, `${prefix}.r2Key`, item.r2Key);
  addCandidate(candidates, `${prefix}.key`, item.key);
  addCandidate(candidates, `${prefix}.path`, item.path);
  addCandidate(candidates, `${prefix}.publicUrl`, item.publicUrl);
  addCandidate(candidates, `${prefix}.url`, item.url);
  addCandidate(candidates, `${prefix}.imageUrl`, item.imageUrl);
  addCandidate(candidates, `${prefix}.src`, item.src);
}

export function getPlacaImageCandidates(placa: ImageLike): Array<{ field: string; value: unknown }> {
  const candidates: Array<{ field: string; value: unknown }> = [];
  const images = Array.isArray(placa?.images)
    ? placa.images
    : Array.isArray(placa?.imagens)
      ? placa.imagens
      : [];
  addCandidate(candidates, 'mainImageUrl', placa?.mainImageUrl);
  addCandidate(candidates, 'imagem', placa?.imagem);
  addImageObjectCandidates(candidates, 'imagem', placa?.imagem);
  addCandidate(candidates, 'foto', placa?.foto);
  addImageObjectCandidates(candidates, 'foto', placa?.foto);
  addCandidate(candidates, 'imageUrl', placa?.imageUrl);
  addCandidate(candidates, 'fotoUrl', placa?.fotoUrl);
  addCandidate(candidates, 'urlImagem', placa?.urlImagem);
  addCandidate(candidates, 'imagemPrincipal', placa?.imagemPrincipal);
  const mainImage = placa?.mainImage ?? mainImageFromGallery(images);
  addImageObjectCandidates(candidates, 'mainImage', mainImage);
  addCandidate(candidates, 'storageKey', placa?.storageKey);
  addCandidate(candidates, 'imagemKey', placa?.imagemKey);
  addCandidate(candidates, 'r2Key', placa?.r2Key);
  addImageObjectCandidates(candidates, 'arquivo', placa?.arquivo);

  images.forEach((image, index) => {
    addImageObjectCandidates(candidates, `imagens[${index}]`, image);
  });

  return candidates;
}

export function resolvePlacaImageKey(placa: ImageLike | null | undefined): ResolvePlacaImageKeyResult {
  if (!placa || typeof placa !== 'object') {
    return { key: null, sourceField: null, rawValue: null };
  }

  for (const candidate of getPlacaImageCandidates(placa)) {
    const raw = cleanString(candidate.value);
    if (!raw) continue;
    const key = keyFromStoredValue(raw);
    if (key) {
      return { key, sourceField: candidate.field, rawValue: raw };
    }
  }

  return { key: null, sourceField: null, rawValue: null };
}

export function resolvePlacaImageReference(placa: ImageLike | null | undefined): PlacaImageReference {
  const resolved = resolvePlacaImageKey(placa);
  return {
    hasImage: !!resolved.key,
    storageKey: resolved.key,
    sourceField: resolved.sourceField,
  };
}

export function hasResolvablePlacaImage(placa: ImageLike | null | undefined): boolean {
  return resolvePlacaImageReference(placa).hasImage;
}
