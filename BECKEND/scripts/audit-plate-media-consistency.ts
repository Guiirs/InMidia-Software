/**
 * audit-plate-media-consistency.ts
 *
 * Audita a consistência do PlateMedia para todas as placas ativas de uma empresa.
 *
 * Verifica:
 *   1. Placas sem documento PlateMedia (invisíveis para o proxy após migração)
 *   2. PlateMedia com activeKey null/vazio (proxy retornará 404)
 *   3. Placas com PlateMedia mas que ainda têm imagemPrincipal/imagem (candidatos de limpeza)
 *   4. Resumo agregado por empresa
 *
 * Uso:
 *   npx ts-node scripts/audit-plate-media-consistency.ts
 *   npx ts-node scripts/audit-plate-media-consistency.ts --empresaId=<id>
 *   npx ts-node scripts/audit-plate-media-consistency.ts --output=report.json
 *
 * O R2 key check (existência real do arquivo) é opt-in via --checkR2
 * pois gera N HeadObject calls ao bucket — use com moderação em produção.
 */

import * as path from 'path';
import { config } from 'dotenv';
config({ path: path.resolve(__dirname, '../.env') });

import mongoose, { Types } from 'mongoose';
import PlateMedia from '../src/modules/media/PlateMedia';
import Placa from '../src/modules/placas/Placa';
import fs from 'fs';

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [k, v] = arg.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);

const TARGET_EMPRESA_ID: string | null = typeof args.empresaId === 'string' ? args.empresaId : null;
const OUTPUT_FILE: string | null = typeof args.output === 'string' ? args.output : null;
const CHECK_R2 = args.checkR2 === true || args.checkR2 === 'true';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PlateAuditRecord {
  plateId: string;
  empresaId: string;
  numero_placa: string | null;
  issues: string[];
  hasPlateMedia: boolean;
  activeKey: string | null;
  plateMediaStatus: string | null;
  legacyKey: string | null;
  hasLegacyImagemPrincipal: boolean;
  hasLegacyImagem: boolean;
  hasLegacyImagens: boolean;
  r2KeyExists?: boolean | null;
}

interface AuditReport {
  generatedAt: string;
  targetEmpresaId: string | null;
  totalPlates: number;
  totalWithPlateMedia: number;
  totalWithoutPlateMedia: number;
  totalWithActiveKey: number;
  totalWithoutActiveKey: number;
  totalMissingCanonical: number;
  totalMissingInvalid: number;
  totalBrokenR2: number;
  totalLegacyDivergesFromPlateMedia: number;
  totalWithLegacyFields: number;
  records: PlateAuditRecord[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function checkR2KeyExists(r2Key: string): Promise<boolean> {
  try {
    const { getR2Client, getR2BucketName } = await import('../src/shared/infra/storage/r2-client');
    const { HeadObjectCommand } = await import('@aws-sdk/client-s3');
    const client = getR2Client();
    const bucket = getR2BucketName();
    if (!client || !bucket) return false;
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: r2Key }));
    return true;
  } catch {
    return false;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  const mongoUri =
    process.env.MONGODB_URI ??
    process.env.MONGO_URI ??
    process.env.DATABASE_URL ??
    '';
  if (!mongoUri) {
    console.error('[AUDIT] MONGODB_URI / MONGO_URI / DATABASE_URL não configurado.');
    process.exit(1);
  }

  console.log('[AUDIT] Conectando ao MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('[AUDIT] Conectado.');

  const placaQuery: Record<string, unknown> = { statusOperacional: { $ne: 'ARCHIVED' } };
  if (TARGET_EMPRESA_ID && Types.ObjectId.isValid(TARGET_EMPRESA_ID)) {
    placaQuery.empresaId = new Types.ObjectId(TARGET_EMPRESA_ID);
  }

  const placas = await Placa.find(placaQuery)
    .select('_id empresaId numero_placa imagemPrincipal imagem imagens')
    .lean();

  console.log(`[AUDIT] ${placas.length} placa(s) encontrada(s).`);

  const plateIds = placas.map((p: any) => new Types.ObjectId(p._id));
  const plateMediDocs = await PlateMedia.find({ plateId: { $in: plateIds } }).lean();
  const plateMediaMap = new Map(plateMediDocs.map((pm: any) => [String(pm.plateId), pm]));

  const records: PlateAuditRecord[] = [];

  for (const placa of placas as any[]) {
    const id = String(placa._id);
    const pm = plateMediaMap.get(id);
    const issues: string[] = [];

    const hasPlateMedia = !!pm;
    const activeKey: string | null = pm?.activeKey ?? null;
    const hasLegacyImagemPrincipal = typeof placa.imagemPrincipal === 'string' && placa.imagemPrincipal.trim().length > 0;
    const hasLegacyImagem = typeof placa.imagem === 'string' && placa.imagem.trim().length > 0;
    const hasLegacyImagens = Array.isArray(placa.imagens) && placa.imagens.length > 0;

    if (!hasPlateMedia) {
      issues.push('NO_PLATE_MEDIA');
      if (hasLegacyImagemPrincipal || hasLegacyImagem || hasLegacyImagens) {
        issues.push('HAS_LEGACY_FIELDS_NO_MIGRATION');
      }
    } else if (!activeKey) {
      // activeKey null + status 'missing' = OK_CANONICAL_NO_IMAGE (placa sem foto intencionalmente)
      if (pm.status !== 'missing') {
        issues.push('MISSING_INVALID');
      }
    }

    if (hasLegacyImagemPrincipal) issues.push('LEGACY_IMAGEM_PRINCIPAL');
    if (hasLegacyImagem) issues.push('LEGACY_IMAGEM');

    // Cenário E: PlateMedia existe mas activeKey diverge do campo legado
    if (hasPlateMedia && activeKey && hasLegacyImagemPrincipal) {
      if ((placa.imagemPrincipal as string).trim() !== activeKey) {
        issues.push('LEGACY_DIVERGES_FROM_PLATE_MEDIA');
      }
    }

    let r2KeyExists: boolean | null | undefined = undefined;
    if (CHECK_R2 && activeKey) {
      r2KeyExists = await checkR2KeyExists(activeKey);
      if (!r2KeyExists) issues.push('R2_KEY_NOT_FOUND');
    }

    records.push({
      plateId: id,
      empresaId: String(placa.empresaId),
      numero_placa: placa.numero_placa ?? null,
      issues,
      hasPlateMedia,
      activeKey,
      plateMediaStatus: pm?.status ?? null,
      legacyKey: hasLegacyImagemPrincipal ? (placa.imagemPrincipal as string).trim() : null,
      hasLegacyImagemPrincipal,
      hasLegacyImagem,
      hasLegacyImagens,
      ...(CHECK_R2 ? { r2KeyExists: r2KeyExists ?? null } : {}),
    });
  }

  const report: AuditReport = {
    generatedAt: new Date().toISOString(),
    targetEmpresaId: TARGET_EMPRESA_ID,
    totalPlates: records.length,
    totalWithPlateMedia: records.filter((r) => r.hasPlateMedia).length,
    totalWithoutPlateMedia: records.filter((r) => !r.hasPlateMedia).length,
    totalWithActiveKey: records.filter((r) => !!r.activeKey).length,
    totalWithoutActiveKey: records.filter((r) => !r.activeKey).length,
    totalMissingCanonical: records.filter((r) => r.hasPlateMedia && !r.activeKey && r.plateMediaStatus === 'missing').length,
    totalMissingInvalid: records.filter((r) => r.issues.includes('MISSING_INVALID')).length,
    totalBrokenR2: records.filter((r) => r.issues.includes('R2_KEY_NOT_FOUND')).length,
    totalLegacyDivergesFromPlateMedia: records.filter((r) => r.issues.includes('LEGACY_DIVERGES_FROM_PLATE_MEDIA')).length,
    totalWithLegacyFields: records.filter((r) => r.hasLegacyImagemPrincipal || r.hasLegacyImagem).length,
    records,
  };

  // ── Resumo no console ─────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════');
  console.log('  RELATÓRIO DE CONSISTÊNCIA PlateMedia');
  console.log('════════════════════════════════════════');
  console.log(`Total de placas:               ${report.totalPlates}`);
  console.log(`Com PlateMedia:                ${report.totalWithPlateMedia}`);
  console.log(`Sem PlateMedia:                ${report.totalWithoutPlateMedia}`);
  console.log(`Com activeKey:                 ${report.totalWithActiveKey}`);
  console.log(`Sem activeKey:                 ${report.totalWithoutActiveKey}`);
  console.log(`  ↳ missing canônico (OK):     ${report.totalMissingCanonical}`);
  console.log(`  ↳ missing inválido (BLOCK):  ${report.totalMissingInvalid}`);
  console.log(`R2 quebrado (BLOCK):           ${report.totalBrokenR2}`);
  console.log(`Legacy diverge (BLOCK):        ${report.totalLegacyDivergesFromPlateMedia}`);
  console.log(`Com campos legados (DB):       ${report.totalWithLegacyFields}`);

  if (report.totalMissingInvalid > 0) {
    console.log('\n🔴  MISSING_INVALID — activeKey nulo com status diferente de missing:');
    records
      .filter((r) => r.issues.includes('MISSING_INVALID'))
      .forEach((r) => console.log(`  • ${r.numero_placa ?? r.plateId} | status: "${r.plateMediaStatus}"`));
  }

  if (report.totalLegacyDivergesFromPlateMedia > 0) {
    console.log('\n🔴  LEGACY_DIVERGES_FROM_PLATE_MEDIA:');
    records
      .filter((r) => r.issues.includes('LEGACY_DIVERGES_FROM_PLATE_MEDIA'))
      .forEach((r) =>
        console.log(`  • ${r.numero_placa ?? r.plateId} | legado: "${r.legacyKey}" | activeKey: "${r.activeKey}"`),
      );
  }

  if (report.totalWithoutPlateMedia > 0) {
    console.log('\n🔴  PLACAS SEM PlateMedia (serão invisíveis no proxy):');
    records
      .filter((r) => !r.hasPlateMedia)
      .forEach((r) => console.log(`  • ${r.numero_placa ?? r.plateId} (${r.plateId})`));
  }

  if (CHECK_R2 && report.totalBrokenR2 > 0) {
    console.log('\n🔴  CHAVES R2 NÃO ENCONTRADAS:');
    records
      .filter((r) => r.issues.includes('R2_KEY_NOT_FOUND'))
      .forEach((r) => console.log(`  • ${r.numero_placa ?? r.plateId} → ${r.activeKey}`));
  }

  // ── Parecer final ─────────────────────────────────────────────────────────
  const blockers =
    report.totalWithoutPlateMedia +
    report.totalMissingInvalid +
    report.totalBrokenR2 +
    report.totalLegacyDivergesFromPlateMedia;

  console.log('\n════════════════════════════════════════');
  if (blockers === 0) {
    console.log('  ✅  PRONTO PARA PREPARAR REMOÇÃO LEGACY');
  } else {
    console.log(`  ❌  AINDA BLOQUEADO — ${blockers} problema(s) encontrado(s)`);
  }
  console.log('════════════════════════════════════════\n');

  // ── Output file ──────────────────────────────────────────────────────────
  if (OUTPUT_FILE) {
    const outPath = path.resolve(OUTPUT_FILE);
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`✅ Relatório salvo em: ${outPath}`);
  }

  await mongoose.disconnect();
  console.log('[AUDIT] Concluído.');

  if (blockers > 0) process.exit(1);
}

run().catch((err) => {
  console.error('[AUDIT] Erro fatal:', err);
  process.exit(1);
});
