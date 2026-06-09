#!/usr/bin/env ts-node
/**
 * media-optimize-repair-metadata
 *
 * Corrige documentos PlateMedia que já têm o WebP no R2 mas não têm os campos
 * de metadados (optimizedKey, webpEnabled, optimizedAt, optimizedSize) no MongoDB.
 *
 * CASO DE USO:
 *   O script media-optimize-webp.ts fez upload do WebP para o R2, mas a persistência
 *   MongoDB falhou ou ficou incompleta (ex: webpEnabled não foi setado).
 *   Este script lê os manifestos locais, valida o R2 e aplica o $set correto.
 *
 * O QUE FAZ:
 *   1. Lê todos os manifestos em media-webp-manifests/ com status=CONVERTED
 *   2. Para cada manifesto: HeadObject no R2 para confirmar que optimizedKey existe
 *   3. Busca o documento platemedias pelo plateId
 *   4. Aplica $set: { optimizedKey, optimizedAt, optimizedSize, webpEnabled:false,
 *                     width, height, version } via driver nativo
 *   5. Não baixa nem reconverte imagens
 *   6. Não ativa webpEnabled (isso é feito pelo activate script)
 *   7. Gera relatório de reparo
 *
 * USO:
 *   npm run media:optimize:repair-metadata
 *   npm run media:optimize:repair-metadata -- --dry-run    (só reporta, não altera)
 *   npm run media:optimize:repair-metadata -- --plate=<id>  (repara uma placa)
 *
 * APÓS EXECUTAR:
 *   npm run media:optimize:activate
 */

import mongoose from 'mongoose';
import * as path from 'path';
import * as fs from 'fs';
import { config } from 'dotenv';

config({ path: path.resolve(__dirname, '../.env') });

import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';

const MONGO_URI =
  process.argv.find(a => a.startsWith('--uri='))?.split('=')[1] ||
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  'mongodb://localhost:27017/inmidia';

const IS_DRY_RUN   = process.argv.includes('--dry-run');
const PLATE_ID_ARG = process.argv.find(a => a.startsWith('--plate='))?.split('=')[1] ?? null;
const MANIFESTS_DIR = path.resolve(__dirname, '../media-webp-manifests');

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

async function r2KeyExists(client: S3Client, bucket: string, key: string): Promise<boolean> {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

// ─── Manifesto ──────────────────────────────────────────────────────────────────

interface ConvertedManifest {
  plateId:           string;
  originalKey:       string;
  optimizedKey:      string;
  originalMimeType:  string;
  originalSizeBytes: number;
  optimizedSizeBytes: number;
  width:             number;
  height:            number;
  convertedAt:       string;
  status:            string;
}

function loadConvertedManifests(): ConvertedManifest[] {
  if (!fs.existsSync(MANIFESTS_DIR)) return [];

  const files = fs.readdirSync(MANIFESTS_DIR)
    .filter(f => f.endsWith('.json') && !f.startsWith('dry-run') && !f.startsWith('convert-summary'));

  const manifests: ConvertedManifest[] = [];
  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(MANIFESTS_DIR, file), 'utf-8'));
      if (data.status === 'CONVERTED' && data.plateId && data.optimizedKey) {
        if (!PLATE_ID_ARG || data.plateId === PLATE_ID_ARG) {
          manifests.push(data as ConvertedManifest);
        }
      }
    } catch {
      // manifesto corrompido — ignora
    }
  }
  return manifests;
}

// ─── Main ───────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (IS_DRY_RUN) {
    console.log('[repair-metadata] MODO DRY-RUN — nenhuma alteração será feita.');
  }
  console.log('[repair-metadata] Lendo manifestos em:', MANIFESTS_DIR);

  const manifests = loadConvertedManifests();
  console.log(`[repair-metadata] Manifestos CONVERTED encontrados: ${manifests.length}`);
  if (manifests.length === 0) {
    console.log('[repair-metadata] Nenhum manifesto para reparar.');
    return;
  }

  await mongoose.connect(MONGO_URI);
  console.log('[repair-metadata] MongoDB conectado.');

  const r2     = buildR2Client();
  const bucket = getBucket();

  const col = (mongoose.connection.db as NonNullable<typeof mongoose.connection.db>).collection('platemedias');

  const report = {
    total:             manifests.length,
    repaired:          0,
    alreadyOk:         0,
    missingInR2:       0,
    missingInMongo:    0,
    failed:            0,
    dryRun:            IS_DRY_RUN,
    generatedAt:       new Date().toISOString(),
    details:           [] as object[],
  };

  for (const manifest of manifests) {
    const { plateId, optimizedKey } = manifest;

    try {
      // 1. Valida que o WebP existe no R2
      const exists = await r2KeyExists(r2, bucket, optimizedKey);
      if (!exists) {
        console.warn(`  [skip] ${plateId} — WebP não encontrado no R2: ${optimizedKey}`);
        report.missingInR2++;
        report.details.push({ plateId, status: 'MISSING_IN_R2', optimizedKey });
        continue;
      }

      // 2. Busca o documento MongoDB pelo plateId
      const { Types } = await import('mongoose');
      if (!Types.ObjectId.isValid(plateId)) {
        console.warn(`  [skip] ${plateId} — plateId inválido`);
        continue;
      }

      const doc = await col.findOne({ plateId: new Types.ObjectId(plateId) });
      if (!doc) {
        console.warn(`  [skip] ${plateId} — documento não encontrado no MongoDB`);
        report.missingInMongo++;
        report.details.push({ plateId, status: 'MISSING_IN_MONGO' });
        continue;
      }

      // 3. Verifica se já está completo
      const needsRepair = !doc.optimizedKey || doc.webpEnabled === undefined || doc.webpEnabled === null;
      if (!needsRepair && doc.optimizedKey === optimizedKey) {
        console.log(`  [skip] ${plateId} — metadados já completos`);
        report.alreadyOk++;
        report.details.push({ plateId, status: 'ALREADY_OK', optimizedKey });
        continue;
      }

      if (IS_DRY_RUN) {
        console.log(`  [dry-run] ${plateId} — seria reparado: optimizedKey=${optimizedKey}`);
        report.repaired++; // conta o que seria reparado
        report.details.push({ plateId, status: 'WOULD_REPAIR', optimizedKey });
        continue;
      }

      // 4. Aplica $set via driver nativo — bypassa Mongoose strict mode
      const now    = new Date();
      const result = await col.updateOne(
        { _id: doc._id },
        {
          $set: {
            optimizedKey,
            optimizedAt:   manifest.convertedAt ? new Date(manifest.convertedAt) : now,
            optimizedSize: manifest.optimizedSizeBytes ?? null,
            webpEnabled:   false,      // EXPLÍCITO — necessário para o activate encontrar
            width:         manifest.width   ?? doc.width ?? null,
            height:        manifest.height  ?? doc.height ?? null,
            version:       String(Date.now()),
            updatedAt:     now,
          },
        },
      );

      if (result.matchedCount === 0) {
        throw new Error(`Documento não encontrado pelo _id: ${doc._id}`);
      }

      report.repaired++;
      console.log(`  [ok] ${plateId} — reparado (modified=${result.modifiedCount})`);
      report.details.push({ plateId, status: 'REPAIRED', optimizedKey, modifiedCount: result.modifiedCount });
    } catch (err) {
      report.failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  [ERRO] ${plateId}: ${msg}`);
      report.details.push({ plateId, status: 'FAILED', error: msg });
    }
  }

  // Salva relatório
  const reportPath = path.join(MANIFESTS_DIR, `repair-report-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');

  console.log('\n[repair-metadata] ══════════════════════════════════════════');
  console.log(`[repair-metadata] Total manifestos    : ${report.total}`);
  console.log(`[repair-metadata] Reparados           : ${report.repaired}`);
  console.log(`[repair-metadata] Já completos        : ${report.alreadyOk}`);
  console.log(`[repair-metadata] Sem WebP no R2      : ${report.missingInR2}`);
  console.log(`[repair-metadata] Sem doc no Mongo    : ${report.missingInMongo}`);
  console.log(`[repair-metadata] Com erro            : ${report.failed}`);
  console.log(`[repair-metadata] Relatório           : ${reportPath}`);

  if (!IS_DRY_RUN && report.repaired > 0) {
    console.log('\n[repair-metadata] Próximo passo: npm run media:optimize:activate');
  }

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('[repair-metadata] ERRO FATAL:', err);
  process.exit(1);
});
