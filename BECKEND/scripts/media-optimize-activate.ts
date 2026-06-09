#!/usr/bin/env ts-node
/**
 * media-optimize-activate — Ativa entrega WebP para placas convertidas
 *
 * Para cada placa com optimizedKey definido e webpEnabled=false:
 *   1. Valida que optimizedKey existe no R2 (HeadObject)
 *   2. Define webpEnabled=true e atualiza version (cache-bust)
 *   3. Imprime instruções de rollback
 *
 * O endpoint /api/v1/public/media/plates/:id/main passa a servir WebP.
 * O original (activeKey) permanece intacto no R2.
 * O cache Redis expira em 120s — use --invalidate-cache para expirar imediatamente.
 *
 * USO:
 *   npm run media:optimize:activate
 *   npm run media:optimize:activate -- --plate=<plateId>
 *   npm run media:optimize:activate -- --invalidate-cache
 *
 * ROLLBACK:
 *   npm run media:optimize:rollback
 */

import mongoose from 'mongoose';
import * as path from 'path';
import { config } from 'dotenv';

config({ path: path.resolve(__dirname, '../.env') });

import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';

const MONGO_URI =
  process.argv.find(a => a.startsWith('--uri='))?.split('=')[1] ||
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  'mongodb://localhost:27017/inmidia';

const PLATE_ID_ARG      = process.argv.find(a => a.startsWith('--plate='))?.split('=')[1] ?? null;
const INVALIDATE_CACHE  = process.argv.includes('--invalidate-cache');
const BATCH_SIZE        = 100;

import { plateMediaSchema } from '../src/database/schemas/plateMedia.schema';
const PlateMedia = mongoose.models['PlateMedia'] || mongoose.model('PlateMedia', plateMediaSchema);

function buildR2Client(): S3Client {
  const endpoint        = process.env.R2_ENDPOINT;
  const accessKeyId     = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error('Variáveis R2 não configuradas');
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

async function r2Exists(client: S3Client, bucket: string, key: string): Promise<boolean> {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function invalidateCacheForPlate(plateId: string): Promise<void> {
  const redisUrl = process.env.REDIS_URL || process.env.REDIS_URI;
  if (!redisUrl) return;
  try {
    const { createClient } = await import('redis');
    const redis = createClient({ url: redisUrl });
    await redis.connect();
    await redis.del(`img:placa:${plateId}`);
    await redis.del(`img:placa:nf:${plateId}`);
    await redis.quit();
  } catch {
    // não-fatal
  }
}

async function main(): Promise<void> {
  console.log('[activate] Ativando entrega WebP...');
  console.log('[activate] Original permanece intacto. Rollback disponível a qualquer momento.');

  await mongoose.connect(MONGO_URI);
  const r2     = buildR2Client();
  const bucket = getBucket();

  // Inclui documentos sem campo webpEnabled (campo ausente = não ativado).
  // { webpEnabled: false } não combina com campo ausente no MongoDB —
  // por isso usamos $or para ser resiliente a documentos criados antes do schema update.
  const query: Record<string, unknown> = {
    optimizedKey: { $ne: null },
    $or: [{ webpEnabled: false }, { webpEnabled: { $exists: false } }],
  };
  if (PLATE_ID_ARG) {
    const { Types } = await import('mongoose');
    if (!Types.ObjectId.isValid(PLATE_ID_ARG)) {
      console.error(`[activate] plateId inválido: ${PLATE_ID_ARG}`);
      process.exit(1);
    }
    query.plateId = new Types.ObjectId(PLATE_ID_ARG);
  }

  const total = await PlateMedia.countDocuments(query);
  console.log(`[activate] Placas para ativar: ${total}`);

  const result = { activated: 0, skippedMissingR2: 0, failed: 0 };
  let skip = 0;

  while (skip < total) {
    const batch = await PlateMedia.find(query).skip(skip).limit(BATCH_SIZE).lean();
    if (batch.length === 0) break;

    for (const pm of batch) {
      const plateId      = String((pm as any).plateId);
      const optimizedKey = (pm as any).optimizedKey as string;

      try {
        const exists = await r2Exists(r2, bucket, optimizedKey);
        if (!exists) {
          console.warn(`  [skip] ${plateId} — WebP não encontrado no R2: ${optimizedKey}`);
          result.skippedMissingR2++;
          continue;
        }

        await PlateMedia.findOneAndUpdate(
          { plateId: (pm as any).plateId },
          { $set: { webpEnabled: true, version: String(Date.now()) } },
        );

        if (INVALIDATE_CACHE) {
          await invalidateCacheForPlate(plateId);
        }

        result.activated++;
        console.log(`  [ok] ${plateId} — WebP ativo: ${optimizedKey}`);
      } catch (err) {
        result.failed++;
        console.error(`  [ERRO] ${plateId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    skip += BATCH_SIZE;
  }

  console.log('\n[activate] ══════════════════════════════════════════');
  console.log(`[activate] Ativados          : ${result.activated}`);
  console.log(`[activate] Sem WebP no R2    : ${result.skippedMissingR2}`);
  console.log(`[activate] Com erro          : ${result.failed}`);
  if (!INVALIDATE_CACHE) {
    console.log('[activate] INFO: Cache Redis expira em ~120s. Use --invalidate-cache para efeito imediato.');
  }
  console.log('[activate] Para reverter: npm run media:optimize:rollback');

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('[activate] ERRO FATAL:', err);
  process.exit(1);
});
