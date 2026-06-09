#!/usr/bin/env ts-node
/**
 * media-optimize-webp — Conversão segura de imagens de placas para WebP
 *
 * Para cada placa com imagem ativa (não WebP, não já otimizada):
 *   1. Baixa o original do R2 (read-only no original)
 *   2. Converte para WebP com sharp (rotate + quality=82, sem resize)
 *   3. Calcula checksum SHA-256 do original e do WebP
 *   4. Faz upload do WebP em nova key (original intacto)
 *   5. Persiste optimizedKey, webpEnabled=false, optimizedAt, optimizedSize no MongoDB
 *   6. Salva manifesto JSON local
 *
 * ATENÇÃO: NÃO sobrescreve o original. NÃO ativa WebP (use media:optimize:activate).
 *
 * USO:
 *   npm run media:optimize:webp                          # converte todas
 *   npm run media:optimize:webp -- --plate=<plateId>     # converte uma placa
 *   npm run media:optimize:webp -- --limit=50            # limita a N placas
 *
 * SAÍDA:
 *   ./media-webp-manifests/<plateId>.json por placa
 *   ./media-webp-manifests/convert-summary-<ts>.json
 */

import mongoose from 'mongoose';
import * as path from 'path';
import * as fs from 'fs';
import crypto from 'crypto';
import { config } from 'dotenv';

config({ path: path.resolve(__dirname, '../.env') });

import sharp from 'sharp';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

const MONGO_URI =
  process.argv.find(a => a.startsWith('--uri='))?.split('=')[1] ||
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  'mongodb://localhost:27017/inmidia';

const PLATE_ID_ARG = process.argv.find(a => a.startsWith('--plate='))?.split('=')[1] ?? null;
// --limit=N: processa no máximo N placas. 0 = sem limite.
const LIMIT_ARG   = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] ?? '0', 10) || 0;
const BATCH_SIZE  = 10;
const MANIFESTS_DIR = path.resolve(__dirname, '../media-webp-manifests');

// ─── Registro de modelos ────────────────────────────────────────────────────────

import { plateMediaSchema } from '../src/database/schemas/plateMedia.schema';

const PlateMedia = mongoose.models['PlateMedia'] || mongoose.model('PlateMedia', plateMediaSchema);

// ─── R2 client ──────────────────────────────────────────────────────────────────

function buildR2Client(): S3Client {
  const endpoint        = process.env.R2_ENDPOINT;
  const accessKeyId     = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error('Variáveis R2 não configuradas (R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)');
  }
  return new S3Client({
    endpoint: endpoint.replace(/\/+$/, ''),
    region: 'auto',
    credentials: { accessKeyId, secretAccessKey },
  });
}

function getBucket(): string {
  const b = process.env.R2_BUCKET_NAME;
  if (!b) throw new Error('R2_BUCKET_NAME não configurado');
  return b;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function deriveOptimizedKey(originalKey: string): string {
  const lastDot = originalKey.lastIndexOf('.');
  const base = lastDot >= 0 ? originalKey.slice(0, lastDot) : originalKey;
  return `${base}.webp`;
}

async function downloadAsBuffer(client: S3Client, bucket: string, key: string): Promise<Buffer> {
  const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!res.Body) throw new Error(`Objeto R2 não encontrado: ${key}`);
  const chunks: Buffer[] = [];
  for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function convertToWebP(buf: Buffer): Promise<{ buffer: Buffer; width: number; height: number }> {
  const { data, info } = await sharp(buf)
    .rotate()
    .webp({ quality: 82, effort: 5 })
    .toBuffer({ resolveWithObject: true });
  return { buffer: data, width: info.width, height: info.height };
}

function sha256(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function saveManifest(plateId: string, manifest: object): string {
  if (!fs.existsSync(MANIFESTS_DIR)) fs.mkdirSync(MANIFESTS_DIR, { recursive: true });
  const p = path.join(MANIFESTS_DIR, `${plateId}.json`);
  fs.writeFileSync(p, JSON.stringify(manifest, null, 2), 'utf-8');
  return p;
}

// ─── Main ───────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('[media-optimize-webp] Iniciando conversão segura.');
  console.log('[media-optimize-webp] Original NÃO será sobrescrito. WebP será salvo em nova key.');
  if (LIMIT_ARG > 0) console.log(`[media-optimize-webp] Limite: ${LIMIT_ARG} placas.`);

  await mongoose.connect(MONGO_URI);
  console.log('[media-optimize-webp] MongoDB conectado.');

  // Usa driver nativo para garantir que os campos WebP sejam persistidos
  // independente de qual versão de schema o Mongoose carregou.
  const col = (mongoose.connection.db as NonNullable<typeof mongoose.connection.db>).collection('platemedias');

  const r2     = buildR2Client();
  const bucket = getBucket();

  const query: Record<string, unknown> = {
    status:       'active',
    activeKey:    { $ne: null },
    optimizedKey: null,
  };
  if (PLATE_ID_ARG) {
    const { Types } = await import('mongoose');
    if (!Types.ObjectId.isValid(PLATE_ID_ARG)) {
      console.error(`[media-optimize-webp] plateId inválido: ${PLATE_ID_ARG}`);
      process.exit(1);
    }
    query.plateId = new Types.ObjectId(PLATE_ID_ARG);
  }

  const totalAvailable = await PlateMedia.countDocuments(query);
  const toProcess      = LIMIT_ARG > 0 ? Math.min(totalAvailable, LIMIT_ARG) : totalAvailable;
  console.log(`[media-optimize-webp] Disponíveis: ${totalAvailable} | Serão processadas: ${toProcess}`);

  const summary = { converted: 0, failed: 0, skipped: 0, errors: [] as string[] };
  let processed = 0;

  // Sem skip — após cada update, o documento sai da query (optimizedKey != null).
  // Usamos limit(batchSize) a cada iteração para buscar apenas o necessário.
  while (processed < toProcess) {
    const remaining  = toProcess - processed;
    const batchSize  = Math.min(BATCH_SIZE, remaining);
    const batch      = await PlateMedia.find(query).limit(batchSize).lean();
    if (batch.length === 0) break;

    for (const pm of batch) {
      if (processed >= toProcess) break;

      const plateId   = String((pm as any).plateId);
      const docId     = (pm as any)._id;
      const activeKey = (pm as any).activeKey as string;

      // Pula imagens que já são WebP
      if (activeKey.toLowerCase().endsWith('.webp')) {
        console.log(`  [skip] ${plateId} — original já é WebP`);
        summary.skipped++;
        processed++;
        continue;
      }

      const optimizedKey  = deriveOptimizedKey(activeKey);
      let manifest: Record<string, unknown> = {
        plateId,
        originalKey:       activeKey,
        optimizedKey,
        originalMimeType:  (pm as any).mimeType ?? 'image/jpeg',
        optimizedMimeType: 'image/webp',
        convertedAt:       new Date().toISOString(),
        status:            'FAILED',
      };

      try {
        console.log(`  [download] ${plateId} ← ${activeKey}`);
        const originalBuf      = await downloadAsBuffer(r2, bucket, activeKey);
        const checksumOriginal = sha256(originalBuf);

        console.log(`  [convert]  ${plateId}`);
        const { buffer: webpBuf, width, height } = await convertToWebP(originalBuf);
        const checksumOptimized = sha256(webpBuf);

        console.log(`  [upload]   ${plateId} → ${optimizedKey}`);
        await r2.send(new PutObjectCommand({
          Bucket:      bucket,
          Key:         optimizedKey,
          Body:        webpBuf,
          ContentType: 'image/webp',
        }));

        // Persiste via driver nativo — bypassa strict mode e caching de schema.
        // webpEnabled: false é OBRIGATÓRIO para que o activate os encontre.
        const now    = new Date();
        const result = await col.updateOne(
          { _id: docId },
          {
            $set: {
              optimizedKey,
              optimizedAt:   now,
              optimizedSize: webpBuf.length,
              webpEnabled:   false,
              width,
              height,
              version:       String(Date.now()),
              updatedAt:     now,
            },
          },
        );

        if (result.matchedCount === 0) {
          throw new Error(`Documento não encontrado no MongoDB para _id=${docId}`);
        }
        if (result.modifiedCount === 0) {
          console.warn(`  [warn] ${plateId} — documento encontrado mas não modificado (valores já iguais?)`);
        }

        manifest = {
          ...manifest,
          originalSizeBytes:   originalBuf.length,
          optimizedSizeBytes:  webpBuf.length,
          width,
          height,
          checksumOriginal,
          checksumOptimized,
          status: 'CONVERTED',
        };

        saveManifest(plateId, manifest);
        summary.converted++;
        processed++;
        const saving = Math.round((1 - webpBuf.length / originalBuf.length) * 100);
        console.log(`  [ok] ${plateId} — ${originalBuf.length}B → ${webpBuf.length}B (-${saving}%)`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        summary.errors.push(`${plateId}: ${msg}`);
        summary.failed++;
        processed++;
        saveManifest(plateId, { ...manifest, error: msg });
        console.error(`  [ERRO] ${plateId}: ${msg}`);
      }
    }
  }

  // Relatório resumo
  const summaryPath = path.join(MANIFESTS_DIR, `convert-summary-${Date.now()}.json`);
  if (!fs.existsSync(MANIFESTS_DIR)) fs.mkdirSync(MANIFESTS_DIR, { recursive: true });
  fs.writeFileSync(
    summaryPath,
    JSON.stringify({ ...summary, generatedAt: new Date().toISOString() }, null, 2),
    'utf-8',
  );

  console.log('\n[media-optimize-webp] ══════════════════════════════════════════');
  console.log(`[media-optimize-webp] Convertidos : ${summary.converted}`);
  console.log(`[media-optimize-webp] Com erro    : ${summary.failed}`);
  console.log(`[media-optimize-webp] Pulados     : ${summary.skipped}`);
  console.log(`[media-optimize-webp] Resumo      : ${summaryPath}`);
  console.log('[media-optimize-webp] Originais preservados. WebP NÃO ativo ainda.');
  console.log('[media-optimize-webp] Execute npm run media:optimize:activate para ativar.');

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('[media-optimize-webp] ERRO FATAL:', err);
  process.exit(1);
});
