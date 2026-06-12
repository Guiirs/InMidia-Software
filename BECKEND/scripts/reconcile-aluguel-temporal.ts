#!/usr/bin/env ts-node
/**
 * reconcile-aluguel-temporal.ts
 *
 * Sprint 0 — Integridade de Dados (item 4 da AUDITORIA_INTEGRIDADE_DADOS_FASE4.md)
 *
 * Para cada Aluguel ativo (status === 'ativo') com startDate/endDate validos,
 * verifica se existe a TemporalReservation correspondente
 * ({ empresaId, sourceType: 'LEGACY_RENTAL', sourceId: String(aluguel._id) }):
 *
 *   - MISSING_RESERVATION         — nenhuma reserva encontrada.
 *       --fix: cria a reserva, mas apenas se a placa estiver disponivel
 *       (temporalEngine.checkPlateAvailability). Se houver conflito real,
 *       reporta CONFLICT e NAO cria.
 *   - DATE_MISMATCH                — reserva existe mas startDate/endDate
 *       divergem do Aluguel (fonte de verdade = Aluguel).
 *       --fix: atualiza startDate/endDate da reserva.
 *   - TENANT_OR_PLATE_MISMATCH      — reserva existe mas empresaId ou plateId
 *       divergem do Aluguel. Apenas relatorio — nunca corrige automaticamente
 *       (indica corrupcao, requer revisao manual).
 *   - DUPLICATE                     — multiplas reservations LEGACY_RENTAL
 *       para o mesmo Aluguel. Apenas relatorio — nunca remove.
 *   - ORPHAN_ALUGUEL_PLACA_NOT_FOUND       — aluguel.placaId nao corresponde a
 *       nenhuma Placa existente (referencia quebrada/dangling). Apenas
 *       relatorio — NUNCA cria TemporalReservation; requer correcao manual
 *       do placaId (ou do registro de Placa).
 *   - ORPHAN_ALUGUEL_PLACA_TENANT_MISMATCH — aluguel.placaId aponta para uma
 *       Placa que existe, mas pertence a outra empresaId. Apenas relatorio —
 *       NUNCA cria TemporalReservation.
 *   - ORPHAN_ALUGUEL_PLACA_FIELD_MISSING   — aluguel ativo sem placaId valido
 *       (campo ausente ou nao e um ObjectId valido). So e reportado com
 *       --include-orphans (esses alugueis nao entram no fluxo normal de
 *       reconciliacao, pois nao ha placa para checar disponibilidade).
 *
 * Dry-run por padrao. Idempotente e tenant-safe (filtra por empresaId quando
 * --empresa=<id> e informado; toda escrita usa o empresaId do proprio Aluguel).
 *
 * Para qualquer Aluguel cuja Placa nao exista ou pertenca a outra empresa,
 * o script NUNCA chama temporalEngine.createTemporalReservation — apenas
 * reporta o problema para correcao manual (ver tipos ORPHAN_* acima).
 *
 * Uso:
 *   ts-node scripts/reconcile-aluguel-temporal.ts                     # dry-run
 *   ts-node scripts/reconcile-aluguel-temporal.ts --fix               # aplica correcoes
 *   ts-node scripts/reconcile-aluguel-temporal.ts --empresa=<id>      # filtra por empresa
 *   ts-node scripts/reconcile-aluguel-temporal.ts --limit=100         # limita docs analisados
 *   ts-node scripts/reconcile-aluguel-temporal.ts --include-orphans   # tambem reporta
 *                                                                      # alugueis ativos sem placaId valido
 */

import 'dotenv/config';
import mongoose, { Types } from 'mongoose';
import Aluguel from '@modules/alugueis/Aluguel';
import Placa from '@modules/placas/Placa';
import { TemporalReservation, temporalEngine } from '@modules/temporal';

export type AluguelTemporalIssueType =
  | 'MISSING_RESERVATION'
  | 'CONFLICT'
  | 'DATE_MISMATCH'
  | 'TENANT_OR_PLATE_MISMATCH'
  | 'DUPLICATE'
  | 'ORPHAN_ALUGUEL_PLACA_NOT_FOUND'
  | 'ORPHAN_ALUGUEL_PLACA_TENANT_MISMATCH'
  | 'ORPHAN_ALUGUEL_PLACA_FIELD_MISSING';

export interface AluguelTemporalIssue {
  type: AluguelTemporalIssueType;
  aluguelId: string;
  empresaId: string;
  plateId: string | null;
  details: string;
  reservationIds?: string[];
}

export interface ReconcileAluguelTemporalReport {
  totalAnalyzed: number;
  issues: AluguelTemporalIssue[];
  missingReservations: number;
  conflicts: number;
  dateMismatches: number;
  tenantOrPlateMismatches: number;
  duplicates: number;
  fixed: number;
  errors: number;
  orphanPlacaNotFound: number;
  orphanPlacaTenantMismatch: number;
  orphanPlacaFieldMissing: number;
}

function emptyReport(): ReconcileAluguelTemporalReport {
  return {
    totalAnalyzed: 0,
    issues: [],
    missingReservations: 0,
    conflicts: 0,
    dateMismatches: 0,
    tenantOrPlateMismatches: 0,
    duplicates: 0,
    fixed: 0,
    errors: 0,
    orphanPlacaNotFound: 0,
    orphanPlacaTenantMismatch: 0,
    orphanPlacaFieldMissing: 0,
  };
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function sameDate(a: Date, b: Date): boolean {
  return a.getTime() === b.getTime();
}

export interface RunOptions {
  fix?: boolean;
  empresaId?: string;
  limit?: number;
  includeOrphans?: boolean;
}

/**
 * Executa a reconciliacao Aluguel <-> TemporalReservation(LEGACY_RENTAL).
 * Sem options.fix nenhuma escrita e realizada.
 */
export async function reconcileAluguelTemporal(options: RunOptions = {}): Promise<ReconcileAluguelTemporalReport> {
  const filter: Record<string, unknown> = { status: 'ativo' };
  if (options.empresaId) {
    filter.empresaId = new Types.ObjectId(options.empresaId);
  }

  const report = emptyReport();

  let query = Aluguel.find(filter)
    .select('_id empresaId placaId placa startDate endDate data_inicio data_fim status')
    .lean();
  if (options.limit) query = query.limit(options.limit);

  const cursor = query.cursor();

  for await (const aluguel of cursor) {
    const aluguelId = String(aluguel._id);
    const empresaId = String((aluguel as any).empresaId);

    const startDate = toDate((aluguel as any).startDate ?? (aluguel as any).data_inicio);
    const endDate = toDate((aluguel as any).endDate ?? (aluguel as any).data_fim);
    const rawPlateId = (aluguel as any).placaId ?? (aluguel as any).placa;
    const plateIdStr = rawPlateId && Types.ObjectId.isValid(String(rawPlateId)) ? String(rawPlateId) : null;

    if (!plateIdStr) {
      if (options.includeOrphans) {
        report.orphanPlacaFieldMissing++;
        report.issues.push({
          type: 'ORPHAN_ALUGUEL_PLACA_FIELD_MISSING',
          aluguelId,
          empresaId,
          plateId: null,
          details: 'Aluguel ativo sem placaId valido (campo ausente ou nao e ObjectId) — fora do fluxo de reconciliacao com TemporalReservation.',
        });
      }
      continue;
    }

    if (!startDate || !endDate) continue;

    // Verifica se a Placa referenciada existe e pertence a mesma empresa
    // ANTES de qualquer tentativa de criar TemporalReservation. Se a placa
    // nao existir ou pertencer a outra empresa, apenas reporta — nunca
    // cria reserva (TemporalEngine.createTemporalReservation rejeitaria
    // com 404, mas chegar la significa um efeito colateral desnecessario
    // e um erro generico no relatorio).
    const placa = await Placa.findById(plateIdStr).select('_id empresaId').lean();

    if (!placa) {
      report.orphanPlacaNotFound++;
      report.issues.push({
        type: 'ORPHAN_ALUGUEL_PLACA_NOT_FOUND',
        aluguelId,
        empresaId,
        plateId: plateIdStr,
        details: `Placa ${plateIdStr} referenciada por aluguel.placaId nao existe na colecao 'placas'. Correcao manual necessaria (placaId invalido ou Placa removida).`,
      });
      continue;
    }

    const placaEmpresaId = String((placa as any).empresaId);
    if (placaEmpresaId !== empresaId) {
      report.orphanPlacaTenantMismatch++;
      report.issues.push({
        type: 'ORPHAN_ALUGUEL_PLACA_TENANT_MISMATCH',
        aluguelId,
        empresaId,
        plateId: plateIdStr,
        details: `Placa ${plateIdStr} pertence a empresaId=${placaEmpresaId}, mas o Aluguel pertence a empresaId=${empresaId}. Correcao manual necessaria.`,
      });
      continue;
    }

    report.totalAnalyzed++;

    const reservations = await TemporalReservation.find({
      empresaId,
      sourceType: 'LEGACY_RENTAL',
      sourceId: aluguelId,
    }).lean();

    if (reservations.length === 0) {
      if (options.fix) {
        const availability = await temporalEngine.checkPlateAvailability(
          plateIdStr,
          startDate,
          endDate,
          { empresaId },
        );

        if (!availability.available) {
          report.conflicts++;
          report.issues.push({
            type: 'CONFLICT',
            aluguelId,
            empresaId,
            plateId: plateIdStr,
            details: availability.conflicts[0]?.message || 'Conflito temporal — reserva nao criada.',
          });
          continue;
        }

        try {
          await temporalEngine.createTemporalReservation({
            empresaId,
            plateId: plateIdStr,
            sourceType: 'LEGACY_RENTAL',
            sourceId: aluguelId,
            startDate,
            endDate,
            status: 'ACTIVE',
            reason: `Reconciliacao: TemporalReservation ausente para Aluguel ${aluguelId}`,
          });
          report.fixed++;
        } catch (error) {
          report.errors++;
          report.issues.push({
            type: 'MISSING_RESERVATION',
            aluguelId,
            empresaId,
            plateId: plateIdStr,
            details: `Erro ao criar reserva: ${error instanceof Error ? error.message : String(error)}`,
          });
          continue;
        }
      }

      report.missingReservations++;
      report.issues.push({
        type: 'MISSING_RESERVATION',
        aluguelId,
        empresaId,
        plateId: plateIdStr,
        details: 'Nenhuma TemporalReservation LEGACY_RENTAL encontrada para este Aluguel.',
      });
      continue;
    }

    if (reservations.length > 1) {
      report.duplicates++;
      report.issues.push({
        type: 'DUPLICATE',
        aluguelId,
        empresaId,
        plateId: plateIdStr,
        details: `${reservations.length} TemporalReservations LEGACY_RENTAL encontradas para o mesmo Aluguel.`,
        reservationIds: reservations.map((r) => String(r._id)),
      });
      continue;
    }

    const reservation = reservations[0]!;
    const reservationEmpresaId = String(reservation.empresaId);
    const reservationPlateId = String(reservation.plateId);

    if (reservationEmpresaId !== empresaId || reservationPlateId !== plateIdStr) {
      report.tenantOrPlateMismatches++;
      report.issues.push({
        type: 'TENANT_OR_PLATE_MISMATCH',
        aluguelId,
        empresaId,
        plateId: plateIdStr,
        details: `Reserva ${reservation._id} possui empresaId=${reservationEmpresaId}/plateId=${reservationPlateId}, esperado empresaId=${empresaId}/plateId=${plateIdStr}.`,
        reservationIds: [String(reservation._id)],
      });
      continue;
    }

    const reservationStart = toDate(reservation.startDate);
    const reservationEnd = toDate(reservation.endDate);

    if (!reservationStart || !reservationEnd || !sameDate(reservationStart, startDate) || !sameDate(reservationEnd, endDate)) {
      report.dateMismatches++;
      report.issues.push({
        type: 'DATE_MISMATCH',
        aluguelId,
        empresaId,
        plateId: plateIdStr,
        details: `Reserva ${reservation._id}: startDate/endDate (${reservationStart?.toISOString()}/${reservationEnd?.toISOString()}) divergem do Aluguel (${startDate.toISOString()}/${endDate.toISOString()}).`,
        reservationIds: [String(reservation._id)],
      });

      if (options.fix) {
        try {
          await TemporalReservation.updateOne(
            { _id: reservation._id, empresaId },
            { $set: { startDate, endDate } },
          );
          report.fixed++;
        } catch {
          report.errors++;
        }
      }
    }
  }

  return report;
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function printReport(report: ReconcileAluguelTemporalReport, fixMode: boolean) {
  console.log('');
  console.log('── reconcile:aluguel-temporal ──');
  console.log(`Total analisado:              ${report.totalAnalyzed}`);
  console.log(`MISSING_RESERVATION:          ${report.missingReservations}`);
  console.log(`CONFLICT:                     ${report.conflicts}`);
  console.log(`DATE_MISMATCH:                ${report.dateMismatches}`);
  console.log(`TENANT_OR_PLATE_MISMATCH:     ${report.tenantOrPlateMismatches}`);
  console.log(`DUPLICATE:                    ${report.duplicates}`);
  console.log(`ORPHAN_PLACA_NOT_FOUND:       ${report.orphanPlacaNotFound}`);
  console.log(`ORPHAN_PLACA_TENANT_MISMATCH: ${report.orphanPlacaTenantMismatch}`);
  console.log(`ORPHAN_PLACA_FIELD_MISSING:   ${report.orphanPlacaFieldMissing}`);
  console.log(`Corrigidos:                   ${report.fixed}${fixMode ? '' : ' (dry-run, nenhuma escrita realizada)'}`);
  console.log(`Erros:                        ${report.errors}`);

  if (report.issues.length > 0) {
    console.log('');
    console.log('Problemas encontrados:');
    for (const issue of report.issues) {
      console.log(`  - [${issue.type}] Aluguel ${issue.aluguelId} (empresa ${issue.empresaId}): ${issue.details}`);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const fix = args.includes('--fix');
  const includeOrphans = args.includes('--include-orphans');
  const empresaArg = args.find((a) => a.startsWith('--empresa='));
  const limitArg = args.find((a) => a.startsWith('--limit='));

  const options: RunOptions = {
    fix,
    empresaId: empresaArg ? empresaArg.split('=')[1] : undefined,
    limit: limitArg ? Math.max(1, parseInt(limitArg.split('=')[1]!, 10)) : undefined,
    includeOrphans,
  };

  if (!fix) {
    console.log('MODO DRY-RUN — nenhuma alteracao sera feita no banco. Use --fix para aplicar correcoes.');
  } else {
    console.log('MODO --fix ATIVO — reservas ausentes/divergentes serao corrigidas no MongoDB.');
  }

  const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/inmidia';
  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 10_000 });

  try {
    const report = await reconcileAluguelTemporal(options);
    printReport(report, fix);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[reconcile-aluguel-temporal] erro fatal:', err);
    process.exit(1);
  });
}
