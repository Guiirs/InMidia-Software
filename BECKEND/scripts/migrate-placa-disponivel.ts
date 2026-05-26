#!/usr/bin/env ts-node
/**
 * Migração: campo disponivel nas Placas
 *
 * PROBLEMA:
 *   Documentos criados antes da ARCH-1 podem ter o campo `ativa` (do DTO legado)
 *   sem o campo `disponivel` (campo canônico do schema). Como o Mongoose em strict
 *   mode ignorava `ativa`, todos esses documentos têm `disponivel: true` pelo
 *   default do schema — o que é correto para a maioria, mas precisa ser auditado.
 *
 * O QUE FAZ:
 *   Caso 1 — doc tem `ativa` explícito e `disponivel` é o default (true):
 *     → Sincroniza disponivel = ativa (preserva intenção original).
 *     → Só aplica se ativa !== true (i.e., ativa=false mas disponivel ainda é true).
 *
 *   Caso 2 — doc não tem `ativa` e `disponivel` existe:
 *     → Ignora (já está no formato canônico).
 *
 *   Caso 3 — conflito (ativa=true, disponivel=false ou ativa=false, disponivel=false):
 *     → Registra como conflito, NÃO altera, requer revisão manual.
 *
 * NÃO SOBRESCREVE:
 *   - Documentos sem o campo `ativa` (já estão corretos).
 *   - Documentos onde disponivel=false (estado intencional).
 *
 * USO:
 *   npx ts-node scripts/migrate-placa-disponivel.ts --dry-run
 *   npx ts-node scripts/migrate-placa-disponivel.ts --confirm
 *
 * @version 1.0.0
 */

import mongoose from 'mongoose';
import * as path from 'path';
import * as readline from 'readline';
import { config } from 'dotenv';

config({ path: path.resolve(__dirname, '../.env') });

// ─── Configuração ─────────────────────────────────────────────────────────────

const BATCH_SIZE = 100;
const MONGO_URI =
  process.argv.find(a => a.startsWith('--uri='))?.split('=')[1] ||
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  'mongodb://localhost:27017/inmidia';

const IS_DRY_RUN = process.argv.includes('--dry-run');
const IS_CONFIRM = process.argv.includes('--confirm');

// ─── Cores ────────────────────────────────────────────────────────────────────

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};
const log = (msg: string) => console.log(msg);
const info = (msg: string) => log(`${c.cyan}ℹ ${msg}${c.reset}`);
const ok = (msg: string) => log(`${c.green}✓ ${msg}${c.reset}`);
const warn = (msg: string) => log(`${c.yellow}⚠ ${msg}${c.reset}`);
const err = (msg: string) => log(`${c.red}✗ ${msg}${c.reset}`);
const head = (msg: string) => log(`\n${c.bold}${c.blue}── ${msg} ──${c.reset}`);

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface MigrationReport {
  totalAnalisado: number;
  totalMigrado: number;
  totalIgnorado: number;
  totalConflito: number;
  conflitos: Array<{ _id: string; ativa: unknown; disponivel: unknown }>;
  erros: Array<{ _id: string; erro: string }>;
}

// ─── Confirmação interativa ───────────────────────────────────────────────────

async function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'sim');
    });
  });
}

// ─── Lógica principal ─────────────────────────────────────────────────────────

async function migrate(): Promise<void> {
  head('Migração: campo disponivel nas Placas');

  if (IS_DRY_RUN) {
    warn('MODO DRY-RUN — nenhuma alteração será gravada no banco.');
  } else if (!IS_CONFIRM) {
    err('Execute com --dry-run para simular, ou --confirm para gravar.');
    err('Exemplo: npx ts-node scripts/migrate-placa-disponivel.ts --dry-run');
    process.exit(1);
  }

  // ── Conexão ──────────────────────────────────────────────────────────────
  head('Conectando ao MongoDB');
  info(`URI: ${MONGO_URI.replace(/:\/\/([^:]+):([^@]+)@/, '://*****:*****@')}`);

  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 10_000 });
  ok('Conectado.');

  const db = mongoose.connection.db;
  if (!db) throw new Error('Conexão com banco retornou undefined');
  const placas = db.collection('placas');

  // ── Confirmação para execução real ───────────────────────────────────────
  if (!IS_DRY_RUN) {
    const totalGeral = await placas.countDocuments({});
    warn(`\nEsta operação poderá modificar documentos em uma coleção com ${totalGeral} placas.`);
    warn('URI: ' + MONGO_URI.replace(/:\/\/([^:]+):([^@]+)@/, '://*****:*****@'));
    const confirmed = await askConfirmation(
      `${c.yellow}${c.bold}Digite "sim" para confirmar a execução REAL: ${c.reset}`
    );
    if (!confirmed) {
      info('Operação cancelada pelo usuário.');
      await mongoose.disconnect();
      process.exit(0);
    }
  }

  // ── Análise ───────────────────────────────────────────────────────────────
  head('Analisando documentos');

  const report: MigrationReport = {
    totalAnalisado: 0,
    totalMigrado: 0,
    totalIgnorado: 0,
    totalConflito: 0,
    conflitos: [],
    erros: [],
  };

  // Cursor sobre todos os documentos da coleção
  const cursor = placas.find({});
  let batch: any[] = [];

  const processBatch = async (docs: any[]) => {
    const bulkOps: any[] = [];

    for (const doc of docs) {
      report.totalAnalisado++;
      const id = doc._id.toString();
      const temAtiva = 'ativa' in doc;
      const ativaValue = doc.ativa;
      const disponivelValue = doc.disponivel;

      // Caso 2: sem campo `ativa` — já está no formato canônico
      if (!temAtiva) {
        report.totalIgnorado++;
        continue;
      }

      // Caso 3: conflito — ativa=false mas disponivel já é false
      // (pode ter sido gravado manualmente em ambos)
      if (ativaValue === false && disponivelValue === false) {
        // Já consistente — ignora
        report.totalIgnorado++;
        continue;
      }

      // Conflito real: ativa=false mas disponivel está em estado diferente e não é default
      if (ativaValue === false && disponivelValue === true) {
        // Esta é a situação problemática que queremos corrigir:
        // ativa=false indica que o usuário a colocou em manutenção,
        // mas disponivel=true (default do schema) não foi atualizado.
        // → Corrigir: disponivel = false
        if (!IS_DRY_RUN) {
          bulkOps.push({
            updateOne: {
              filter: { _id: doc._id },
              update: {
                $set: { disponivel: false },
                $unset: { ativa: '' },
              },
            },
          });
        }
        report.totalMigrado++;
        ok(`[MIGRAR] _id=${id} ativa=false → disponivel=false`);
        continue;
      }

      // Caso: ativa=true e disponivel=true → já consistente, apenas remove o campo legado
      if (ativaValue === true && disponivelValue === true) {
        if (!IS_DRY_RUN) {
          bulkOps.push({
            updateOne: {
              filter: { _id: doc._id },
              update: { $unset: { ativa: '' } },
            },
          });
        }
        report.totalIgnorado++;
        log(`${c.dim}[LIMPAR] _id=${id} ativa=true removido (disponivel=true já correto)${c.reset}`);
        continue;
      }

      // Conflito: ativa e disponivel têm valores que não seguem a regra acima
      report.totalConflito++;
      report.conflitos.push({ _id: id, ativa: ativaValue, disponivel: disponivelValue });
      warn(`[CONFLITO] _id=${id} ativa=${ativaValue} disponivel=${disponivelValue} — IGNORADO`);
    }

    if (!IS_DRY_RUN && bulkOps.length > 0) {
      try {
        const result = await placas.bulkWrite(bulkOps, { ordered: false });
        log(`${c.dim}  → bulkWrite: ${result.modifiedCount} modificados${c.reset}`);
      } catch (e: any) {
        err(`Erro no bulkWrite: ${e.message}`);
        report.erros.push({ _id: 'batch', erro: e.message });
      }
    }
  };

  // Processar em batches
  for await (const doc of cursor) {
    batch.push(doc);
    if (batch.length >= BATCH_SIZE) {
      await processBatch(batch);
      batch = [];
      process.stdout.write(`\r${c.dim}Analisados: ${report.totalAnalisado}...${c.reset}`);
    }
  }
  if (batch.length > 0) await processBatch(batch);

  // ── Relatório Final ───────────────────────────────────────────────────────
  head('Relatório Final');
  log('');
  log(`  ${c.bold}Total analisado:${c.reset}   ${report.totalAnalisado}`);
  log(`  ${c.green}Total migrado:${c.reset}     ${report.totalMigrado}`);
  log(`  ${c.dim}Total ignorado:${c.reset}    ${report.totalIgnorado}`);
  log(`  ${c.yellow}Total conflito:${c.reset}    ${report.totalConflito}`);
  log('');

  if (IS_DRY_RUN) {
    warn('DRY-RUN concluído — nenhuma alteração foi feita.');
    if (report.totalMigrado > 0) {
      warn(`${report.totalMigrado} documentos SERIAM alterados em execução real.`);
      warn('Execute com --confirm para aplicar as alterações.');
    } else {
      ok('Nenhum documento precisa de migração.');
    }
  } else {
    ok(`Migração concluída. ${report.totalMigrado} documentos atualizados.`);
  }

  if (report.totalConflito > 0) {
    warn(`\n${report.totalConflito} conflito(s) encontrado(s) — requerem revisão manual:`);
    report.conflitos.forEach(c_ => {
      warn(`  _id=${c_._id}  ativa=${c_.ativa}  disponivel=${c_.disponivel}`);
    });
  }

  if (report.erros.length > 0) {
    err(`\n${report.erros.length} erro(s) durante a migração:`);
    report.erros.forEach(e_ => {
      err(`  ${e_._id}: ${e_.erro}`);
    });
  }

  await mongoose.disconnect();
  ok('Desconectado do MongoDB.');

  process.exit(report.erros.length > 0 ? 1 : 0);
}

migrate().catch(e => {
  err(`Erro fatal: ${e.message}`);
  mongoose.disconnect().catch(() => null);
  process.exit(1);
});
