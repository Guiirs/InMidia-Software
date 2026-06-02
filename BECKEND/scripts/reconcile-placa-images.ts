#!/usr/bin/env ts-node
/**
 * reconcile-placa-images.ts
 *
 * Reconcilia o estado das imagens das placas entre MongoDB e R2.
 *
 * Classificações:
 *   OK               — referência resolvida e arquivo existe no R2
 *   BROKEN_REFERENCE — referência resolvida mas arquivo ausente no R2
 *   NO_IMAGE         — placa sem referência de imagem
 *
 * Uso:
 *   npm run reconcile:placa-images                  # dry-run (padrão, sem alterações)
 *   npm run reconcile:placa-images -- --fix         # limpa referências quebradas no MongoDB
 *   npm run audit:placa-images:r2                   # relatório apenas (alias de dry-run)
 *
 * Flags:
 *   --fix              Limpa campos de imagem quebrados no MongoDB (requer confirmação)
 *   --dry-run          Simula sem alterar nada (padrão)
 *   --report           Alias de --dry-run
 *   --limit=N          Processa no máximo N placas (default: sem limite)
 *   --empresa=<id>     Filtra por empresaId específica
 *   --concurrency=N    Max chamadas R2 paralelas por batch (default: 5)
 *   --batch=N          Tamanho do batch (default: 50)
 *   --no-gallery       Ignora gallery imagens (processamento mais rápido)
 */

import 'dotenv/config';
import * as readline from 'readline';
import mongoose from 'mongoose';
import { HeadObjectCommand } from '@aws-sdk/client-s3';
import Placa from '@modules/placas/Placa';
import { resolvePlacaImageReference } from '@modules/media/placa-image-reference.resolver';
import { getR2BucketName, getR2Client } from '@shared/infra/storage/r2-client';
import { redisManager } from '@shared/infra/redis/redis-manager';
import config from '@config/config';
import { clearImageNotFound } from '@modules/public-plates/image-cache.service';

// ── Constantes ────────────────────────────────────────────────────────────────

const PLACA_IMAGE_SELECT =
  '_id empresaId numero_placa codigo mainImageUrl imagemPrincipal imagem imagens foto imageUrl fotoUrl storageKey imagemKey r2Key statusOperacional updatedAt';

// Top-level scalar fields that can be cleared by --fix.
// Fields inside sub-documents or gallery arrays are NOT cleared here.
const TOP_LEVEL_IMAGE_FIELDS = [
  'mainImageUrl',
  'imagemPrincipal',
  'imagem',
  'foto',
  'imageUrl',
  'fotoUrl',
  'urlImagem',
  'storageKey',
  'imagemKey',
  'r2Key',
] as const;

// imagemPrincipal ↔ imagem are kept in sync by Mongoose pre-validate hook.
// Clearing one without the other would leave a stale mirror.
const FIELD_MIRRORS: Partial<Record<string, string>> = {
  imagemPrincipal: 'imagem',
  imagem: 'imagemPrincipal',
};

// ── Cores / console helpers ───────────────────────────────────────────────────

const c = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  red:    '\x1b[31m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  blue:   '\x1b[34m',
  cyan:   '\x1b[36m',
  white:  '\x1b[37m',
};

const log   = (msg: string) => console.log(msg);
const info  = (msg: string) => log(`${c.cyan}ℹ  ${msg}${c.reset}`);
const ok    = (msg: string) => log(`${c.green}✓  ${msg}${c.reset}`);
const warn  = (msg: string) => log(`${c.yellow}⚠  ${msg}${c.reset}`);
const fail  = (msg: string) => log(`${c.red}✗  ${msg}${c.reset}`);
const head  = (msg: string) => log(`\n${c.bold}${c.blue}── ${msg} ──${c.reset}`);
const dim   = (msg: string) => log(`${c.dim}${msg}${c.reset}`);
const rule  = ()            => log(`${c.dim}${'─'.repeat(80)}${c.reset}`);

// ── Tipos ─────────────────────────────────────────────────────────────────────

type PlateStatus = 'OK' | 'BROKEN_REFERENCE' | 'BROKEN_GALLERY' | 'NO_IMAGE';

interface PlateResult {
  placaId: string;
  codigo: string | null;
  empresaId: string | null;
  imagemPrincipal: string | null;
  imagem: string | null;
  storageKeyResolvida: string | null;
  sourceField: string | null;
  status: PlateStatus;
  r2Exists: boolean | null;
  r2ContentType: string | null;
  r2ContentLength: number | null;
  r2ErrorCode: string | null;
  fixable: boolean;
  fieldsToClear: string[];
}

interface ReconcileReport {
  total: number;
  ok: number;
  broken: number;
  brokenGallery: number;
  noImage: number;
  fixed: number;
  fixErrors: number;
  results: PlateResult[];
}

// ── Args ──────────────────────────────────────────────────────────────────────

const args = new Set(process.argv.slice(2));

const FIX_MODE   = args.has('--fix');
const DRY_RUN    = !FIX_MODE;
const VERBOSE    = args.has('--verbose') || args.has('--report');

const limitArg       = process.argv.find((a) => a.startsWith('--limit='));
const concurrencyArg = process.argv.find((a) => a.startsWith('--concurrency='));
const batchArg       = process.argv.find((a) => a.startsWith('--batch='));
const empresaArg     = process.argv.find((a) => a.startsWith('--empresa='));

const LIMIT       = limitArg       ? Math.max(1, parseInt(limitArg.split('=')[1]!, 10))       : Infinity;
const CONCURRENCY = concurrencyArg ? Math.max(1, parseInt(concurrencyArg.split('=')[1]!, 10)) : 5;
const BATCH_SIZE  = batchArg       ? Math.max(1, parseInt(batchArg.split('=')[1]!, 10))        : 50;
const EMPRESA_ID  = empresaArg     ? empresaArg.split('=')[1]! : null;

const MONGO_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  'mongodb://localhost:27017/inmidia';

// ── Concurrency limiter ───────────────────────────────────────────────────────

async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  maxConcurrent: number,
): Promise<T[]> {
  const results: T[] = [];
  const queue = [...tasks];

  async function worker() {
    while (queue.length > 0) {
      const task = queue.shift();
      if (task) results.push(await task());
    }
  }

  const workers = Array.from({ length: Math.min(maxConcurrent, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// ── R2 HeadObject ──────────────────────────────────────────────────────────────

interface HeadResult {
  exists: boolean;
  contentType: string | null;
  contentLength: number | null;
  errorCode: string | null;
}

async function headR2(storageKey: string): Promise<HeadResult> {
  const bucket = getR2BucketName();
  const client = getR2Client();

  if (!bucket || !client) {
    return { exists: false, contentType: null, contentLength: null, errorCode: 'R2_UNAVAILABLE' };
  }

  try {
    const res = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: storageKey }));
    return {
      exists: true,
      contentType: res.ContentType ?? null,
      contentLength: res.ContentLength ?? null,
      errorCode: null,
    };
  } catch (err: any) {
    const code: string = err?.name ?? err?.$metadata?.httpStatusCode?.toString() ?? 'UnknownError';
    return { exists: false, contentType: null, contentLength: null, errorCode: code };
  }
}

// ── Classify a single plate doc ───────────────────────────────────────────────

async function classifyPlate(doc: any): Promise<PlateResult> {
  const placaId   = String(doc._id);
  const codigo    = doc.numero_placa ?? doc.codigo ?? null;
  const empresaId = doc.empresaId ? String(doc.empresaId) : null;

  const imagemPrincipal = typeof doc.imagemPrincipal === 'string' ? doc.imagemPrincipal : null;
  const imagem          = typeof doc.imagem === 'string'          ? doc.imagem          : null;

  const resolved = resolvePlacaImageReference(doc);

  if (!resolved.hasImage || !resolved.storageKey) {
    return {
      placaId, codigo, empresaId, imagemPrincipal, imagem,
      storageKeyResolvida: null,
      sourceField: null,
      status: 'NO_IMAGE',
      r2Exists: null, r2ContentType: null, r2ContentLength: null, r2ErrorCode: null,
      fixable: false, fieldsToClear: [],
    };
  }

  const { storageKey, sourceField } = resolved;
  const r2 = await headR2(storageKey);

  if (r2.exists) {
    return {
      placaId, codigo, empresaId, imagemPrincipal, imagem,
      storageKeyResolvida: storageKey,
      sourceField: sourceField ?? null,
      status: 'OK',
      r2Exists: true, r2ContentType: r2.contentType, r2ContentLength: r2.contentLength, r2ErrorCode: null,
      fixable: false, fieldsToClear: [],
    };
  }

  // File missing in R2 — determine if it's fixable (top-level field) or not (gallery/sub-doc)
  const isGallery = sourceField
    ? sourceField.includes('[') || (sourceField.includes('.') && !TOP_LEVEL_IMAGE_FIELDS.includes(sourceField as any))
    : false;

  if (isGallery) {
    return {
      placaId, codigo, empresaId, imagemPrincipal, imagem,
      storageKeyResolvida: storageKey,
      sourceField: sourceField ?? null,
      status: 'BROKEN_GALLERY',
      r2Exists: false, r2ContentType: null, r2ContentLength: null, r2ErrorCode: r2.errorCode,
      fixable: false, fieldsToClear: [],
    };
  }

  // Fixable top-level scalar field
  const primary = sourceField ?? null;
  const fieldsToClear: string[] = [];
  if (primary && TOP_LEVEL_IMAGE_FIELDS.includes(primary as any)) {
    fieldsToClear.push(primary);
    const mirror = FIELD_MIRRORS[primary];
    if (mirror && fieldsToClear.indexOf(mirror) === -1) fieldsToClear.push(mirror);
  }

  return {
    placaId, codigo, empresaId, imagemPrincipal, imagem,
    storageKeyResolvida: storageKey,
    sourceField: primary,
    status: 'BROKEN_REFERENCE',
    r2Exists: false, r2ContentType: null, r2ContentLength: null, r2ErrorCode: r2.errorCode,
    fixable: fieldsToClear.length > 0,
    fieldsToClear,
  };
}

// ── Table output ──────────────────────────────────────────────────────────────

function statusLabel(status: PlateStatus): string {
  switch (status) {
    case 'OK':               return `${c.green}OK              ${c.reset}`;
    case 'BROKEN_REFERENCE': return `${c.red}BROKEN_REFERENCE${c.reset}`;
    case 'BROKEN_GALLERY':   return `${c.yellow}BROKEN_GALLERY  ${c.reset}`;
    case 'NO_IMAGE':         return `${c.dim}NO_IMAGE        ${c.reset}`;
  }
}

function truncate(value: string | null, len: number): string {
  if (!value) return `${c.dim}—${c.reset}`;
  return value.length > len ? value.slice(0, len - 1) + '…' : value.padEnd(len);
}

function printTable(results: PlateResult[], showAll: boolean) {
  const toShow = showAll ? results : results.filter((r) => r.status !== 'NO_IMAGE');
  if (toShow.length === 0) {
    dim('  (nenhuma placa com imagem para exibir)');
    return;
  }

  const header = [
    'codigo'.padEnd(14),
    'imagemPrincipal'.padEnd(30),
    'storageKey resolvida'.padEnd(45),
    'status',
  ].join('  ');
  log(`\n${c.bold}${c.white}  ${header}${c.reset}`);
  rule();

  for (const r of toShow) {
    const row = [
      truncate(r.codigo, 14),
      truncate(r.imagemPrincipal, 30),
      truncate(r.storageKeyResolvida, 45),
      statusLabel(r.status),
    ].join('  ');
    log(`  ${row}`);
  }
}

function printDetail(r: PlateResult) {
  const statusStr = r.status === 'OK' ? 'OK' : r.status;
  log(`\n  ${c.bold}${r.codigo ?? r.placaId}${c.reset}  [${statusStr}]`);
  log(`    placaId:          ${r.placaId}`);
  log(`    imagemPrincipal:  ${r.imagemPrincipal ?? c.dim + '(vazio)' + c.reset}`);
  log(`    imagem:           ${r.imagem ?? c.dim + '(vazio)' + c.reset}`);
  log(`    storageKey:       ${r.storageKeyResolvida ?? c.dim + '(não resolvida)' + c.reset}`);
  log(`    sourceField:      ${r.sourceField ?? c.dim + '(none)' + c.reset}`);
  if (r.r2Exists === true)  log(`    R2:               ${c.green}✓ exists (${r.r2ContentType}, ${r.r2ContentLength} bytes)${c.reset}`);
  if (r.r2Exists === false) log(`    R2:               ${c.red}✗ not found (${r.r2ErrorCode})${c.reset}`);
  if (r.status === 'BROKEN_REFERENCE') {
    log(`    fieldsToClear:    ${r.fixable ? r.fieldsToClear.join(', ') : c.yellow + 'não fixável via script' + c.reset}`);
  }
}

// ── Confirmação interativa ────────────────────────────────────────────────────

async function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'sim');
    });
  });
}

// ── Fix: atualiza MongoDB + invalida cache Redis ──────────────────────────────

async function applyFix(
  results: PlateResult[],
  redisAvailable: boolean,
): Promise<{ fixed: number; errors: number }> {
  const fixable = results.filter((r) => r.status === 'BROKEN_REFERENCE' && r.fixable && r.fieldsToClear.length > 0);

  if (fixable.length === 0) {
    info('Nenhuma placa fixável encontrada.');
    return { fixed: 0, errors: 0 };
  }

  head(`Aplicando fix em ${fixable.length} placa(s)`);

  const db = mongoose.connection.db;
  if (!db) throw new Error('Conexão com banco retornou undefined');
  const placas = db.collection('placas');

  let fixed = 0;
  let errors = 0;

  // Process in batches of 50
  const WRITE_BATCH = 50;
  for (let i = 0; i < fixable.length; i += WRITE_BATCH) {
    const slice = fixable.slice(i, i + WRITE_BATCH);

    const bulkOps = slice.map((r) => {
      const unsetFields: Record<string, ''> = {};
      for (const field of r.fieldsToClear) {
        unsetFields[field] = '';
      }
      return {
        updateOne: {
          filter: { _id: new mongoose.Types.ObjectId(r.placaId) },
          update: { $unset: unsetFields },
        },
      };
    });

    try {
      const res = await placas.bulkWrite(bulkOps, { ordered: false });
      fixed += res.modifiedCount;

      // Invalida cache Redis (fire-and-forget)
      if (redisAvailable) {
        await Promise.allSettled(
          slice.map((r) => clearImageNotFound(r.placaId)),
        );
      }

      for (const r of slice) {
        ok(`  [FIX] ${r.codigo ?? r.placaId} — $unset: { ${r.fieldsToClear.join(', ')} }`);
      }
    } catch (err: any) {
      fail(`  [ERROR] bulkWrite falhou no batch ${i}–${i + slice.length}: ${err?.message ?? err}`);
      errors += slice.length;
    }
  }

  return { fixed, errors };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  head('reconcile:placa-images');

  if (DRY_RUN) {
    warn('MODO DRY-RUN — nenhuma alteração será feita no banco.');
    warn('Execute com --fix para corrigir referências quebradas.');
  } else {
    warn('MODO --fix ATIVO — referências quebradas serão REMOVIDAS do MongoDB.');
  }

  log('');
  info(`Limite: ${isFinite(LIMIT) ? LIMIT + ' placas' : 'sem limite'}`);
  info(`Concorrência R2: ${CONCURRENCY}`);
  if (EMPRESA_ID) info(`Filtrando por empresaId: ${EMPRESA_ID}`);

  // ── Conecta MongoDB ──────────────────────────────────────────────────────────
  head('Conectando ao MongoDB');
  info(`URI: ${MONGO_URI.replace(/:\/\/([^:]+):([^@]+)@/, '://*****:*****@')}`);
  if (!MONGO_URI) {
    fail('MONGODB_URI ausente. Defina no .env');
    process.exit(1);
  }
  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 10_000 });
  ok('Conectado ao MongoDB.');

  // ── Conecta Redis (opcional) ──────────────────────────────────────────────────
  let redisAvailable = false;
  if (FIX_MODE) {
    head('Conectando ao Redis (opcional)');
    try {
      redisManager.connect(config.redisUrl ?? '', config.redisEnabled ?? true);
      redisAvailable = await redisManager.waitUntilReady(3_000);
      if (redisAvailable) {
        ok('Redis disponível — clearImageNotFound será chamado após o fix.');
      } else {
        warn('Redis indisponível — fix continuará sem invalidar o cache de imagens.');
      }
    } catch {
      warn('Falha ao conectar Redis — fix continuará sem invalidar o cache.');
    }
  }

  // ── Confirmação para modo --fix ───────────────────────────────────────────────
  if (FIX_MODE) {
    const totalGeral = await Placa.countDocuments({ statusOperacional: { $ne: 'ARCHIVED' } });
    log('');
    warn(`Esta operação pode modificar documentos em uma coleção com ${totalGeral} placas.`);
    warn(`URI: ${MONGO_URI.replace(/:\/\/([^:]+):([^@]+)@/, '://*****:*****@')}`);
    const confirmed = await askConfirmation(
      `${c.yellow}${c.bold}Digite "sim" para confirmar a execução REAL: ${c.reset}`,
    );
    if (!confirmed) {
      info('Operação cancelada pelo usuário.');
      await mongoose.disconnect();
      process.exit(0);
    }
  }

  // ── Verifica R2 ────────────────────────────────────────────────────────────────
  const bucket = getR2BucketName();
  const r2client = getR2Client();
  if (!bucket || !r2client) {
    fail('R2 não configurado. Defina R2_BUCKET_NAME, R2_ENDPOINT, R2_ACCESS_KEY_ID e R2_SECRET_ACCESS_KEY no .env');
    await mongoose.disconnect();
    process.exit(1);
  }
  info(`R2 bucket: ${bucket}`);

  // ── Cursor sobre placas ────────────────────────────────────────────────────────
  head('Escaneando placas');

  const mongoFilter: Record<string, unknown> = {
    statusOperacional: { $ne: 'ARCHIVED' },
  };
  if (EMPRESA_ID) mongoFilter.empresaId = new mongoose.Types.ObjectId(EMPRESA_ID);

  const report: ReconcileReport = {
    total: 0, ok: 0, broken: 0, brokenGallery: 0, noImage: 0, fixed: 0, fixErrors: 0,
    results: [],
  };

  const cursor = Placa.find(mongoFilter)
    .select(PLACA_IMAGE_SELECT)
    .lean()
    .cursor();

  let batch: any[] = [];

  const processBatch = async (docs: any[]) => {
    const tasks = docs.map((doc) => () => classifyPlate(doc));
    const batchResults = await runWithConcurrency(tasks, CONCURRENCY);

    for (const r of batchResults) {
      report.total++;
      report.results.push(r);

      switch (r.status) {
        case 'OK':               report.ok++;           break;
        case 'BROKEN_REFERENCE': report.broken++;       break;
        case 'BROKEN_GALLERY':   report.brokenGallery++; break;
        case 'NO_IMAGE':         report.noImage++;      break;
      }
    }

    process.stdout.write(
      `\r${c.dim}Analisadas: ${report.total} | OK: ${report.ok} | BROKEN: ${report.broken} | SEM_IMG: ${report.noImage}   ${c.reset}`,
    );
  };

  for await (const doc of cursor) {
    if (report.total >= LIMIT) break;
    batch.push(doc);
    if (batch.length >= BATCH_SIZE) {
      await processBatch(batch);
      batch = [];
    }
  }
  if (batch.length > 0 && report.total < LIMIT) await processBatch(batch);

  // Clear progress line
  process.stdout.write('\r' + ' '.repeat(80) + '\r');

  // ── Relatório ─────────────────────────────────────────────────────────────────
  head('Relatório');

  if (VERBOSE) {
    // Detailed per-plate output for BROKEN and BROKEN_GALLERY
    const broken = report.results.filter(
      (r) => r.status === 'BROKEN_REFERENCE' || r.status === 'BROKEN_GALLERY',
    );
    if (broken.length > 0) {
      log(`\n${c.bold}Placas com referência quebrada (${broken.length}):${c.reset}`);
      for (const r of broken) printDetail(r);
    }
  }

  // Summary table (all non-NO_IMAGE)
  printTable(report.results, false);

  log('');
  rule();
  log(`\n  ${c.bold}Resumo:${c.reset}`);
  log(`  Total analisado:       ${report.total}`);
  log(`  ${c.green}OK (R2 confirmado):    ${report.ok}${c.reset}`);
  log(`  ${c.red}BROKEN_REFERENCE:      ${report.broken}${c.reset}` + (report.broken > 0 ? ` ← arquivo ausente no R2` : ''));
  log(`  ${c.yellow}BROKEN_GALLERY:       ${report.brokenGallery}${c.reset}` + (report.brokenGallery > 0 ? ` ← galeria com ref quebrada (manual)` : ''));
  log(`  ${c.dim}NO_IMAGE:              ${report.noImage}${c.reset}`);
  log('');

  if (report.broken > 0 && DRY_RUN) {
    const fixable = report.results.filter((r) => r.status === 'BROKEN_REFERENCE' && r.fixable).length;
    warn(`${report.broken} placa(s) com referência quebrada detectada(s).`);
    if (fixable > 0) {
      warn(`${fixable} podem ser corrigidas automaticamente com: npm run reconcile:placa-images -- --fix`);
    }
    if (report.broken - fixable > 0) {
      warn(`${report.broken - fixable} têm referência em galeria (BROKEN_GALLERY) — requerem intervenção manual.`);
    }
  }

  if (report.brokenGallery > 0) {
    warn(`${report.brokenGallery} placa(s) com referência quebrada na galeria (imagens[]).`);
    warn('Essas não são alteradas pelo --fix. Corrija manualmente ou re-faça o upload.');
  }

  // ── Fix mode ──────────────────────────────────────────────────────────────────
  if (FIX_MODE && report.broken > 0) {
    const { fixed, errors } = await applyFix(report.results, redisAvailable);
    report.fixed = fixed;
    report.fixErrors = errors;

    log('');
    head('Resultado do Fix');
    log(`  ${c.green}Documentos atualizados:  ${fixed}${c.reset}`);
    if (errors > 0) log(`  ${c.red}Erros:                   ${errors}${c.reset}`);
    if (redisAvailable) ok('Cache Redis invalidado para placas corrigidas.');
    else warn('Cache Redis NÃO invalidado (Redis indisponível). O TTL irá expirar naturalmente em 5 min.');

    log('');
    ok('Fix concluído. A listagem pública vai refletir as mudanças imediatamente (ou em até 5 min se o cache Redis expirar).');
  } else if (FIX_MODE && report.broken === 0) {
    ok('Nenhuma placa com referência quebrada encontrada. Nada a corrigir.');
  }

  // ── Encerra conexões ──────────────────────────────────────────────────────────
  await mongoose.disconnect();
  if (redisAvailable) await redisManager.disconnect();
  ok('Desconectado.');
  log('');

  process.exit(report.fixErrors > 0 ? 1 : 0);
}

main().catch(async (err) => {
  fail(`Erro fatal: ${err?.message ?? err}`);
  console.error(err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
