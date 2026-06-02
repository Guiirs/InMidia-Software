#!/usr/bin/env ts-node
/**
 * download-r2-bucket.ts
 *
 * Faz backup completo (somente leitura) do bucket Cloudflare R2 para disco local.
 *
 * Uso:
 *   npm run download:r2-bucket
 *   npm run download:r2-bucket -- --prefix=empresas/
 *   npm run download:r2-bucket -- --limit=100
 *
 * Flags:
 *   --prefix=<path>   Baixa apenas objetos com este prefixo (ex: empresas/)
 *   --limit=N         Limita o total de downloads (útil para testes)
 *
 * Variáveis de ambiente necessárias (mesmas do sistema):
 *   R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
 *
 * Resultado: BECKEND/r2-backup/<key-original>
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';

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
const fail = (msg: string) => log(`${c.red}[ERR] ${msg}${c.reset}`);
const head = (msg: string) => log(`\n${c.bold}${c.blue}── ${msg} ──${c.reset}`);
const rule = ()            => log(`${c.dim}${'─'.repeat(80)}${c.reset}`);

// ── Args ──────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);

const prefixArg = argv.find((a) => a.startsWith('--prefix='));
const limitArg  = argv.find((a) => a.startsWith('--limit='));

const PREFIX = prefixArg ? prefixArg.split('=').slice(1).join('=') : undefined;
const LIMIT  = limitArg  ? Math.max(1, parseInt(limitArg.split('=')[1]!, 10)) : Infinity;

// ── R2 client ─────────────────────────────────────────────────────────────────

function normalizeEndpoint(endpoint: string): string {
  try {
    const url = new URL(endpoint);
    url.pathname = '';
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/+$/, '');
  } catch {
    return endpoint.replace(/\/+$/, '');
  }
}

function buildClient(): { client: S3Client; bucket: string } {
  const endpoint        = process.env.R2_ENDPOINT;
  const accessKeyId     = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket          = process.env.R2_BUCKET_NAME;

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    log(`${c.red}Variáveis de ambiente ausentes. Verifique:${c.reset}`);
    log('  R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME');
    process.exit(1);
  }

  const client = new S3Client({
    endpoint: normalizeEndpoint(endpoint),
    region: 'auto',
    credentials: { accessKeyId, secretAccessKey },
  });

  return { client, bucket };
}

// ── Path traversal guard ──────────────────────────────────────────────────────

const BACKUP_ROOT = path.resolve(__dirname, '..', 'r2-backup');

function safeLocalPath(key: string): string {
  // Normalise: strip leading slashes, collapse ..
  const sanitised = key.replace(/\\/g, '/').replace(/^\/+/, '');
  const resolved  = path.resolve(BACKUP_ROOT, sanitised);

  if (!resolved.startsWith(BACKUP_ROOT + path.sep) && resolved !== BACKUP_ROOT) {
    throw new Error(`Path traversal detectado para key: ${key}`);
  }

  return resolved;
}

// ── List all keys with pagination ─────────────────────────────────────────────

async function listAllKeys(
  client: S3Client,
  bucket: string,
  prefix: string | undefined,
  limit: number,
): Promise<string[]> {
  const keys: string[] = [];
  let continuationToken: string | undefined;

  info(`Listando objetos no bucket "${bucket}"${prefix ? ` com prefixo "${prefix}"` : ''}…`);

  do {
    const cmd = new ListObjectsV2Command({
      Bucket:            bucket,
      Prefix:            prefix,
      ContinuationToken: continuationToken,
      MaxKeys:           1000,
    });

    const res = await client.send(cmd);

    for (const obj of res.Contents ?? []) {
      if (!obj.Key) continue;
      keys.push(obj.Key);
      if (keys.length >= limit) break;
    }

    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;

    process.stdout.write(`\r${c.dim}  Encontrados: ${keys.length}…${c.reset}`);
  } while (continuationToken && keys.length < limit);

  process.stdout.write('\r' + ' '.repeat(60) + '\r');
  return keys;
}

// ── Download a single key ─────────────────────────────────────────────────────

async function downloadKey(
  client: S3Client,
  bucket: string,
  key: string,
): Promise<void> {
  const localPath = safeLocalPath(key);
  const dir       = path.dirname(localPath);

  await fs.promises.mkdir(dir, { recursive: true });

  log(`${c.dim}[GET] ${key}${c.reset}`);

  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  const res = await client.send(cmd);

  if (!res.Body) throw new Error('Resposta sem body');

  const writeStream = fs.createWriteStream(localPath);
  await pipeline(res.Body as Readable, writeStream);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  head('download:r2-bucket');
  info(`Destino: ${BACKUP_ROOT}`);
  if (PREFIX) info(`Prefixo: ${PREFIX}`);
  if (isFinite(LIMIT)) info(`Limite:  ${LIMIT} arquivos`);

  const { client, bucket } = buildClient();
  info(`Bucket: ${bucket}`);

  const startTime = Date.now();

  // ── Lista ────────────────────────────────────────────────────────────────────
  head('Listando objetos');
  const keys = await listAllKeys(client, bucket, PREFIX, LIMIT);
  info(`Total encontrado: ${keys.length} objeto(s)`);

  if (keys.length === 0) {
    log(`\n${c.yellow}Nenhum objeto encontrado. Bucket vazio ou prefixo inválido.${c.reset}`);
    process.exit(0);
  }

  // ── Download ─────────────────────────────────────────────────────────────────
  head('Baixando arquivos');

  let downloaded = 0;
  let errors     = 0;

  for (const key of keys) {
    try {
      await downloadKey(client, bucket, key);
      ok(key);
      downloaded++;
    } catch (err: any) {
      fail(`${key} — ${err?.message ?? err}`);
      errors++;
    }
  }

  // ── Resumo ───────────────────────────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  log('');
  rule();
  log(`\n  ${c.bold}Resumo:${c.reset}`);
  log(`  Arquivos encontrados: ${keys.length}`);
  log(`  ${c.green}Arquivos baixados:    ${downloaded}${c.reset}`);
  log(`  ${errors > 0 ? c.red : c.dim}Arquivos com erro:    ${errors}${c.reset}`);
  log(`  Tempo total:          ${elapsed}s`);
  log(`  Destino:              ${BACKUP_ROOT}`);
  log('');

  if (errors > 0) {
    log(`${c.yellow}Alguns arquivos falharam. Execute novamente para tentar novamente.${c.reset}\n`);
    process.exit(1);
  }

  log(`${c.green}${c.bold}Backup concluído com sucesso.${c.reset}\n`);
}

main().catch((err) => {
  fail(`Erro fatal: ${err?.message ?? err}`);
  console.error(err);
  process.exit(1);
});
