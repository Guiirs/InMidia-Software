/**
 * WebP Optimizer Service
 *
 * Funções de conversão WebP seguras:
 * - Nunca sobrescreve o original no R2
 * - Usa sharp.rotate() para corrigir orientação EXIF antes de converter
 * - Qualidade 82, effort 5 (equilíbrio compressão/velocidade)
 * - Sem resize() — mantém dimensões originais
 */

import sharp from 'sharp';
import crypto from 'crypto';
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getR2Client, getR2BucketName } from '@shared/infra/storage/r2-client';

export interface WebPConversionResult {
  buffer: Buffer;
  width: number;
  height: number;
  sizeBytes: number;
  checksum: string;
}

/**
 * Converte buffer de imagem para WebP mantendo dimensões originais.
 * Aplica rotate() para corrigir EXIF antes da conversão — sem resize().
 */
export async function convertBufferToWebP(input: Buffer): Promise<WebPConversionResult> {
  const { data, info } = await sharp(input)
    .rotate()
    .webp({ quality: 82, effort: 5 })
    .toBuffer({ resolveWithObject: true });

  const checksum = crypto.createHash('sha256').update(data).digest('hex');

  return {
    buffer: data,
    width: info.width,
    height: info.height,
    sizeBytes: data.length,
    checksum,
  };
}

/**
 * Baixa um objeto R2 e retorna como Buffer.
 * Nunca modifica o objeto — read-only.
 */
export async function downloadR2ObjectAsBuffer(r2Key: string): Promise<Buffer> {
  const client = getR2Client();
  if (!client) throw new Error('R2 client indisponível');

  const response = await client.send(
    new GetObjectCommand({ Bucket: getR2BucketName(), Key: r2Key }),
  );

  if (!response.Body) throw new Error(`Objeto R2 não encontrado: ${r2Key}`);

  const chunks: Buffer[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * Deriva a R2 key do WebP a partir da key original.
 * Troca apenas a extensão para .webp — nunca sobrescreve o original.
 *
 * Exemplo:
 *   empresas/X/plates/Y/main/MEDIA_ID.jpg  →  empresas/X/plates/Y/main/MEDIA_ID.webp
 */
export function deriveOptimizedKey(originalKey: string): string {
  const lastDot = originalKey.lastIndexOf('.');
  const base = lastDot >= 0 ? originalKey.slice(0, lastDot) : originalKey;
  return `${base}.webp`;
}

/**
 * Faz upload de buffer WebP para o R2 como novo objeto.
 * O objeto original permanece intacto.
 */
export async function uploadWebPToR2(buffer: Buffer, targetKey: string): Promise<void> {
  const client = getR2Client();
  if (!client) throw new Error('R2 client indisponível');

  await client.send(
    new PutObjectCommand({
      Bucket: getR2BucketName(),
      Key: targetKey,
      Body: buffer,
      ContentType: 'image/webp',
    }),
  );
}

/**
 * Verifica se um objeto R2 existe sem baixar o conteúdo (HeadObject).
 */
export async function r2ObjectExists(r2Key: string): Promise<boolean> {
  const client = getR2Client();
  if (!client) return false;

  try {
    await client.send(new HeadObjectCommand({ Bucket: getR2BucketName(), Key: r2Key }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Calcula checksum SHA-256 de um Buffer.
 */
export function sha256(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}
