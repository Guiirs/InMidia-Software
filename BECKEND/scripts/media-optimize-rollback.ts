#!/usr/bin/env ts-node
/**
 * media-optimize-rollback — Reverte entrega WebP, volta a servir original
 *
 * Para cada placa com webpEnabled=true:
 *   1. Define webpEnabled=false e atualiza version (cache-bust)
 *   2. O endpoint volta a servir activeKey (original) automaticamente
 *   3. O WebP (optimizedKey) permanece no R2 — não é apagado
 *
 * Manifesto é atualizado com status=ROLLED_BACK.
 *
 * USO:
 *   npm run media:optimize:rollback
 *   npm run media:optimize:rollback -- --plate=<plateId>
 *   npm run media:optimize:rollback -- --invalidate-cache
 */

import mongoose from 'mongoose';
import * as path from 'path';
import * as fs from 'fs';
import { config } from 'dotenv';

config({ path: path.resolve(__dirname, '../.env') });

const MONGO_URI =
  process.argv.find(a => a.startsWith('--uri='))?.split('=')[1] ||
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  'mongodb://localhost:27017/inmidia';

const PLATE_ID_ARG     = process.argv.find(a => a.startsWith('--plate='))?.split('=')[1] ?? null;
const INVALIDATE_CACHE = process.argv.includes('--invalidate-cache');
const BATCH_SIZE       = 100;
const MANIFESTS_DIR    = path.resolve(__dirname, '../media-webp-manifests');

import { plateMediaSchema } from '../src/database/schemas/plateMedia.schema';
const PlateMedia = mongoose.models['PlateMedia'] || mongoose.model('PlateMedia', plateMediaSchema);

function updateManifestStatus(plateId: string, status: string): void {
  const manifestPath = path.join(MANIFESTS_DIR, `${plateId}.json`);
  if (!fs.existsSync(manifestPath)) return;
  try {
    const data = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    data.status = status;
    data.rolledBackAt = new Date().toISOString();
    fs.writeFileSync(manifestPath, JSON.stringify(data, null, 2), 'utf-8');
  } catch {
    // não-fatal — manifesto é auxiliar
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
  console.log('[rollback] Revertendo para imagens originais...');
  console.log('[rollback] WebP permanece no R2 — apenas webpEnabled=false.');

  await mongoose.connect(MONGO_URI);

  const query: Record<string, unknown> = { webpEnabled: true };
  if (PLATE_ID_ARG) {
    const { Types } = await import('mongoose');
    if (!Types.ObjectId.isValid(PLATE_ID_ARG)) {
      console.error(`[rollback] plateId inválido: ${PLATE_ID_ARG}`);
      process.exit(1);
    }
    query.plateId = new Types.ObjectId(PLATE_ID_ARG);
  }

  const total = await PlateMedia.countDocuments(query);
  console.log(`[rollback] Placas para reverter: ${total}`);

  const result = { rolledBack: 0, failed: 0 };
  let skip = 0;

  while (skip < total) {
    const batch = await PlateMedia.find(query).skip(skip).limit(BATCH_SIZE).lean();
    if (batch.length === 0) break;

    for (const pm of batch) {
      const plateId = String((pm as any).plateId);

      try {
        await PlateMedia.findOneAndUpdate(
          { plateId: (pm as any).plateId },
          { $set: { webpEnabled: false, version: String(Date.now()) } },
        );

        updateManifestStatus(plateId, 'ROLLED_BACK');

        if (INVALIDATE_CACHE) {
          await invalidateCacheForPlate(plateId);
        }

        result.rolledBack++;
        console.log(`  [ok] ${plateId} — revertido para original`);
      } catch (err) {
        result.failed++;
        console.error(`  [ERRO] ${plateId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    skip += BATCH_SIZE;
  }

  console.log('\n[rollback] ══════════════════════════════════════════');
  console.log(`[rollback] Revertidos       : ${result.rolledBack}`);
  console.log(`[rollback] Com erro         : ${result.failed}`);
  if (!INVALIDATE_CACHE) {
    console.log('[rollback] INFO: Cache Redis expira em ~120s. Use --invalidate-cache para efeito imediato.');
  }
  console.log('[rollback] WebP permanece no R2. Para reativar: npm run media:optimize:activate');

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('[rollback] ERRO FATAL:', err);
  process.exit(1);
});
