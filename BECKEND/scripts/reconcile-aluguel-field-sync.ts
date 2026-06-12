#!/usr/bin/env ts-node
/**
 * reconcile-aluguel-field-sync.ts
 *
 * Sprint 0 — Integridade de Dados (item 3 da AUDITORIA_INTEGRIDADE_DADOS_FASE4.md)
 *
 * Para cada Aluguel, recalcula os pares de campos novos (EN) <-> legados (PT)
 * (startDate <-> data_inicio, endDate <-> data_fim, biWeekIds <-> bi_week_ids)
 * usando syncAluguelFields() e reporta divergencias entre o documento atual
 * e o documento sincronizado.
 *
 * Dry-run por padrao. Apenas com --fix os documentos divergentes sao
 * persistidos (updateOne por _id + empresaId, idempotente).
 *
 * Uso:
 *   ts-node scripts/reconcile-aluguel-field-sync.ts                  # dry-run
 *   ts-node scripts/reconcile-aluguel-field-sync.ts --fix            # aplica correcoes
 *   ts-node scripts/reconcile-aluguel-field-sync.ts --empresa=<id>   # filtra por empresa
 *   ts-node scripts/reconcile-aluguel-field-sync.ts --limit=100      # limita docs analisados
 */

import 'dotenv/config';
import mongoose, { Types } from 'mongoose';
import Aluguel from '@modules/alugueis/Aluguel';
import { syncAluguelFields } from '@modules/alugueis/utils/aluguel-field-sync';

const SYNCED_FIELDS = ['startDate', 'endDate', 'data_inicio', 'data_fim', 'biWeekIds', 'bi_week_ids'] as const;
type SyncedField = (typeof SYNCED_FIELDS)[number];

export interface AluguelFieldSyncDivergence {
  _id: string;
  empresaId: string;
  before: Partial<Record<SyncedField, unknown>>;
  after: Partial<Record<SyncedField, unknown>>;
}

export interface ReconcileAluguelFieldSyncReport {
  totalAnalyzed: number;
  divergent: number;
  fixed: number;
  errors: number;
  divergences: AluguelFieldSyncDivergence[];
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a == b;

  const aDate = a instanceof Date ? a : (a as any)?.toISOString ? new Date(String(a)) : null;
  const bDate = b instanceof Date ? b : (b as any)?.toISOString ? new Date(String(b)) : null;
  if (aDate && bDate) return aDate.getTime() === bDate.getTime();

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => String(v) === String(b[i]));
  }

  return String(a) === String(b);
}

/**
 * Compara o documento atual com o resultado de syncAluguelFields() e retorna
 * apenas os campos que divergem (before/after), ou null se nao houver divergencia.
 */
export function diffAluguelFieldSync(doc: Record<string, unknown>): AluguelFieldSyncDivergence | null {
  const input: Partial<Record<SyncedField, unknown>> = {};
  for (const field of SYNCED_FIELDS) {
    if (doc[field] !== undefined && doc[field] !== null) {
      input[field] = doc[field];
    }
  }

  if (Object.keys(input).length === 0) return null;

  const synced = syncAluguelFields(input);

  const before: Partial<Record<SyncedField, unknown>> = {};
  const after: Partial<Record<SyncedField, unknown>> = {};

  for (const field of SYNCED_FIELDS) {
    if (!valuesEqual(doc[field], synced[field])) {
      before[field] = doc[field] ?? null;
      after[field] = synced[field] ?? null;
    }
  }

  if (Object.keys(after).length === 0) return null;

  return {
    _id: String(doc._id),
    empresaId: String(doc.empresaId),
    before,
    after,
  };
}

export interface RunOptions {
  fix?: boolean;
  empresaId?: string;
  limit?: number;
}

/**
 * Executa a reconciliacao. Le todos os Alugueis (filtrados opcionalmente por
 * empresaId), calcula divergencias de campo novo<->legado e, se options.fix
 * for true, aplica updateOne({_id, empresaId}, {$set: after}) por documento
 * divergente. Sem --fix nenhuma escrita e realizada.
 */
export async function reconcileAluguelFieldSync(options: RunOptions = {}): Promise<ReconcileAluguelFieldSyncReport> {
  const filter: Record<string, unknown> = {};
  if (options.empresaId) {
    filter.empresaId = new Types.ObjectId(options.empresaId);
  }

  const report: ReconcileAluguelFieldSyncReport = {
    totalAnalyzed: 0,
    divergent: 0,
    fixed: 0,
    errors: 0,
    divergences: [],
  };

  let query = Aluguel.find(filter).select([...SYNCED_FIELDS, 'empresaId'].join(' ')).lean();
  if (options.limit) query = query.limit(options.limit);

  const cursor = query.cursor();

  for await (const doc of cursor) {
    report.totalAnalyzed++;

    const divergence = diffAluguelFieldSync(doc as Record<string, unknown>);
    if (!divergence) continue;

    report.divergent++;
    report.divergences.push(divergence);

    if (options.fix) {
      try {
        await Aluguel.updateOne(
          { _id: doc._id, empresaId: (doc as any).empresaId },
          { $set: divergence.after },
        );
        report.fixed++;
      } catch {
        report.errors++;
      }
    }
  }

  return report;
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function printReport(report: ReconcileAluguelFieldSyncReport, fixMode: boolean) {
  console.log('');
  console.log('── reconcile:aluguel-field-sync ──');
  console.log(`Total analisado:  ${report.totalAnalyzed}`);
  console.log(`Divergentes:      ${report.divergent}`);
  console.log(`Corrigidos:       ${report.fixed}${fixMode ? '' : ' (dry-run, nenhuma escrita realizada)'}`);
  console.log(`Erros:            ${report.errors}`);

  if (report.divergences.length > 0) {
    console.log('');
    console.log('Divergencias encontradas:');
    for (const d of report.divergences) {
      console.log(`  - Aluguel ${d._id} (empresa ${d.empresaId})`);
      for (const field of Object.keys(d.after) as SyncedField[]) {
        console.log(`      ${field}: ${JSON.stringify(d.before[field])} -> ${JSON.stringify(d.after[field])}`);
      }
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const fix = args.includes('--fix');
  const empresaArg = args.find((a) => a.startsWith('--empresa='));
  const limitArg = args.find((a) => a.startsWith('--limit='));

  const options: RunOptions = {
    fix,
    empresaId: empresaArg ? empresaArg.split('=')[1] : undefined,
    limit: limitArg ? Math.max(1, parseInt(limitArg.split('=')[1]!, 10)) : undefined,
  };

  if (!fix) {
    console.log('MODO DRY-RUN — nenhuma alteracao sera feita no banco. Use --fix para aplicar correcoes.');
  } else {
    console.log('MODO --fix ATIVO — divergencias serao corrigidas no MongoDB.');
  }

  const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/inmidia';
  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 10_000 });

  try {
    const report = await reconcileAluguelFieldSync(options);
    printReport(report, fix);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[reconcile-aluguel-field-sync] erro fatal:', err);
    process.exit(1);
  });
}
