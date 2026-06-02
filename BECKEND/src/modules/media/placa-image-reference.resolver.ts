import { extractR2Key } from '@shared/infra/storage/r2-key.helper';

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
};

type ImageLike = Record<string, any>;

export interface ImageReference {
  hasImage: boolean;
  storageKey: string | null;
  sourceField: string | null;
  contentType?: string | null;
}

export interface ResolvePlacaImageKeyResult {
  key: string | null;
  sourceField: string | null;
  rawValue: string | null;
  contentType: string | null;
}

export interface GalleryImageReference extends ImageReference {
  id: string | null;
  isMain: boolean;
}

function cleanString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function contentTypeFromStorageKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const path = value.split(/[?#]/, 1)[0] ?? '';
  const dotIdx = path.lastIndexOf('.');
  if (dotIdx === -1) return null;
  return MIME_BY_EXT[path.slice(dotIdx).toLowerCase()] ?? null;
}

export function normalizePlacaStorageKey(value: unknown): string | null {
  const raw = cleanString(value);
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw) && !raw.includes('/')) return null;
  return extractR2Key(raw);
}

function addCandidate(
  candidates: Array<{ field: string; value: unknown; contentType?: unknown }>,
  field: string,
  value: unknown,
  contentType?: unknown,
): void {
  if (cleanString(value)) candidates.push({ field, value, contentType });
}

function addImageObjectCandidates(
  candidates: Array<{ field: string; value: unknown; contentType?: unknown }>,
  prefix: string,
  image: unknown,
): void {
  if (!image || typeof image !== 'object') return;
  const item = image as ImageLike;
  const contentType = item.contentType ?? item.mimeType ?? item.mimetype;

  addCandidate(candidates, `${prefix}.storageKey`, item.storageKey, contentType);
  addCandidate(candidates, `${prefix}.imagemKey`, item.imagemKey, contentType);
  addCandidate(candidates, `${prefix}.r2Key`, item.r2Key, contentType);
  addCandidate(candidates, `${prefix}.key`, item.key, contentType);
  addCandidate(candidates, `${prefix}.path`, item.path, contentType);
  addCandidate(candidates, `${prefix}.publicUrl`, item.publicUrl, contentType);
  addCandidate(candidates, `${prefix}.url`, item.url, contentType);
  addCandidate(candidates, `${prefix}.imageUrl`, item.imageUrl, contentType);
  addCandidate(candidates, `${prefix}.src`, item.src, contentType);
}

function galleryFromPlaca(placa: ImageLike | null | undefined): unknown[] {
  if (Array.isArray(placa?.images)) return placa!.images;
  if (Array.isArray(placa?.imagens)) return placa!.imagens;
  return [];
}

function mainImageFromGallery(images: unknown[]): ImageLike | null {
  return (
    images.find((image: any) => image?.isMain) ??
    images.find((image: any) => image?.category === 'MAIN') ??
    images[0] ??
    null
  );
}

export function getPlacaImageCandidates(placa: ImageLike | null | undefined): Array<{ field: string; value: unknown; contentType?: unknown }> {
  const candidates: Array<{ field: string; value: unknown; contentType?: unknown }> = [];
  if (!placa || typeof placa !== 'object') return candidates;

  const images = galleryFromPlaca(placa);
  const mainImage = placa.mainImage ?? mainImageFromGallery(images);

  addCandidate(candidates, 'mainImageUrl', placa.mainImageUrl);
  addImageObjectCandidates(candidates, 'mainImage', mainImage);
  addCandidate(candidates, 'imagemPrincipal', placa.imagemPrincipal);
  addCandidate(candidates, 'imagem', placa.imagem);
  addImageObjectCandidates(candidates, 'imagem', placa.imagem);
  addCandidate(candidates, 'foto', placa.foto);
  addImageObjectCandidates(candidates, 'foto', placa.foto);
  addCandidate(candidates, 'imageUrl', placa.imageUrl);
  addCandidate(candidates, 'fotoUrl', placa.fotoUrl);
  addCandidate(candidates, 'urlImagem', placa.urlImagem);
  addCandidate(candidates, 'storageKey', placa.storageKey);
  addCandidate(candidates, 'imagemKey', placa.imagemKey);
  addCandidate(candidates, 'r2Key', placa.r2Key);
  addImageObjectCandidates(candidates, 'arquivo', placa.arquivo);

  images.forEach((image, index) => {
    addImageObjectCandidates(candidates, `imagens[${index}]`, image);
  });

  return candidates;
}

export function resolvePlacaImageKey(placa: ImageLike | null | undefined): ResolvePlacaImageKeyResult {
  for (const candidate of getPlacaImageCandidates(placa)) {
    const raw = cleanString(candidate.value);
    if (!raw) continue;

    const key = normalizePlacaStorageKey(raw);
    if (!key) continue;

    const explicitContentType = cleanString(candidate.contentType);
    return {
      key,
      sourceField: candidate.field,
      rawValue: raw,
      contentType: explicitContentType ?? contentTypeFromStorageKey(key),
    };
  }

  return { key: null, sourceField: null, rawValue: null, contentType: null };
}

export function resolvePlacaImageReference(placa: ImageLike | null | undefined): ImageReference {
  const resolved = resolvePlacaImageKey(placa);
  return {
    hasImage: !!resolved.key,
    storageKey: resolved.key,
    sourceField: resolved.sourceField,
    contentType: resolved.contentType,
  };
}

export function resolvePlacaGalleryReferences(placa: ImageLike | null | undefined): GalleryImageReference[] {
  const images = galleryFromPlaca(placa);
  return images.map((image: any) => {
    const resolved = resolvePlacaImageReference({ mainImage: image });
    const id = image?._id?.toString?.() ?? image?.id?.toString?.() ?? null;
    return {
      ...resolved,
      id,
      isMain: Boolean(image?.isMain || image?.category === 'MAIN'),
    };
  });
}

export function resolvePlacaGallery(placa: ImageLike | null | undefined): unknown[] {
  return galleryFromPlaca(placa);
}

export function hasResolvablePlacaImage(placa: ImageLike | null | undefined): boolean {
  return resolvePlacaImageReference(placa).hasImage;
}
