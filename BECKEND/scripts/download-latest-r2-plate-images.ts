#!/usr/bin/env ts-node
/**
 * download-latest-r2-plate-images.ts
 *
 * Para cada placa no MongoDB, localiza o arquivo mais recente no prefixo R2
 *   empresas/<empresaId>/plates/<placaId>/
 * e o baixa para:
 *   latest-plate-images/<placaId>/image.<ext>
 *   latest-plate-images/<placaId>/metadata.json
 *
 * Gera relatórios em:
 *   reports/latest-r2-plate-images.json
 *   reports/latest-r2-plate-images.csv
 *
 * Uso:
 *   npm run download:r2-latest-plate-images
 *   npm run download:r2-latest-plate-images -- --dry-run
 *   npm run download:r2-latest-plate-images -- --empresa=<id> --limit=50 --concurrency=3
 *
 * Flags:
 *   --empresa=<id>    Filtra placas por empresaId
 *   --limit=N         Processa no máximo N placas
 *   --concurrency=N   Nº de downloads paralelos (default: 3)
 *   --dry-run         Exibe o que seria baixado, sem escrever nada
 *
 * Apenas leitura: não modifica MongoDB, R2 nem Redis.
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import mongoose from 'mongoose';
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import Placa from '@modules/placas/Placa';
import { getR2BucketName, getR2Client } from '@shared/infra/storage/r2-client';

// ── Cores ─────────────────────────────────────────────────────────────────────

const c = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  red:    '\x1b[31m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  blue:   '\x1b[34m',
  cyan:   '\x1b[36m',
};

const log  = (msg: string) => console.log(msg);
const info = (msg: string) => log(`${c.cyan}ℹ  ${msg}${c.reset}`);
const ok   = (msg: string) => log(`${c.green}[OK ] ${msg}${c.reset}`);
const warn = (msg: string) => log(`${c.yellow}[MISS] ${msg}${c.reset}`);
const fail = (msg: string) => log(`${c.red}[ERR] ${msg}${c.reset}`);
const head = (msg: string) => log(`\n${c.bold}${c.blue}── ${msg} ──${c.reset}`);
const rule = ()            => log(`${c.dim}${'─'.repeat(80)}${c.reset}`);

// ── Args ──────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);

function argValue(prefix: string): string | undefined {
  const found = argv.find((a) => a.startsWith(prefix + '='));
  return found ? found.slice(prefix.length + 1) : undefined;
}

const DRY_RUN     = argv.includes('--dry-run');
const EMPRESA_ID  = argValue('--empresa');
const LIMIT       = argValue('--limit')       ? Math.max(1, parseInt(argValue('--limit')!,       10)) : Infinity;
const CONCURRENCY = argValue('--concurrency') ? Math.max(1, parseInt(argValue('--concurrency')!, 10)) : 3;

const MONGO_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  'mongodb://localhost:27017/inmidia';

// ── Paths ─────────────────────────────────────────────────────────────────────

const SCRIPT_DIR   = __dirname;
const BACKEND_ROOT = path.resolve(SCRIPT_DIR, '..');
const IMAGES_ROOT  = path.resolve(BACKEND_ROOT, 'latest-plate-images');
const REPORTS_DIR  = path.resolve(BACKEND_ROOT, 'reports');

// ── Path traversal guard ──────────────────────────────────────────────────────

function safePath(base: string, ...parts: string[]): string {
  const joined   = parts.join(path.sep).replace(/\\/g, '/').replace(/^\/+/, '');
  const resolved = path.resolve(base, joined);

  if (!resolved.startsWith(base + path.sep) && resolved !== base) {
    throw new Error(`Path traversal detectado: ${parts.join('/')}`);
  }

  return resolved;
}

// ── Concurrency limiter ───────────────────────────────────────────────────────

async function withConcurrency<T>(
  tasks: (() => Promise<T>)[],
  max: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  const queue = tasks.map((fn, i) => ({ fn, i }));
  let cursor = 0;

  async function worker() {
    while (cursor < queue.length) {
      const item = queue[cursor++]!;
      results[item.i] = await item.fn();
    }
  }

  const pool = Array.from({ length: Math.min(max, tasks.length) }, worker);
  await Promise.all(pool);
  return results;
}

// ── R2 helpers ────────────────────────────────────────────────────────────────

interface R2Object {
  key: string;
  lastModified: Date;
  size: number;
}

async function listPrefix(
  client: S3Client,
  bucket: string,
  prefix: string,
): Promise<R2Object[]> {
  const objects: R2Object[] = [];
  let token: string | undefined;

  do {
    const cmd = new ListObjectsV2Command({
      Bucket:            bucket,
      Prefix:            prefix,
      ContinuationToken: token,
      MaxKeys:           1000,
    });
    const res = await client.send(cmd);

    for (const obj of res.Contents ?? []) {
      if (!obj.Key) continue;
      objects.push({
        key:          obj.Key,
        lastModified: obj.LastModified ?? new Date(0),
        size:         obj.Size ?? 0,
      });
    }

    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);

  return objects;
}

async function downloadObject(
  client: S3Client,
  bucket: string,
  key: string,
  destPath: string,
): Promise<void> {
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  const res = await client.send(cmd);

  if (!res.Body) throw new Error('Resposta sem body');

  const dir = path.dirname(destPath);
  await fs.promises.mkdir(dir, { recursive: true });

  const ws = fs.createWriteStream(destPath);
  await pipeline(res.Body as Readable, ws);
}

// ── Extension helper ──────────────────────────────────────────────────────────

const ALLOWED_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff', '.avif']);

function resolveExt(key: string): string {
  const ext = path.extname(key).toLowerCase();
  return ALLOWED_EXTS.has(ext) ? ext : '.jpg';
}

// ── Report types ──────────────────────────────────────────────────────────────

type RowStatus = 'DOWNLOADED' | 'NO_R2_FILES' | 'ERROR' | 'DRY_RUN';

interface ReportRow {
  placaId:      string;
  empresaId:    string;
  codigo:       string | null;
  nome:         string | null;
  slug:         string | null;
  prefix:       string;
  status:       RowStatus;
  selectedKey:  string | null;
  lastModified: string | null;
  size:         number | null;
  localPath:    string | null;
  error:        string | null;
  createdAt:    string | null;
  updatedAt:    string | null;
}

// ── CSV ───────────────────────────────────────────────────────────────────────

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const CSV_HEADERS: (keyof ReportRow)[] = [
  'placaId', 'empresaId', 'codigo', 'nome', 'slug',
  'prefix', 'status', 'selectedKey', 'lastModified',
  'size', 'localPath', 'error', 'createdAt', 'updatedAt',
];

function rowToCSV(row: ReportRow): string {
  return CSV_HEADERS.map((h) => escapeCSV(row[h])).join(',');
}

// ── Process a single plate ────────────────────────────────────────────────────

async function processPlate(
  doc: any,
  client: S3Client,
  bucket: string,
): Promise<ReportRow> {
  const placaId  = String(doc._id);
  const empresaId = doc.empresaId ? String(doc.empresaId) : '';
  const codigo   = doc.codigo ?? doc.numero_placa ?? null;
  const nome     = doc.nome ?? null;
  const slug     = doc.slug ?? null;
  const prefix   = `empresas/${empresaId}/plates/${placaId}/`;

  const base: Omit<ReportRow, 'status' | 'selectedKey' | 'lastModified' | 'size' | 'localPath' | 'error'> = {
    placaId,
    empresaId,
    codigo,
    nome,
    slug,
    prefix,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
  };

  log(`${c.dim}[SCAN] ${placaId}  ${codigo ?? '(sem código)'}${c.reset}`);

  // ── List R2 objects ────────────────────────────────────────────────────────
  let objects: R2Object[];
  try {
    objects = await listPrefix(client, bucket, prefix);
  } catch (err: any) {
    fail(`${placaId} — erro ao listar prefixo: ${err?.message ?? err}`);
    return { ...base, status: 'ERROR', selectedKey: null, lastModified: null, size: null, localPath: null, error: err?.message ?? String(err) };
  }

  log(`${c.dim}[FOUND] ${objects.length} arquivo(s) em ${prefix}${c.reset}`);

  if (objects.length === 0) {
    warn(`${placaId}  ${codigo ?? ''} — nenhum arquivo no R2`);
    return { ...base, status: 'NO_R2_FILES', selectedKey: null, lastModified: null, size: null, localPath: null, error: null };
  }

  // ── Pick most recent ───────────────────────────────────────────────────────
  objects.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
  const latest = objects[0]!;

  if (DRY_RUN) {
    log(`${c.yellow}[DRY ] ${latest.key}${c.reset}`);
    return {
      ...base,
      status:       'DRY_RUN',
      selectedKey:  latest.key,
      lastModified: latest.lastModified.toISOString(),
      size:         latest.size,
      localPath:    null,
      error:        null,
    };
  }

  // ── Download ───────────────────────────────────────────────────────────────
  const ext       = resolveExt(latest.key);
  const imageDir  = safePath(IMAGES_ROOT, placaId);
  const imagePath = path.join(imageDir, `image${ext}`);
  const metaPath  = path.join(imageDir, 'metadata.json');

  log(`${c.dim}[GET ] ${latest.key}${c.reset}`);

  try {
    await downloadObject(client, bucket, latest.key, imagePath);
  } catch (err: any) {
    fail(`${latest.key} — ${err?.message ?? err}`);
    return { ...base, status: 'ERROR', selectedKey: latest.key, lastModified: latest.lastModified.toISOString(), size: latest.size, localPath: null, error: err?.message ?? String(err) };
  }

  // ── Write metadata ─────────────────────────────────────────────────────────
  const metadata = {
    placaId,
    empresaId,
    codigo,
    nome,
    slug,
    prefix,
    selectedKey:  latest.key,
    lastModified: latest.lastModified.toISOString(),
    size:         latest.size,
    createdAt:    base.createdAt,
    updatedAt:    base.updatedAt,
  };

  await fs.promises.writeFile(metaPath, JSON.stringify(metadata, null, 2), 'utf-8');

  ok(`${placaId}  →  ${imagePath}`);

  return {
    ...base,
    status:       'DOWNLOADED',
    selectedKey:  latest.key,
    lastModified: latest.lastModified.toISOString(),
    size:         latest.size,
    localPath:    imagePath,
    error:        null,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  head('download:r2-latest-plate-images');

  if (DRY_RUN) {
    log(`${c.yellow}MODO DRY-RUN — nenhum arquivo será baixado.${c.reset}`);
  }

  info(`Destino:     ${IMAGES_ROOT}`);
  info(`Relatórios:  ${REPORTS_DIR}`);
  if (EMPRESA_ID)       info(`Empresa:     ${EMPRESA_ID}`);
  if (isFinite(LIMIT))  info(`Limite:      ${LIMIT} placas`);
  info(`Concorrência: ${CONCURRENCY}`);

  // ── MongoDB ────────────────────────────────────────────────────────────────
  head('Conectando ao MongoDB');
  info(`URI: ${MONGO_URI.replace(/:\/\/([^:]+):([^@]+)@/, '://*****:*****@')}`);

  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 10_000 });
  log(`${c.green}✓  Conectado ao MongoDB.${c.reset}`);

  // ── R2 ─────────────────────────────────────────────────────────────────────
  const bucket = getR2BucketName();
  const client = getR2Client();

  if (!bucket || !client) {
    fail('R2 não configurado. Verifique: R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME');
    await mongoose.disconnect();
    process.exit(1);
  }

  info(`Bucket R2: ${bucket}`);

  // ── Fetch plates ───────────────────────────────────────────────────────────
  head('Buscando placas no MongoDB');

  const filter: Record<string, unknown> = {};
  if (EMPRESA_ID) filter.empresaId = new mongoose.Types.ObjectId(EMPRESA_ID);

  const docs = await Placa.find(filter)
    .select('_id codigo nome slug empresaId createdAt updatedAt')
    .lean()
    .limit(isFinite(LIMIT) ? LIMIT : 0);

  info(`Placas encontradas: ${docs.length}`);

  if (docs.length === 0) {
    log(`${c.yellow}Nenhuma placa encontrada com os filtros aplicados.${c.reset}`);
    await mongoose.disconnect();
    process.exit(0);
  }

  // ── Ensure output dirs ─────────────────────────────────────────────────────
  if (!DRY_RUN) {
    await fs.promises.mkdir(IMAGES_ROOT, { recursive: true });
  }
  await fs.promises.mkdir(REPORTS_DIR, { recursive: true });

  // ── Process plates in parallel ─────────────────────────────────────────────
  head('Processando placas');

  const startTime = Date.now();

  const tasks = docs.map((doc) => () => processPlate(doc, client!, bucket));
  const rows: ReportRow[] = await withConcurrency(tasks, CONCURRENCY);

  // ── Save reports ───────────────────────────────────────────────────────────
  head('Gerando relatórios');

  const jsonPath = path.join(REPORTS_DIR, 'latest-r2-plate-images.json');
  const csvPath  = path.join(REPORTS_DIR, 'latest-r2-plate-images.csv');

  await fs.promises.writeFile(jsonPath, JSON.stringify(rows, null, 2), 'utf-8');

  const csvLines = [
    CSV_HEADERS.join(','),
    ...rows.map(rowToCSV),
  ];
  await fs.promises.writeFile(csvPath, csvLines.join('\n'), 'utf-8');

  ok(`JSON: ${jsonPath}`);
  ok(`CSV:  ${csvPath}`);

  // ── Summary ────────────────────────────────────────────────────────────────
  const byStatus = (s: RowStatus) => rows.filter((r) => r.status === s).length;
  const elapsed  = ((Date.now() - startTime) / 1000).toFixed(1);

  log('');
  rule();
  log(`\n  ${c.bold}Resumo:${c.reset}`);
  log(`  Placas processadas:   ${rows.length}`);
  log(`  ${c.green}Baixadas:             ${byStatus('DOWNLOADED')}${c.reset}`);
  log(`  ${c.yellow}Sem arquivo no R2:    ${byStatus('NO_R2_FILES')}${c.reset}`);
  log(`  ${c.red}Erros:                ${byStatus('ERROR')}${c.reset}`);
  if (DRY_RUN) {
    log(`  ${c.cyan}Dry-run (listadas):   ${byStatus('DRY_RUN')}${c.reset}`);
  }
  log(`  Tempo total:          ${elapsed}s`);
  log('');

  await mongoose.disconnect();
  log(`${c.green}${c.bold}Concluído.${c.reset}\n`);

  process.exit(byStatus('ERROR') > 0 ? 1 : 0);
}

main().catch(async (err) => {
  fail(`Erro fatal: ${err?.message ?? err}`);
  console.error(err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
