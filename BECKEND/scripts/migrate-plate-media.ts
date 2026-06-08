#!/usr/bin/env ts-node
/**
 * Migração: PlateMedia — fonte canônica de imagem para cada placa
 *
 * PROBLEMA:
 *   Placas existentes têm imagem referenciada por vários campos legados
 *   (imagemPrincipal, imagem, imagens[], storageKey etc.).
 *   O PlateMedia domain ainda não existe para essas placas, então o proxy
 *   público cai no fallback legado e fica sujeito a inconsistências.
 *
 * O QUE FAZ:
 *   Para cada placa:
 *     1. Tenta resolver imagem via resolvePlacaImageReference (legado).
 *     2. Se encontrar key válida → cria PlateMedia com activeKey.
 *     3. Se não encontrar → registra como noImage.
 *     4. Se PlateMedia já existir → pula (skip).
 *
 * O QUE NÃO FAZ:
 *   - Não altera campos da Placa.
 *   - Não verifica existência real no R2 (use --verify para isso).
 *   - Não apaga dados antigos.
 *
 * USO:
 *   npx ts-node -r tsconfig-paths/register scripts/migrate-plate-media.ts --dry-run
 *   npx ts-node -r tsconfig-paths/register scripts/migrate-plate-media.ts --dry-run --verify
 *   npx ts-node -r tsconfig-paths/register scripts/migrate-plate-media.ts --fix
 *   npx ts-node -r tsconfig-paths/register scripts/migrate-plate-media.ts --fix --verify
 *
 * MODO:
 *   --dry-run  Lê o banco, calcula o relatório, não persiste nada. (padrão quando --fix ausente)
 *   --fix      Persiste os documentos PlateMedia no MongoDB.
 *   --verify   Verifica existência real de cada key no R2 (HeadObject). Requer credenciais R2.
 *   --fix --dry-run juntos → erro imediato.
 *
 * RELATÓRIO (stdout JSON no final):
 *   { migrated, skipped, noImage, brokenLegacy, errors, total, durationMs }
 *
 * @version 1.1.0
 */

import mongoose, { Types } from 'mongoose';
import * as path from 'path';
import { config } from 'dotenv';

config({ path: path.resolve(__dirname, '../.env') });

// ─── Configuração ─────────────────────────────────────────────────────────────

const BATCH_SIZE = 50;
const MONGO_URI =
  process.argv.find(a => a.startsWith('--uri='))?.split('=')[1] ||
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  'mongodb://localhost:27017/inmidia';

const HAS_FIX      = process.argv.includes('--fix');
const HAS_DRY_RUN  = process.argv.includes('--dry-run');
const VERIFY_R2    = process.argv.includes('--verify');

// Conflito explícito: --fix e --dry-run não podem coexistir
if (HAS_FIX && HAS_DRY_RUN) {
  console.error('[migrate-plate-media] ERRO: --fix e --dry-run não podem ser usados juntos.');
  console.error('  Use --dry-run para simular, ou --fix para aplicar. Nunca os dois.');
  process.exit(1);
}

// Dry-run quando: --dry-run explícito OU ausência de --fix
const IS_DRY_RUN = HAS_DRY_RUN || !HAS_FIX;

console.log(`[migrate-plate-media] MODE: ${IS_DRY_RUN ? 'DRY_RUN' : 'FIX'}`);
if (IS_DRY_RUN) {
  console.log('[migrate-plate-media] Nenhum dado será alterado. Use --fix para aplicar.');
} else {
  console.log('[migrate-plate-media] ATENÇÃO: alterações serão persistidas no MongoDB.');
}
if (VERIFY_R2) {
  console.log('[migrate-plate-media] Verificação R2 ATIVA (--verify). Requer credenciais R2 no .env.');
}

// ─── Registro de modelos ───────────────────────────────────────────────────────

import { placaSchema }     from '../src/database/schemas/placa.schema';
import { plateMediaSchema } from '../src/database/schemas/plateMedia.schema';

const Placa     = mongoose.models.Placa     || mongoose.model('Placa',     placaSchema);
const PlateMedia = mongoose.models.PlateMedia || mongoose.model('PlateMedia', plateMediaSchema);

// ─── Legacy image resolver (inline — sem importar todo o módulo) ───────────────

function extractFirstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const v of values) {
    if (v && typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function resolveKey(doc: any): string | null {
  // Prioridade: imagemPrincipal → imagem → imagens[].isMain → imagens[0]
  const direct = extractFirstNonEmpty(doc.imagemPrincipal, doc.imagem, doc.storageKey, doc.imagemKey, doc.r2Key);
  if (direct) return direct;

  const images: any[] = Array.isArray(doc.imagens) ? doc.imagens : [];
  const main = images.find((img: any) => img?.isMain) ?? images[0] ?? null;
  if (main) {
    return extractFirstNonEmpty(
      main.storageKey, main.imagemKey, main.r2Key, main.key, main.url,
    );
  }
  return null;
}

// ─── Verificação R2 (opcional) ────────────────────────────────────────────────

async function keyExistsInR2(r2Key: string): Promise<boolean> {
  if (!VERIFY_R2) return true; // assume válido quando não verificando

  try {
    const { S3Client, HeadObjectCommand } = await import('@aws-sdk/client-s3');
    const client = new S3Client({
      region:   'auto',
      endpoint: process.env.R2_ENDPOINT || '',
      credentials: {
        accessKeyId:     process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
      },
    });
    const bucket = process.env.R2_BUCKET_NAME || '';
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: r2Key }));
    return true;
  } catch {
    return false;
  }
}

// ─── Relatório ────────────────────────────────────────────────────────────────

interface Report {
  total:        number;
  migrated:     number;
  skipped:      number;
  noImage:      number;
  brokenLegacy: number;
  errors:       Array<{ plateId: string; reason: string }>;
  durationMs:   number;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  const t0 = Date.now();

  console.log(`[migrate-plate-media] Conectando a ${MONGO_URI.replace(/:[^@]+@/, ':***@')} ...`);
  await mongoose.connect(MONGO_URI);
  console.log('[migrate-plate-media] Conectado.');

  const report: Report = {
    total: 0, migrated: 0, skipped: 0, noImage: 0, brokenLegacy: 0,
    errors: [], durationMs: 0,
  };

  const cursor = Placa
    .find({ statusOperacional: { $ne: 'ARCHIVED' } })
    .select('_id empresaId numero_placa imagemPrincipal imagem imagens storageKey imagemKey r2Key')
    .lean()
    .cursor({ batchSize: BATCH_SIZE });

  let processed = 0;

  for await (const doc of cursor) {
    report.total += 1;
    const plateId  = String((doc as any)._id);
    const empresaId = String((doc as any).empresaId ?? '');

    try {
      // Verificar se PlateMedia já existe
      const existing = await PlateMedia.findOne({ plateId: new Types.ObjectId(plateId) }).lean();
      if (existing) {
        report.skipped += 1;
        continue;
      }

      // Resolver key legacy
      const key = resolveKey(doc);
      if (!key) {
        report.noImage += 1;
        continue;
      }

      // Verificar existência no R2 (opcional)
      const existsInR2 = await keyExistsInR2(key);
      if (!existsInR2) {
        report.brokenLegacy += 1;
        console.warn(`[BROKEN] plateId=${plateId} codigo=${(doc as any).numero_placa} key=${key.slice(-30)}`);
        continue;
      }

      if (!IS_DRY_RUN) {
        if (!Types.ObjectId.isValid(plateId) || !Types.ObjectId.isValid(empresaId)) {
          report.errors.push({ plateId, reason: 'invalid_objectid' });
          continue;
        }

        await PlateMedia.findOneAndUpdate(
          { plateId: new Types.ObjectId(plateId) },
          {
            $setOnInsert: {
              plateId:   new Types.ObjectId(plateId),
              empresaId: new Types.ObjectId(empresaId),
              activeKey: key,
              status:    'active',
              version:   String(Date.now()),
              mimeType:  null,
              size:      null,
              width:     null,
              height:    null,
              history: [{
                key,
                mimeType:   null,
                size:       null,
                uploadedAt: new Date(),
                isActive:   true,
                source:     'migration',
              }],
            },
          },
          { upsert: true, new: true },
        );
      }

      report.migrated += 1;

      if (processed % 100 === 0) {
        console.log(`[migrate-plate-media] Processadas ${processed} placas ...`);
      }
    } catch (err) {
      report.errors.push({
        plateId,
        reason: err instanceof Error ? err.message : String(err),
      });
    }

    processed += 1;
  }

  await mongoose.disconnect();

  report.durationMs = Date.now() - t0;

  console.log('\n[migrate-plate-media] RELATÓRIO FINAL:');
  console.log(JSON.stringify(report, null, 2));

  if (IS_DRY_RUN) {
    console.log('\n→ DRY-RUN: nenhum dado foi alterado. Execute com --fix para aplicar.');
  } else {
    console.log(`\n→ ${report.migrated} documentos PlateMedia criados.`);
    if (report.errors.length > 0) {
      console.error(`→ ${report.errors.length} erros. Veja o relatório acima.`);
      process.exit(1);
    }
  }
}

run().catch(err => {
  console.error('[migrate-plate-media] ERRO FATAL:', err);
  process.exit(1);
});
