/**
 * remove-legacy-plate-images.ts
 *
 * Remove definitivamente os campos de imagem legados dos documentos Placa:
 *   - imagemPrincipal
 *   - imagem
 *
 * PRÉ-REQUISITOS (obrigatórios antes de executar):
 *   1. Executar audit-plate-media-consistency.ts e verificar que:
 *      - totalWithoutPlateMedia = 0
 *      - totalWithoutActiveKey = 0  (ou aceitável)
 *   2. Executar migrate-plate-media.ts para popular PlateMedia de todas as placas
 *   3. Validar que o proxy público responde corretamente com a nova arquitetura
 *
 * O script opera em modo DRY-RUN por padrão — use --force para aplicar.
 *
 * Uso:
 *   npx ts-node scripts/remove-legacy-plate-images.ts                        # dry-run
 *   npx ts-node scripts/remove-legacy-plate-images.ts --empresaId=<id>       # empresa específica
 *   npx ts-node scripts/remove-legacy-plate-images.ts --force                # aplica
 *   npx ts-node scripts/remove-legacy-plate-images.ts --force --batch=200    # batch size
 */

import * as path from 'path';
import { config } from 'dotenv';
config({ path: path.resolve(__dirname, '../.env') });

import mongoose, { Types } from 'mongoose';
import Placa from '../src/modules/placas/Placa';
import PlateMedia from '../src/modules/media/PlateMedia';

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [k, v] = arg.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);

const DRY_RUN = args.force !== true && args.force !== 'true';
const TARGET_EMPRESA_ID: string | null = typeof args.empresaId === 'string' ? args.empresaId : null;
const BATCH_SIZE = parseInt(typeof args.batch === 'string' ? args.batch : '100', 10) || 100;

// ── Main ──────────────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  const mongoUri =
    process.env.MONGODB_URI ??
    process.env.MONGO_URI ??
    process.env.DATABASE_URL ??
    '';
  if (!mongoUri) {
    console.error('[REMOVE-LEGACY] MONGODB_URI / MONGO_URI / DATABASE_URL não configurado.');
    process.exit(1);
  }

  if (DRY_RUN) {
    console.log('MODE: DRY_RUN — nenhuma alteração será aplicada.');
    console.log('Use --force para executar a remoção.');
    console.log('');
  } else {
    console.log('🔴 MODO FORCE — campos legados SERÃO removidos do banco.');
    console.log('   Certifique-se de que a auditoria foi executada e validada.');
    console.log('');
  }

  console.log('[REMOVE-LEGACY] Conectando ao MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('[REMOVE-LEGACY] Conectado.');

  // ── Pré-validação: bloqueia se houver placas sem PlateMedia ──────────────
  const placaQuery: Record<string, unknown> = { statusOperacional: { $ne: 'ARCHIVED' } };
  if (TARGET_EMPRESA_ID && Types.ObjectId.isValid(TARGET_EMPRESA_ID)) {
    placaQuery.empresaId = new Types.ObjectId(TARGET_EMPRESA_ID);
  }

  const activePlacaIds = await Placa.find(placaQuery).distinct('_id');
  const totalPlacas = activePlacaIds.length;
  const totalPlateMedia = await PlateMedia.countDocuments({
    plateId: { $in: activePlacaIds },
  });

  console.log(`[REMOVE-LEGACY] Placas ativas: ${totalPlacas}`);
  console.log(`[REMOVE-LEGACY] Documentos PlateMedia (cobertura exata): ${totalPlateMedia}`);

  if (!DRY_RUN && totalPlateMedia < totalPlacas) {
    const faltando = totalPlacas - totalPlateMedia;
    console.error(`\n🔴 BLOQUEADO: ${faltando} placa(s) ativa(s) sem PlateMedia correspondente.`);
    console.error('   Execute migrate-plate-media.ts antes de remover campos legados.');
    await mongoose.disconnect();
    process.exit(1);
  }

  // ── Identifica placas com campos legados ──────────────────────────────────
  const legacyQuery: Record<string, unknown> = {
    ...placaQuery,
    $or: [
      { imagemPrincipal: { $exists: true, $nin: [null, ''] } },
      { imagem: { $exists: true, $nin: [null, ''] } },
    ],
  };

  const totalWithLegacy = await Placa.countDocuments(legacyQuery);
  console.log(`[REMOVE-LEGACY] Placas com campos legados: ${totalWithLegacy}`);

  if (totalWithLegacy === 0) {
    console.log('\n✅ Nenhum campo legado encontrado. Base já está limpa.');
    await mongoose.disconnect();
    return;
  }

  if (DRY_RUN) {
    console.log('\n════════════════════════════════════════');
    console.log('  DRY-RUN — SIMULAÇÃO DE REMOÇÃO LEGACY');
    console.log('════════════════════════════════════════');
    console.log(`Campos que seriam removidos: imagemPrincipal, imagem`);
    console.log(`Documentos afetados:         ${totalWithLegacy}`);

    const sample = await Placa.find(legacyQuery)
      .select('_id numero_placa imagemPrincipal imagem')
      .limit(10)
      .lean();
    console.log(`\nAmostra (até 10 placas):`);
    for (const p of sample as any[]) {
      const fields: string[] = [];
      if (p.imagemPrincipal) fields.push(`imagemPrincipal: "${(p.imagemPrincipal as string).slice(0, 60)}"`);
      if (p.imagem)          fields.push(`imagem: "${(p.imagem as string).slice(0, 60)}"`);
      console.log(`  • ${p.numero_placa ?? p._id} | ${fields.join(' | ')}`);
    }

    if (totalWithLegacy > sample.length) {
      console.log(`  ... e mais ${totalWithLegacy - sample.length} placa(s).`);
    }

    console.log('\n✅ Dry-run concluído. Nenhuma alteração foi feita.');
    await mongoose.disconnect();
    return;
  }

  // ── Remove em batches ────────────────────────────────────────────────────
  let processed = 0;
  let errors = 0;

  while (true) {
    const batch = await Placa.find(legacyQuery).select('_id').limit(BATCH_SIZE).lean();
    if (batch.length === 0) break;

    const ids = batch.map((p: any) => p._id);
    try {
      const result = await Placa.updateMany(
        { _id: { $in: ids } },
        { $unset: { imagemPrincipal: '', imagem: '' } },
      );
      processed += result.modifiedCount;
      console.log(`[REMOVE-LEGACY] Batch: ${result.modifiedCount} atualizados (total: ${processed})`);
    } catch (err) {
      errors++;
      console.error(`[REMOVE-LEGACY] Erro no batch:`, err);
    }
  }

  console.log('\n════════════════════════════════════════');
  console.log('  REMOÇÃO CONCLUÍDA');
  console.log('════════════════════════════════════════');
  console.log(`Placas atualizadas: ${processed}`);
  console.log(`Erros:              ${errors}`);

  if (errors > 0) {
    console.warn('\n⚠️  Alguns batches falharam. Execute o audit para verificar o estado final.');
  } else {
    console.log('\n✅ Campos imagemPrincipal e imagem removidos com sucesso.');
  }

  await mongoose.disconnect();
  console.log('[REMOVE-LEGACY] Concluído.');
}

run().catch((err) => {
  console.error('[REMOVE-LEGACY] Erro fatal:', err);
  process.exit(1);
});
