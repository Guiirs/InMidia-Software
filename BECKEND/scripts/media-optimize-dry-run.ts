#!/usr/bin/env ts-node
/**
 * media-optimize-dry-run — Relatório de conversão WebP (sem escrever no R2)
 *
 * Lista todas as placas com imagem ativa, calcula a key WebP planejada,
 * identifica quais já foram otimizadas, e gera um relatório JSON local.
 * NENHUM objeto é criado, alterado ou apagado no R2 ou no MongoDB.
 *
 * USO:
 *   npm run media:optimize:dry-run
 *   npx ts-node -r tsconfig-paths/register scripts/media-optimize-dry-run.ts
 *
 * SAÍDA:
 *   ./media-webp-manifests/dry-run-report-<timestamp>.json
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

const BATCH_SIZE = 100;
const MANIFESTS_DIR = path.resolve(__dirname, '../media-webp-manifests');

// ─── Registro de modelos ────────────────────────────────────────────────────────

import { plateMediaSchema } from '../src/database/schemas/plateMedia.schema';

const PlateMedia = mongoose.models['PlateMedia'] || mongoose.model('PlateMedia', plateMediaSchema);

// ─── Helper ─────────────────────────────────────────────────────────────────────

function deriveOptimizedKey(originalKey: string): string {
  const lastDot = originalKey.lastIndexOf('.');
  const base = lastDot >= 0 ? originalKey.slice(0, lastDot) : originalKey;
  return `${base}.webp`;
}

function isAlreadyWebP(key: string): boolean {
  return key.toLowerCase().endsWith('.webp');
}

// ─── Main ───────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('[dry-run] Conectando ao MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('[dry-run] Conectado.');

  const total = await PlateMedia.countDocuments({ status: 'active', activeKey: { $ne: null } });
  console.log(`[dry-run] PlateMedia com imagem ativa: ${total}`);

  const entries: object[] = [];
  let processed = 0;
  let toConvert = 0;
  let alreadyOptimized = 0;
  let skippedNoImage = 0;

  let skip = 0;
  while (skip < total) {
    const batch = await PlateMedia.find(
      { status: 'active', activeKey: { $ne: null } },
    ).skip(skip).limit(BATCH_SIZE).lean();

    for (const pm of batch) {
      const activeKey = (pm as any).activeKey as string | null;
      if (!activeKey) { skippedNoImage++; continue; }

      const plannedOptimizedKey = deriveOptimizedKey(activeKey);
      const alreadyOpt = Boolean((pm as any).optimizedKey);
      const webpEnabled = Boolean((pm as any).webpEnabled);

      entries.push({
        plateId:             String((pm as any).plateId),
        originalKey:         activeKey,
        plannedOptimizedKey,
        originalMimeType:    (pm as any).mimeType ?? null,
        originalSizeBytes:   (pm as any).size ?? null,
        alreadyOptimized:    alreadyOpt,
        webpEnabled,
        skippedAlreadyWebP:  isAlreadyWebP(activeKey),
      });

      if (isAlreadyWebP(activeKey) || alreadyOpt) {
        alreadyOptimized++;
      } else {
        toConvert++;
      }
    }

    processed += batch.length;
    skip += BATCH_SIZE;
    process.stdout.write(`\r[dry-run] Processando: ${processed}/${total}`);
  }

  console.log('');

  const report = {
    generatedAt:       new Date().toISOString(),
    total:             processed,
    toConvert,
    alreadyOptimized,
    skippedNoImage,
    entries,
  };

  if (!fs.existsSync(MANIFESTS_DIR)) {
    fs.mkdirSync(MANIFESTS_DIR, { recursive: true });
  }

  const reportPath = path.join(MANIFESTS_DIR, `dry-run-report-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');

  console.log('\n[dry-run] ══════════════════════════════════════════');
  console.log(`[dry-run] Total analisado  : ${processed}`);
  console.log(`[dry-run] Para converter   : ${toConvert}`);
  console.log(`[dry-run] Já otimizados    : ${alreadyOptimized}`);
  console.log(`[dry-run] Sem imagem        : ${skippedNoImage}`);
  console.log(`[dry-run] Relatório salvo  : ${reportPath}`);
  console.log('[dry-run] R2 NÃO foi alterado. Execute npm run media:optimize:webp para converter.');

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('[dry-run] ERRO:', err);
  process.exit(1);
});
