#!/usr/bin/env ts-node
/**
 * reconcile-regiao-field-sync.ts
 *
 * Sprint 0 — Integridade de Dados (item 5 da AUDITORIA_INTEGRIDADE_DADOS_FASE4.md)
 *
 * Campo canonico = EN (name, code, description, status). Para cada Regiao:
 *   - Se name/code/description/status estiverem ausentes/vazios, deriva-os a
 *     partir dos campos legados (nome/codigo/descricao/ativo), seguindo a
 *     mesma regra do hook pre('validate') em regiao.schema.ts:129-140
 *     (code = normalizeCode(code || codigo || name || nome)).
 *   - Recalcula o PT esperado a partir do EN (efetivo): nome=name,
 *     codigo=code, descricao=description, ativo = status === 'ACTIVE'
 *     (ARCHIVED/INACTIVE -> false).
 *   - Reporta divergencias entre os valores atuais e os esperados.
 *
 * Dry-run por padrao. Apenas com --fix os documentos divergentes sao
 * persistidos (updateOne por _id + empresaId, idempotente).
 *
 * Uso:
 *   ts-node scripts/reconcile-regiao-field-sync.ts                  # dry-run
 *   ts-node scripts/reconcile-regiao-field-sync.ts --fix            # aplica correcoes
 *   ts-node scripts/reconcile-regiao-field-sync.ts --empresa=<id>   # filtra por empresa
 *   ts-node scripts/reconcile-regiao-field-sync.ts --limit=100      # limita docs analisados
 */

import 'dotenv/config';
import mongoose, { Types } from 'mongoose';
import Regiao from '@modules/regioes/Regiao';

const SYNCED_FIELDS = ['name', 'nome', 'code', 'codigo', 'description', 'descricao', 'status', 'ativo'] as const;
type SyncedField = (typeof SYNCED_FIELDS)[number];

export interface RegiaoFieldSyncDivergence {
  _id: string;
  empresaId: string;
  before: Partial<Record<SyncedField, unknown>>;
  after: Partial<Record<SyncedField, unknown>>;
}

export interface ReconcileRegiaoFieldSyncReport {
  totalAnalyzed: number;
  divergent: number;
  fixed: number;
  errors: number;
  divergences: RegiaoFieldSyncDivergence[];
}

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  return false;
}

function normalizeCode(value: unknown): string {
  return String(value).trim().toUpperCase().replace(/\s+/g, '-');
}

/**
 * Compara o documento atual com os valores esperados (EN canonico, PT
 * derivado do EN) e retorna apenas os campos que divergem (before/after),
 * ou null se nao houver divergencia.
 */
export function diffRegiaoFieldSync(doc: Record<string, unknown>): RegiaoFieldSyncDivergence | null {
  // EN efetivo: usa o valor existente, ou deriva do PT (campo legado) se ausente/vazio.
  const effectiveName = !isEmpty(doc.name) ? String(doc.name) : (!isEmpty(doc.nome) ? String(doc.nome) : '');
  const effectiveDescription = !isEmpty(doc.description) ? doc.description : doc.descricao;
  const effectiveStatus = !isEmpty(doc.status)
    ? String(doc.status)
    : (doc.ativo === false ? 'INACTIVE' : 'ACTIVE');
  const effectiveCode = !isEmpty(doc.code)
    ? String(doc.code).trim()
    : normalizeCode(!isEmpty(doc.codigo) ? doc.codigo : effectiveName);

  const before: Partial<Record<SyncedField, unknown>> = {};
  const after: Partial<Record<SyncedField, unknown>> = {};

  function setIfDiff(field: SyncedField, currentValue: unknown, expectedValue: unknown) {
    if (!valuesEqual(currentValue, expectedValue)) {
      before[field] = currentValue ?? null;
      after[field] = expectedValue ?? null;
    }
  }

  // Campos EN: somente preenchidos quando ausentes/vazios (derivados do PT legado).
  if (isEmpty(doc.name) && !isEmpty(effectiveName)) setIfDiff('name', doc.name, effectiveName);
  if (isEmpty(doc.code) && !isEmpty(effectiveCode)) setIfDiff('code', doc.code, effectiveCode);
  if (isEmpty(doc.description) && !isEmpty(effectiveDescription)) setIfDiff('description', doc.description, effectiveDescription);
  if (isEmpty(doc.status)) setIfDiff('status', doc.status, effectiveStatus);

  // Campos PT: sempre derivados do EN efetivo (EN canonico).
  setIfDiff('nome', doc.nome, effectiveName);
  setIfDiff('codigo', doc.codigo, effectiveCode);
  setIfDiff('descricao', doc.descricao, effectiveDescription);
  setIfDiff('ativo', doc.ativo, effectiveStatus === 'ACTIVE');

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
 * Executa a reconciliacao. Le todas as Regioes (filtradas opcionalmente por
 * empresaId), calcula divergencias EN<->PT e, se options.fix for true,
 * aplica updateOne({_id, empresaId}, {$set: after}) por documento divergente.
 * Sem --fix nenhuma escrita e realizada.
 */
export async function reconcileRegiaoFieldSync(options: RunOptions = {}): Promise<ReconcileRegiaoFieldSyncReport> {
  const filter: Record<string, unknown> = {};
  if (options.empresaId) {
    filter.empresaId = new Types.ObjectId(options.empresaId);
  }

  const report: ReconcileRegiaoFieldSyncReport = {
    totalAnalyzed: 0,
    divergent: 0,
    fixed: 0,
    errors: 0,
    divergences: [],
  };

  let query = Regiao.find(filter).select([...SYNCED_FIELDS, 'empresaId'].join(' ')).lean();
  if (options.limit) query = query.limit(options.limit);

  const cursor = query.cursor();

  for await (const doc of cursor) {
    report.totalAnalyzed++;

    const divergence = diffRegiaoFieldSync(doc as Record<string, unknown>);
    if (!divergence) continue;

    report.divergent++;
    report.divergences.push(divergence);

    if (options.fix) {
      try {
        await Regiao.updateOne(
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

function printReport(report: ReconcileRegiaoFieldSyncReport, fixMode: boolean) {
  console.log('');
  console.log('── reconcile:regiao-field-sync ──');
  console.log(`Total analisado:  ${report.totalAnalyzed}`);
  console.log(`Divergentes:      ${report.divergent}`);
  console.log(`Corrigidos:       ${report.fixed}${fixMode ? '' : ' (dry-run, nenhuma escrita realizada)'}`);
  console.log(`Erros:            ${report.errors}`);

  if (report.divergences.length > 0) {
    console.log('');
    console.log('Divergencias encontradas:');
    for (const d of report.divergences) {
      console.log(`  - Regiao ${d._id} (empresa ${d.empresaId})`);
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
    const report = await reconcileRegiaoFieldSync(options);
    printReport(report, fix);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[reconcile-regiao-field-sync] erro fatal:', err);
    process.exit(1);
  });
}
