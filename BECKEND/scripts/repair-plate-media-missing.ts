#!/usr/bin/env ts-node
/**
 * repair-plate-media-missing.ts
 *
 * Corrige placas com estado PlateMedia inválido identificadas pela auditoria:
 *
 *   CASO 1 — Placa sem PlateMedia:
 *     Cria PlateMedia com activeKey=null, status='missing'.
 *     Não altera a Placa nem campos legados.
 *
 *   CASO 2 — PlateMedia com activeKey que não existe no R2:
 *     Limpa activeKey (→ null, status='missing').
 *     Move a key quebrada para history com isActive=false, source='repair'.
 *     Não deleta nada do R2.
 *
 * REGRAS DE SEGURANÇA:
 *   - Não altera campos da Placa
 *   - Não remove campos legados
 *   - Não deleta objetos do R2
 *   - Não sobrescreve activeKey válida (use --verifyR2 para confirmar antes de limpar)
 *   - $setOnInsert no Caso 1 garante idempotência
 *
 * USO:
 *   npx ts-node -r tsconfig-paths/register scripts/repair-plate-media-missing.ts --dry-run --plateIds=id1,id2
 *   npx ts-node -r tsconfig-paths/register scripts/repair-plate-media-missing.ts --fix --plateIds=id1,id2
 *   npx ts-node -r tsconfig-paths/register scripts/repair-plate-media-missing.ts --fix --verifyR2 --plateIds=id1,id2
 *
 * FLAGS:
 *   --dry-run     Simula sem persistir (padrão quando --fix ausente)
 *   --fix         Persiste as correções no MongoDB
 *   --plateIds=   IDs das placas alvo, separados por vírgula (obrigatório)
 *   --reason=     Motivo da correção (default: 'manual_repair'; aparece nos logs)
 *   --verifyR2    Re-verifica activeKey no R2 antes de limpar (pula se key ainda válida)
 *   --uri=        Override da URI do MongoDB
 *
 * RELATÓRIO (stdout JSON no final):
 *   { total, createdMissing, clearedBrokenKey, alreadyMissing, skippedValidKey, skippedNoPlate, errors, durationMs }
 *
 * @version 1.0.0
 */

// ─── Flag parsing (exportado para testes) ─────────────────────────────────────

export function parseRepairFlags(argv: string[]): {
  isDryRun:  boolean;
  verifyR2:  boolean;
  plateIds:  string[];
  reason:    string;
  mongoUri:  string;
} {
  const hasFix    = argv.includes('--fix');
  const hasDryRun = argv.includes('--dry-run');

  if (hasFix && hasDryRun) {
    throw new Error('CONFLICT: --fix e --dry-run não podem ser usados juntos');
  }

  const plateIdsRaw = argv.find(a => a.startsWith('--plateIds='))?.replace('--plateIds=', '') ?? '';
  const plateIds    = plateIdsRaw ? plateIdsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];

  return {
    isDryRun: hasDryRun || !hasFix,
    verifyR2: argv.includes('--verifyR2'),
    plateIds,
    reason:   argv.find(a => a.startsWith('--reason='))?.replace('--reason=', '') ?? 'manual_repair',
    mongoUri: argv.find(a => a.startsWith('--uri='))?.split('=')[1] ?? '',
  };
}

// ─── Tipos públicos (exportados para testes) ───────────────────────────────────

export interface RepairReport {
  total:            number;
  createdMissing:   number;
  clearedBrokenKey: number;
  alreadyMissing:   number;
  skippedValidKey:  number;
  skippedNoPlate:   number;
  errors:           Array<{ plateId: string; reason: string }>;
  durationMs:       number;
}

export interface RepairPlateOpts {
  isDryRun:                boolean;
  verifyR2:                boolean;
  reason:                  string;
  getPlaca:                (id: string) => Promise<{ _id: string; empresaId: string; numero_placa?: string } | null>;
  getPlateMedia:           (plateId: string) => Promise<{ activeKey: string | null; mimeType?: string | null; size?: number | null } | null>;
  checkR2:                 (key: string) => Promise<boolean>;
  createMissingPlateMedia: (plateId: string, empresaId: string) => Promise<void>;
  clearBrokenKey:          (plateId: string, brokenKey: string, mimeType: string | null, size: number | null) => Promise<void>;
}

// ─── Core logic (exportado para testes) ──────────────────────────────────────

export async function repairPlate(
  plateId: string,
  opts:    RepairPlateOpts,
): Promise<{
  action: 'createdMissing' | 'clearedBrokenKey' | 'alreadyMissing' | 'skippedValidKey' | 'skippedNoPlate' | 'error';
  reason?: string;
}> {
  const { Types } = await import('mongoose');

  if (!Types.ObjectId.isValid(plateId)) {
    return { action: 'error', reason: 'invalid_objectid' };
  }

  const placa = await opts.getPlaca(plateId);
  if (!placa) return { action: 'skippedNoPlate' };

  const pm = await opts.getPlateMedia(plateId);

  // CASO 1 — sem PlateMedia: criar como missing
  if (!pm) {
    if (!opts.isDryRun) {
      if (!Types.ObjectId.isValid(String(placa.empresaId))) {
        return { action: 'error', reason: 'empresaId_invalid' };
      }
      await opts.createMissingPlateMedia(plateId, String(placa.empresaId));
    }
    return { action: 'createdMissing' };
  }

  // CASO 2 — PlateMedia já missing (activeKey nulo ou vazio)
  if (!pm.activeKey) return { action: 'alreadyMissing' };

  // CASO 3 — PlateMedia tem activeKey
  if (opts.verifyR2) {
    const valid = await opts.checkR2(pm.activeKey);
    if (valid) return { action: 'skippedValidKey' };
  }

  if (!opts.isDryRun) {
    await opts.clearBrokenKey(plateId, pm.activeKey, pm.mimeType ?? null, pm.size ?? null);
  }
  return { action: 'clearedBrokenKey' };
}

// ─── Execução como script (nunca executa quando importado) ───────────────────

if (require.main === module) {
  void (async () => {
    // Imports pesados só quando rodando como script
    const pathMod     = await import('path');
    const { config }  = await import('dotenv');
    config({ path: pathMod.resolve(__dirname, '../.env') });

    const mongoose                           = (await import('mongoose')).default;
    const { Types }                          = await import('mongoose');
    const { placaSchema }                    = await import('../src/database/schemas/placa.schema');
    const { plateMediaSchema }               = await import('../src/database/schemas/plateMedia.schema');
    const { getR2Client, getR2BucketName }   = await import('../src/shared/infra/storage/r2-client');
    const { HeadObjectCommand }              = await import('@aws-sdk/client-s3');

    // Validar flags
    let flags: ReturnType<typeof parseRepairFlags>;
    try {
      flags = parseRepairFlags(process.argv);
    } catch (err) {
      console.error(`[repair] ERRO: ${(err as Error).message}`);
      console.error('  Use --dry-run para simular, ou --fix para aplicar. Nunca os dois.');
      process.exit(1);
    }

    const { isDryRun, verifyR2, plateIds, reason } = flags;
    const MONGO_URI = flags.mongoUri || process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/inmidia';

    if (plateIds.length === 0) {
      console.error('[repair] ERRO: --plateIds é obrigatório. Exemplo: --plateIds=id1,id2,id3');
      process.exit(1);
    }

    console.log(`[repair] MODE: ${isDryRun ? 'DRY_RUN' : 'FIX'}`);
    console.log(`[repair] Placas alvo (${plateIds.length}): ${plateIds.join(', ')}`);
    console.log(`[repair] Motivo: ${reason}`);
    if (isDryRun)  console.log('[repair] Nenhum dado será alterado. Use --fix para aplicar.');
    if (verifyR2)  console.log('[repair] Verificação R2 ATIVA (--verifyR2).');

    const Placa     = (mongoose.models.Placa     || mongoose.model('Placa',     placaSchema))     as any;
    const PlateMedia = (mongoose.models.PlateMedia || mongoose.model('PlateMedia', plateMediaSchema)) as any;

    async function checkR2(r2Key: string): Promise<boolean> {
      try {
        const client = getR2Client();
        const bucket = getR2BucketName();
        if (!client || !bucket) return false;
        await client.send(new HeadObjectCommand({ Bucket: bucket, Key: r2Key }));
        return true;
      } catch { return false; }
    }

    const t0 = Date.now();
    console.log(`[repair] Conectando a ${MONGO_URI.replace(/:[^@]+@/, ':***@')} ...`);
    await mongoose.connect(MONGO_URI);
    console.log('[repair] Conectado.');

    const report: RepairReport = {
      total: 0, createdMissing: 0, clearedBrokenKey: 0,
      alreadyMissing: 0, skippedValidKey: 0, skippedNoPlate: 0,
      errors: [], durationMs: 0,
    };

    const opts: RepairPlateOpts = {
      isDryRun,
      verifyR2,
      reason,

      getPlaca: (id) =>
        Placa.findById(id).select('_id empresaId numero_placa').lean(),

      getPlateMedia: (id) =>
        PlateMedia.findOne({ plateId: new Types.ObjectId(id) }).lean(),

      checkR2,

      createMissingPlateMedia: async (id, empresaId) => {
        await PlateMedia.findOneAndUpdate(
          { plateId: new Types.ObjectId(id) },
          {
            $setOnInsert: {
              plateId:   new Types.ObjectId(id),
              empresaId: new Types.ObjectId(empresaId),
              activeKey: null,
              status:    'missing',
              version:   String(Date.now()),
              mimeType:  null,
              size:      null,
              width:     null,
              height:    null,
              history:   [],
            },
          },
          { upsert: true },
        );
      },

      clearBrokenKey: async (id, brokenKey, mimeType, size) => {
        await PlateMedia.findOneAndUpdate(
          { plateId: new Types.ObjectId(id) },
          {
            $set: {
              activeKey: null,
              status:    'missing',
              version:   String(Date.now()),
            },
            $push: {
              history: {
                $each: [{
                  key:        brokenKey,
                  mimeType:   mimeType,
                  size:       size,
                  uploadedAt: new Date(),
                  isActive:   false,
                  source:     'repair',
                }],
                $position: 0,
                $slice:    50,
              },
            },
          },
          { upsert: false },
        );
      },
    };

    for (const rawId of plateIds) {
      report.total += 1;
      const pid = rawId.trim();

      try {
        const result = await repairPlate(pid, opts);

        switch (result.action) {
          case 'createdMissing':
            console.log(`[repair] ✓ [CREATED_MISSING]    ${pid}`);
            report.createdMissing += 1;
            break;
          case 'clearedBrokenKey':
            console.log(`[repair] ✓ [CLEARED_BROKEN_KEY] ${pid}`);
            report.clearedBrokenKey += 1;
            break;
          case 'alreadyMissing':
            console.log(`[repair]   [ALREADY_MISSING]    ${pid}`);
            report.alreadyMissing += 1;
            break;
          case 'skippedValidKey':
            console.log(`[repair]   [SKIPPED_VALID_KEY]  ${pid} — activeKey válida no R2, ignorada`);
            report.skippedValidKey += 1;
            break;
          case 'skippedNoPlate':
            console.warn(`[repair] ⚠ [PLATE_NOT_FOUND]    ${pid}`);
            report.skippedNoPlate += 1;
            break;
          case 'error':
            report.errors.push({ plateId: pid, reason: result.reason ?? 'unknown' });
            break;
        }
      } catch (err) {
        report.errors.push({
          plateId: pid,
          reason:  err instanceof Error ? err.message : String(err),
        });
      }
    }

    await mongoose.disconnect();
    report.durationMs = Date.now() - t0;

    console.log('\n[repair] RELATÓRIO FINAL:');
    console.log(JSON.stringify(report, null, 2));

    if (isDryRun) {
      console.log('\n→ DRY-RUN: nenhum dado foi alterado. Execute com --fix para aplicar.');
    } else {
      const ok = report.createdMissing + report.clearedBrokenKey;
      console.log(`\n→ ${ok} placa(s) corrigida(s): ${report.createdMissing} criadas, ${report.clearedBrokenKey} limpas.`);
      if (report.errors.length > 0) {
        console.error(`→ ${report.errors.length} erro(s). Veja o relatório acima.`);
        process.exit(1);
      }
    }
  })().catch(err => {
    console.error('[repair] ERRO FATAL:', err);
    process.exit(1);
  });
}
