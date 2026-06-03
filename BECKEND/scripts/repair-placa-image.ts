#!/usr/bin/env ts-node
/**
 * repair-placa-image.ts
 *
 * Diagnóstico + reparo da referência de imagem de uma placa específica.
 *
 * Uso:
 *   npm run repair:placa-image -- [placaId]
 *   npm run repair:placa-image:fix -- [placaId]
 *
 * Flags:
 *   --fix       Aplica o reparo no MongoDB e invalida o cache Redis
 *   --dry-run   Apenas diagnóstico, sem alterar nada (padrão)
 *
 * Diagnóstico produzido:
 *   1. Campos de imagem no documento Mongo (raw)
 *   2. Candidatos considerados por getPlacaImageCandidates e quais passam em extractR2Key
 *   3. Lista de objetos R2 sob os prefixos esperados da placa
 *   4. Veredicto: por que hasImage = false e qual a melhor chave para reparo
 *
 * Reparo aplicado (com --fix):
 *   - Encontra o arquivo válido no R2 sob o prefixo da placa
 *   - Grava imagemPrincipal e imagem com a chave correta
 *   - Reconstrói imagens[] descartando entradas quebradas/inexistentes no R2
 *   - Invalida cache Redis (não-bloqueia se Redis indisponível)
 */

import 'dotenv/config';
import mongoose, { Types } from 'mongoose';
import { ListObjectsV2Command, HeadObjectCommand } from '@aws-sdk/client-s3';
import Placa from '@modules/placas/Placa';
import { extractR2Key } from '@shared/infra/storage/r2-key.helper';
import {
  getPlacaImageCandidates,
  resolvePlacaImageReference,
} from '@modules/media/placa-image-reference.resolver';
import { getR2BucketName, getR2Client } from '@shared/infra/storage/r2-client';
import { redisManager } from '@shared/infra/redis/redis-manager';
import {
  clearImageNotFound,
  invalidateImageMetaCache,
} from '@modules/public-plates/image-cache.service';
import config from '@config/config';

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
const ok   = (msg: string) => log(`${c.green}✓  ${msg}${c.reset}`);
const warn = (msg: string) => log(`${c.yellow}⚠  ${msg}${c.reset}`);
const fail = (msg: string) => log(`${c.red}✗  ${msg}${c.reset}`);
const info = (msg: string) => log(`${c.cyan}ℹ  ${msg}${c.reset}`);
const head = (msg: string) => log(`\n${c.bold}${c.blue}── ${msg} ──${c.reset}`);
const dim  = (msg: string) => log(`${c.dim}${msg}${c.reset}`);

// ── Args ──────────────────────────────────────────────────────────────────────

const rawArgs  = process.argv.slice(2);
const FIX_MODE = rawArgs.includes('--fix');
const TARGET_ID = rawArgs.find((a) => /^[a-f0-9]{24}$/i.test(a)) ?? '69b42002f5c3a35343097a2c';

const MONGO_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI  ||
  'mongodb://localhost:27017/inmidia';

const PLACA_IMAGE_SELECT =
  '_id empresaId numero_placa codigo mainImageUrl imagemPrincipal imagem imagens foto imageUrl fotoUrl storageKey imagemKey r2Key statusOperacional updatedAt';

// ── Helper local de normalização (sem lançar exceção) ─────────────────────────

/**
 * Tenta extrair a chave R2 de um valor qualquer.
 * Nunca lança — retorna null se inválido.
 * Não usa normalizePlacaStorageKey para não depender do módulo de produção aqui.
 */
function tryNormalizeCandidate(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    return extractR2Key(value.trim());
  } catch {
    return null;
  }
}

// ── R2 helpers ────────────────────────────────────────────────────────────────

interface R2Object {
  key: string;
  size: number;
  lastModified: Date | undefined;
}

async function listR2Prefix(prefix: string): Promise<R2Object[]> {
  const bucket = getR2BucketName();
  const client = getR2Client();
  if (!bucket || !client) return [];
  try {
    const res = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, MaxKeys: 200 }),
    );
    return (res.Contents ?? []).map((obj) => ({
      key:          obj.Key ?? '',
      size:         obj.Size ?? 0,
      lastModified: obj.LastModified,
    }));
  } catch {
    return [];
  }
}

async function headR2(key: string): Promise<{ exists: boolean; contentType: string | null; contentLength: number | null }> {
  const bucket = getR2BucketName();
  const client = getR2Client();
  if (!bucket || !client) return { exists: false, contentType: null, contentLength: null };
  try {
    const res = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return { exists: true, contentType: res.ContentType ?? null, contentLength: res.ContentLength ?? null };
  } catch {
    return { exists: false, contentType: null, contentLength: null };
  }
}

// ── Diagnóstico ────────────────────────────────────────────────────────────────

function printImageFields(doc: any): void {
  const scalar = [
    'mainImageUrl', 'imagemPrincipal', 'imagem', 'foto',
    'imageUrl', 'fotoUrl', 'storageKey', 'imagemKey', 'r2Key',
  ];
  for (const field of scalar) {
    const val = doc[field];
    if (val != null && val !== '') {
      log(`    ${field.padEnd(18)} = ${String(val).slice(0, 100)}`);
    } else {
      dim(`    ${field.padEnd(18)} = (vazio)`);
    }
  }

  const imagens: any[] = Array.isArray(doc.imagens) ? doc.imagens : [];
  if (imagens.length === 0) {
    dim(`    imagens[]          = (vazia)`);
  } else {
    log(`    imagens[]          = ${imagens.length} entrada(s)`);
    imagens.forEach((img: any, i: number) => {
      log(`      [${i}] isMain=${img.isMain ?? false}  category=${img.category ?? '?'}`);
      log(`           url       = ${String(img.url ?? '').slice(0, 90)}`);
      log(`           key       = ${String(img.key ?? '').slice(0, 90)}`);
      log(`           storageKey= ${String(img.storageKey ?? '').slice(0, 90)}`);
      log(`           publicUrl = ${String(img.publicUrl ?? '').slice(0, 90)}`);
    });
  }
}

/** Mostra todos os candidatos e o resultado de extractR2Key para cada um. */
function printCandidates(doc: any): void {
  const candidates = getPlacaImageCandidates(doc);
  if (candidates.length === 0) {
    dim('    Nenhum candidato encontrado no documento.');
    return;
  }

  for (const candidate of candidates) {
    const raw = typeof candidate.value === 'string' ? candidate.value.trim() : '';
    if (!raw) continue;
    const key = tryNormalizeCandidate(raw);
    if (key) {
      ok(`    ${candidate.field.padEnd(32)}  →  ${key}`);
    } else {
      fail(`    ${candidate.field.padEnd(32)}  →  REJEITADO`);
      dim(`         valor: ${raw.slice(0, 90)}`);
    }
  }
}

// ── Seleção da melhor chave R2 para reparo ────────────────────────────────────

interface BestKey {
  storageKey: string;
  source: 'r2_listing' | 'gallery_key' | 'truncated_ext_fix' | 'top_field_path';
  r2ContentType: string | null;
  r2ContentLength: number | null;
}

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.svg'];

function hasImageExtension(key: string): boolean {
  return IMAGE_EXTENSIONS.some((ext) => key.toLowerCase().endsWith(ext));
}

/**
 * Escolhe o melhor arquivo real do R2 que pode servir como imagem principal.
 *
 * Estratégia (em ordem de prioridade):
 *  1. Arquivos listados no R2 sob o prefixo da placa — preferindo subpasta /main/, depois /,
 *     depois /history/ pelo mais recente
 *  2. Entradas de imagens[] cujo key/storageKey normaliza para chave existente no R2
 *  3. imagemPrincipal com extensão truncada — tenta variações de extensão
 */
async function findBestRepairKey(doc: any, empresaId: string): Promise<BestKey | null> {
  const platePrefix = `empresas/${empresaId}/plates/${TARGET_ID}/`;

  // ── 1. Listar R2 sob o prefixo completo da placa ────────────────────────────
  head(`R2: listando ${platePrefix}`);
  const allObjects = await listR2Prefix(platePrefix);

  if (allObjects.length === 0) {
    dim(`  (nenhum objeto encontrado em ${platePrefix})`);
  } else {
    allObjects.forEach((obj) => {
      log(`    ${obj.key}  (${obj.size} bytes, ${obj.lastModified?.toISOString() ?? '?'})`);
    });
  }

  const validImages = allObjects.filter((obj) => hasImageExtension(obj.key) && obj.size > 0);

  if (validImages.length > 0) {
    // Prioridade: main/ > raiz da placa > history/ — desempate: mais recente
    const score = (key: string): number => {
      if (key.includes('/main/'))    return 3;
      if (key.endsWith(TARGET_ID + '/')) return 2; // raiz direta (improvávelmas válido)
      if (!key.includes('/history/')) return 2;    // subpasta desconhecida, trata como raiz
      return 1;                                     // history/ = menor prioridade
    };
    const sorted = validImages.sort((a, b) => {
      const scoreDiff = score(b.key) - score(a.key);
      if (scoreDiff !== 0) return scoreDiff;
      return (b.lastModified?.getTime() ?? 0) - (a.lastModified?.getTime() ?? 0);
    });
    const best = sorted[0]!;
    const r2 = await headR2(best.key);
    ok(`  Melhor arquivo no R2: ${best.key}`);
    return { storageKey: best.key, source: 'r2_listing', r2ContentType: r2.contentType, r2ContentLength: r2.contentLength };
  }

  // ── 2. Tentar cada entrada de imagens[] com tryNormalizeCandidate ────────────
  const imagens: any[] = Array.isArray(doc.imagens) ? doc.imagens : [];
  for (const img of imagens) {
    const candidates = [img.storageKey, img.r2Key, img.imagemKey, img.key, img.publicUrl, img.url];
    for (const val of candidates) {
      const key = tryNormalizeCandidate(val);
      if (!key) continue;
      const r2 = await headR2(key);
      if (r2.exists) {
        ok(`  Chave encontrada em imagens[]: ${key}`);
        return { storageKey: key, source: 'gallery_key', r2ContentType: r2.contentType, r2ContentLength: r2.contentLength };
      }
    }
  }

  // ── 3. Recuperar extensão truncada do imagemPrincipal ────────────────────────
  // Ex: "...history/6a2006794af7648244623f0f.p" → tentar ".png", ".jpg", etc.
  const imagemPrincipalRaw: string | undefined = doc.imagemPrincipal;
  if (typeof imagemPrincipalRaw === 'string' && imagemPrincipalRaw.includes('/')) {
    const basePath = imagemPrincipalRaw.replace(/\.[^/.]*$/, ''); // strip extensão
    for (const ext of IMAGE_EXTENSIONS) {
      const candidate = basePath + ext;
      // Validar que é um caminho relativo aceitável (sem protocolo, sem extensão inválida)
      const normalized = tryNormalizeCandidate(candidate);
      if (!normalized) continue;
      const r2 = await headR2(normalized);
      if (r2.exists) {
        ok(`  Extensão truncada corrigida: ${normalized}`);
        return { storageKey: normalized, source: 'truncated_ext_fix', r2ContentType: r2.contentType, r2ContentLength: r2.contentLength };
      }
    }
  }

  return null;
}

// ── Reparo ─────────────────────────────────────────────────────────────────────

/**
 * Reconstrói o documento com a chave correta:
 *  - Grava imagemPrincipal e imagem com selectedKey
 *  - Reconstrói imagens[]: mantém apenas entradas cujo arquivo existe no R2,
 *    acrescenta (ou promove) a entrada da selectedKey como isMain/MAIN
 *  - Remove entradas com chaves inexistentes no R2 ou inválidas
 */
async function applyRepair(doc: any, selectedKey: string): Promise<void> {
  const placaId = String(doc._id);
  const db = mongoose.connection.db;
  if (!db) throw new Error('Conexão MongoDB retornou undefined');
  const placas = db.collection('placas');

  const oldGallery: any[] = Array.isArray(doc.imagens) ? doc.imagens : [];
  const cleanGallery: any[] = [];

  // Avaliar cada entrada existente
  for (const img of oldGallery) {
    const imgKey = tryNormalizeCandidate(img.storageKey ?? img.r2Key ?? img.imagemKey ?? img.key ?? img.url ?? '');
    if (!imgKey) {
      warn(`  Descartando entrada com key inválida: ${String(img.key ?? img.url ?? '').slice(0, 60)}`);
      continue;
    }
    // Se for a selectedKey, sempre manter (R2 já confirmado)
    if (imgKey === selectedKey) {
      cleanGallery.push({
        ...img,
        key:        selectedKey,
        storageKey: selectedKey,
        r2Key:      selectedKey,
        isMain:     true,
        category:   'MAIN',
      });
      continue;
    }
    // Para as demais, verificar se o arquivo existe no R2
    const r2 = await headR2(imgKey);
    if (!r2.exists) {
      warn(`  Descartando entrada com arquivo ausente no R2: ${imgKey}`);
      continue;
    }
    cleanGallery.push({
      ...img,
      key:        imgKey,
      storageKey: imgKey,
      r2Key:      imgKey,
      isMain:     false,
      category:   img.category === 'MAIN' ? 'OTHER' : (img.category ?? 'OTHER'),
    });
  }

  // Se a selectedKey não veio de uma entrada existente, adicionar nova entrada
  const alreadyPresent = cleanGallery.some((img) => img.storageKey === selectedKey);
  if (!alreadyPresent) {
    cleanGallery.unshift({
      _id:        new Types.ObjectId(),
      url:        selectedKey,
      key:        selectedKey,
      storageKey: selectedKey,
      r2Key:      selectedKey,
      category:   'MAIN',
      isMain:     true,
      source:     'UPLOAD',
      uploadedAt: new Date(),
      version:    1,
    });
  }

  await placas.updateOne(
    { _id: new Types.ObjectId(placaId) },
    {
      $set: {
        imagemPrincipal: selectedKey,
        imagem:          selectedKey,
        imagens:         cleanGallery,
      },
    },
  );

  ok(`  imagemPrincipal → ${selectedKey}`);
  ok(`  imagem          → ${selectedKey}`);
  ok(`  imagens[]       → ${cleanGallery.length} entrada(s) válida(s) (${oldGallery.length - cleanGallery.length + (alreadyPresent ? 0 : 1)} removida(s)/ignorada(s))`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  head(`repair-placa-image — ${FIX_MODE ? 'MODO --fix' : 'MODO DRY-RUN'}`);

  if (!MONGO_URI) { fail('MONGODB_URI ausente.'); process.exit(1); }
  if (!process.env.R2_BUCKET_NAME) { fail('R2_BUCKET_NAME ausente.'); process.exit(1); }

  info(`Target:  ${TARGET_ID}`);
  info(`Bucket:  ${process.env.R2_BUCKET_NAME}`);
  if (!FIX_MODE) warn('Dry-run — nenhuma alteração será feita. Use --fix para aplicar.');

  // ── Conecta MongoDB ──────────────────────────────────────────────────────────
  head('Conectando ao MongoDB');
  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 10_000 });
  ok('Conectado.');

  // ── Busca documento ──────────────────────────────────────────────────────────
  head('Documento no MongoDB');
  const doc = await Placa.findOne({ _id: TARGET_ID }).select(PLACA_IMAGE_SELECT).lean();

  if (!doc) {
    fail(`Placa ${TARGET_ID} não encontrada no MongoDB.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const empresaId: string | null = (doc as any).empresaId ? String((doc as any).empresaId) : null;
  ok(`Placa: ${(doc as any).numero_placa ?? (doc as any).codigo}  (empresaId: ${empresaId ?? 'desconhecido'})`);

  log('\n  Campos de imagem (raw do banco):');
  printImageFields(doc);

  // ── Estado atual do resolver ─────────────────────────────────────────────────
  head('resolvePlacaImageReference — estado atual');
  const resolved = resolvePlacaImageReference(doc as any);

  if (resolved.hasImage && resolved.storageKey) {
    warn(`  hasImage=true  storageKey=${resolved.storageKey}  source=${resolved.sourceField}`);
    const r2check = await headR2(resolved.storageKey);
    if (r2check.exists) {
      ok(`  Arquivo confirmado no R2 (${r2check.contentType}, ${r2check.contentLength} bytes).`);
      info('  Nenhum reparo necessário — referência válida e arquivo presente no R2.');
      await mongoose.disconnect();
      process.exit(0);
    }
    fail(`  Arquivo NÃO existe no R2: ${resolved.storageKey}  (BROKEN_REFERENCE)`);
  } else {
    fail(`  hasImage=false — nenhuma chave válida encontrada pelo resolver.`);
  }

  // ── Candidatos e motivo da rejeição ─────────────────────────────────────────
  head('Candidatos analisados por getPlacaImageCandidates');
  printCandidates(doc);

  // ── Buscar a melhor chave de reparo ──────────────────────────────────────────
  if (!empresaId) {
    fail('empresaId ausente — não é possível buscar prefixo no R2.');
    await mongoose.disconnect();
    process.exit(1);
  }

  const bestKey = await findBestRepairKey(doc as any, empresaId);

  if (!bestKey) {
    log('');
    fail('Nenhum arquivo R2 encontrado para os prefixos da placa.');
    warn('Ação necessária:');
    warn('  Faça o upload da imagem principal via painel interno.');
    warn('  Depois re-execute este script para confirmar o reparo.');
    await mongoose.disconnect();
    process.exit(0);
  }

  log('');
  ok(`Melhor chave para reparo: ${bestKey.storageKey}`);
  ok(`  Fonte: ${bestKey.source}  |  Tipo: ${bestKey.r2ContentType ?? '?'}  |  Tamanho: ${bestKey.r2ContentLength ?? '?'} bytes`);

  if (!FIX_MODE) {
    log('');
    warn('Dry-run: reparo NÃO aplicado.');
    info('  Chave que seria gravada em imagemPrincipal, imagem e imagens[]:');
    info(`    ${bestKey.storageKey}`);
    info('  Comando para aplicar:');
    info(`    npm run repair:placa-image:fix -- ${TARGET_ID}`);
    await mongoose.disconnect();
    process.exit(0);
  }

  // ── Aplicar reparo ───────────────────────────────────────────────────────────
  head('Aplicando reparo no MongoDB');
  await applyRepair(doc as any, bestKey.storageKey);

  // ── Verificar resultado ──────────────────────────────────────────────────────
  head('Verificando resultado pós-fix');
  const updatedDoc = await Placa.findOne({ _id: TARGET_ID }).select(PLACA_IMAGE_SELECT).lean();

  if (!updatedDoc) {
    fail('Documento não encontrado após o fix.');
  } else {
    const after = resolvePlacaImageReference(updatedDoc as any);
    if (after.hasImage && after.storageKey) {
      ok(`  resolvePlacaImageReference → hasImage=true  storageKey=${after.storageKey}`);
      const r2after = await headR2(after.storageKey);
      if (r2after.exists) {
        ok(`  Arquivo confirmado no R2 (${r2after.contentType}, ${r2after.contentLength} bytes).`);
      } else {
        fail(`  Arquivo ainda ausente no R2: ${after.storageKey}`);
      }
    } else {
      fail('  hasImage ainda é false após o reparo — verificar manualmente.');
    }
  }

  // ── Invalidar cache Redis ────────────────────────────────────────────────────
  head('Invalidando cache Redis');
  let redisOk = false;
  try {
    redisManager.connect(config.redisUrl ?? '', config.redisEnabled ?? true);
    redisOk = await redisManager.waitUntilReady(3_000);
    if (redisOk) {
      await Promise.allSettled([
        clearImageNotFound(TARGET_ID),
        invalidateImageMetaCache(TARGET_ID),
      ]);
      ok('Cache Redis invalidado.');
    } else {
      warn('Redis indisponível — cache expira em até 5 min naturalmente.');
    }
  } catch {
    warn('Falha ao conectar Redis — cache expira naturalmente.');
  }

  // ── Encerrar ─────────────────────────────────────────────────────────────────
  await mongoose.disconnect();
  if (redisOk) await redisManager.disconnect();

  log('');
  head('Resumo');
  ok(`Reparo concluído: ${TARGET_ID}`);
  ok(`Endpoint público deve retornar hasImage=true.`);
  info(`Teste: GET ${process.env.PUBLIC_API_BASE_URL ?? 'http://localhost:3000'}/api/v1/public/media/plates/${TARGET_ID}/main`);
}

main().catch(async (err) => {
  fail(`Erro fatal: ${err?.message ?? err}`);
  console.error(err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
