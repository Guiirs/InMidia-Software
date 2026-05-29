#!/usr/bin/env ts-node
/**
 * Multi-Tenant Query Security Scanner
 *
 * Varre src/ em busca de operações Mongoose sem empresaId em models tenant-scoped.
 *
 * Saída:
 *   0 = limpo (somente SAFE + WARNINGs na allowlist)
 *   1 = CRITICALs encontrados
 *   2 = WARNINGs fora da allowlist
 *
 * Uso:
 *   ts-node scripts/audit-multitenancy-queries.ts
 *   ts-node scripts/audit-multitenancy-queries.ts --report   # só imprime, não falha
 *   ts-node scripts/audit-multitenancy-queries.ts --json     # saída JSON
 */

import * as fs from 'fs';
import * as path from 'path';

// ─── Configuração ─────────────────────────────────────────────────────────────

const ARGS = process.argv.slice(2);
const REPORT_ONLY = ARGS.includes('--report');
const JSON_OUTPUT = ARGS.includes('--json');

const SRC_DIR = path.join(__dirname, '..', 'src');
const ALLOWLIST_PATH = path.join(__dirname, 'audit-multitenancy.allowlist.json');

// Models que têm empresaId no schema (tenant-scoped)
const TENANT_MODELS = new Set([
  // Core business models
  'Aluguel', 'Cliente', 'Contrato', 'MediaAsset', 'PiGenJob',
  'Placa', 'PropostaInterna', 'Regiao', 'RefreshToken', 'User',
  'Webhook', 'TemporalReservation', 'TemporalEvent', 'Checking',
  'AuditLog', 'WhatsAppTemplate', 'WhatsAppMessage', 'Campaign',
  // V4 Read-Model / Record models (tenant-scoped by design)
  'ActivityRecord', 'AlertRecord', 'CampaignRecord', 'CommercialRecord',
  'OperationRecord', 'ReportRecord',
  // Region alias used in some V4 modules (equivalent to Regiao)
  'Region',
  // PI alias used in queue workers (equivalent to PropostaInterna)
  'PI',
]);

// Models globais — queries sem empresaId são esperadas
const GLOBAL_MODELS = new Set([
  'Empresa', 'BiWeek', 'PiGenJob',
]);

// Operações destrutivas — CRITICAL se sem empresaId em tenant model
const DESTRUCTIVE_OPS = new Set([
  'updateMany', 'deleteMany', 'findByIdAndUpdate', 'findByIdAndDelete',
  'updateOne', 'deleteOne', 'replaceOne',
]);

// Operações de leitura que requerem empresaId em tenant model (WARNING se ausente)
const READ_OPS = new Set([
  'find', 'findOne', 'findById', 'aggregate', 'countDocuments', 'exists',
]);

// Padrão: detecta Model.operation( onde Model começa com maiúscula
const QUERY_REGEX = /\b([A-Z][A-Za-z]+)\.(find|findOne|findById|findByIdAndUpdate|findByIdAndDelete|updateMany|updateOne|deleteMany|deleteOne|aggregate|countDocuments|exists|replaceOne)\s*\(/g;

// Padrão inseguro explícito: filter condicional que pode virar {}
const UNSAFE_CONDITIONAL = /empresaId\s*\?\s*\{\s*empresaId\s*\}\s*:\s*\{\s*\}/g;

// Número de linhas de contexto a inspecionar antes/depois do match
const CONTEXT_LINES_BEFORE = 20;
const CONTEXT_LINES_AFTER = 8;

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Severity = 'CRITICAL' | 'WARNING' | 'SAFE' | 'INFO';

interface Finding {
  file: string;
  line: number;
  col: number;
  severity: Severity;
  model: string;
  operation: string;
  snippet: string;
  reason: string;
  allowlisted: boolean;
  allowlistEntry?: AllowlistEntry;
}

interface AllowlistEntry {
  file: string;
  pattern: string;
  reason: string;
  expiresAt: string;
}

// ─── Allowlist ────────────────────────────────────────────────────────────────

function loadAllowlist(): AllowlistEntry[] {
  if (!fs.existsSync(ALLOWLIST_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

function isAllowlisted(finding: Omit<Finding, 'allowlisted' | 'allowlistEntry'>, allowlist: AllowlistEntry[]): AllowlistEntry | null {
  const today = new Date().toISOString().split('T')[0]!;
  for (const entry of allowlist) {
    if (entry.expiresAt < today) continue; // expirado
    const fileMatch = finding.file.endsWith(entry.file) || finding.file.includes(entry.file.replace(/\//g, path.sep));
    const patternMatch = finding.snippet.includes(entry.pattern) || finding.model.includes(entry.pattern) || finding.operation.includes(entry.pattern);
    if (fileMatch && patternMatch) return entry;
  }
  return null;
}

// ─── Utilitários de arquivo ───────────────────────────────────────────────────

function walkFiles(dir: string, ext = '.ts'): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', '.git'].includes(entry.name)) continue;
      results.push(...walkFiles(full, ext));
    } else if (entry.isFile() && entry.name.endsWith(ext)) {
      results.push(full);
    }
  }
  return results;
}

function isTestFile(filePath: string): boolean {
  return filePath.includes('.test.') || filePath.includes('.spec.') || filePath.includes(`${path.sep}tests${path.sep}`);
}

function isLegacyFile(filePath: string): boolean {
  return filePath.includes(`${path.sep}legacy${path.sep}`);
}

// ─── Análise de contexto ──────────────────────────────────────────────────────

function hasEmpresaIdInContext(lines: string[], lineIndex: number): boolean {
  const start = Math.max(0, lineIndex - CONTEXT_LINES_BEFORE);
  const end = Math.min(lines.length - 1, lineIndex + CONTEXT_LINES_AFTER);
  const context = lines.slice(start, end + 1).join('\n');
  return /empresaId/.test(context);
}

function hasSuperadminContext(lines: string[], lineIndex: number): boolean {
  const start = Math.max(0, lineIndex - CONTEXT_LINES_BEFORE);
  const end = Math.min(lines.length - 1, lineIndex + CONTEXT_LINES_AFTER);
  const context = lines.slice(start, end + 1).join('\n');
  return /isSuperadmin|superadmin|SUPERADMIN/.test(context);
}

function isEmptyQuery(line: string, operation: string): boolean {
  // Detecta .find({}) .find({ }) — query vazia
  const afterOp = line.slice(line.indexOf(`.${operation}(`));
  return /\.\w+\(\s*\{\s*\}/.test(afterOp);
}

function hasUnsafeConditionalFilter(lines: string[], lineIndex: number): boolean {
  const start = Math.max(0, lineIndex - 5);
  const end = Math.min(lines.length - 1, lineIndex + 5);
  const context = lines.slice(start, end + 1).join('\n');
  return UNSAFE_CONDITIONAL.test(context);
}

// ─── Classificação ────────────────────────────────────────────────────────────

function classify(
  model: string,
  operation: string,
  lines: string[],
  lineIndex: number,
): { severity: Severity; reason: string } {
  const line = lines[lineIndex] ?? '';

  // Modelos globais são sempre seguros
  if (GLOBAL_MODELS.has(model)) {
    return { severity: 'SAFE', reason: 'Modelo global — empresaId não aplicável' };
  }

  // Se não é tenant-scoped conhecido, avisar mas não crítico
  if (!TENANT_MODELS.has(model)) {
    return { severity: 'INFO', reason: `Modelo '${model}' não catalogado como tenant-scoped — verificar manualmente` };
  }

  const hasEmpresa = hasEmpresaIdInContext(lines, lineIndex);
  const hasSuperadmin = hasSuperadminContext(lines, lineIndex);
  const emptyQuery = isEmptyQuery(line, operation);
  const unsafeConditional = hasUnsafeConditionalFilter(lines, lineIndex);

  // Contexto superadmin explícito — WARNING documentado, não crítico
  if (hasSuperadmin && !emptyQuery) {
    return { severity: 'WARNING', reason: 'Caminho superadmin detectado — verificar se a rota exige autenticação admin' };
  }

  // Filtro condicional inseguro (pode virar {})
  if (unsafeConditional) {
    return { severity: 'CRITICAL', reason: 'Filtro condicional `empresaId ? { empresaId } : {}` detectado — pode vazar dados se empresaId for nulo' };
  }

  // Query explicitamente vazia
  if (emptyQuery) {
    return {
      severity: 'CRITICAL',
      reason: `Query vazia \`.${operation}({})\` em model tenant-scoped '${model}' — vaza dados de todos os tenants`,
    };
  }

  // Com empresaId no contexto
  if (hasEmpresa) {
    return { severity: 'SAFE', reason: 'empresaId presente no contexto da query' };
  }

  // Sem empresaId: classificar por tipo de operação
  if (DESTRUCTIVE_OPS.has(operation)) {
    return {
      severity: 'CRITICAL',
      reason: `Operação destrutiva \`.${operation}()\` em model tenant-scoped '${model}' sem empresaId no filtro`,
    };
  }

  if (operation === 'findById') {
    return {
      severity: 'WARNING',
      reason: `\`.findById()\` em model tenant-scoped '${model}' — ID-only, sem validação de tenant; confirmar que caller valida empresaId`,
    };
  }

  if (operation === 'aggregate') {
    return {
      severity: 'WARNING',
      reason: `\`.aggregate()\` em model tenant-scoped '${model}' sem $match empresaId visível — verificar pipeline`,
    };
  }

  // find/findOne sem empresaId
  return {
    severity: 'CRITICAL',
    reason: `\`.${operation}()\` em model tenant-scoped '${model}' sem empresaId detectado no contexto (±${CONTEXT_LINES_BEFORE} linhas)`,
  };
}

// ─── Scanner principal ────────────────────────────────────────────────────────

function scanFile(filePath: string, allowlist: AllowlistEntry[]): Finding[] {
  const findings: Finding[] = [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const relPath = path.relative(path.join(__dirname, '..'), filePath).replace(/\\/g, '/');

  // Reset lastIndex antes de usar o regex global
  QUERY_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = QUERY_REGEX.exec(content)) !== null) {
    const [, model, operation] = match;
    if (!model || !operation) continue;

    // Calcular número de linha
    const before = content.slice(0, match.index);
    const lineIndex = (before.match(/\n/g) || []).length;
    const col = match.index - before.lastIndexOf('\n');
    const snippet = (lines[lineIndex] ?? '').trim().slice(0, 120);

    const { severity, reason } = classify(model!, operation!, lines, lineIndex);

    if (severity === 'SAFE') continue; // não incluir SAFE no relatório por padrão

    const base = { file: relPath, line: lineIndex + 1, col, severity, model: model!, operation: operation!, snippet, reason };
    const entry = isAllowlisted(base, allowlist);
    findings.push({ ...base, allowlisted: !!entry, allowlistEntry: entry ?? undefined });
  }

  // Verificar padrão de conditional filter no arquivo inteiro
  UNSAFE_CONDITIONAL.lastIndex = 0;
  let condMatch: RegExpExecArray | null;
  while ((condMatch = UNSAFE_CONDITIONAL.exec(content)) !== null) {
    const before = content.slice(0, condMatch.index);
    const lineIndex = (before.match(/\n/g) || []).length;
    const snippet = (lines[lineIndex] ?? '').trim().slice(0, 120);
    const base = {
      file: relPath, line: lineIndex + 1, col: 0,
      severity: 'CRITICAL' as Severity,
      model: '(unknown)', operation: 'filter',
      snippet,
      reason: 'Filtro condicional `empresaId ? { empresaId } : {}` — pode vazar dados cross-tenant',
    };
    const entry = isAllowlisted(base, allowlist);
    findings.push({ ...base, allowlisted: !!entry, allowlistEntry: entry ?? undefined });
  }

  return findings;
}

// ─── Relatório ────────────────────────────────────────────────────────────────

function printReport(allFindings: Finding[], stats: { scanned: number; elapsed: number }): void {
  const criticals = allFindings.filter(f => f.severity === 'CRITICAL' && !f.allowlisted);
  const warnings = allFindings.filter(f => f.severity === 'WARNING' && !f.allowlisted);
  const allowlisted = allFindings.filter(f => f.allowlisted);
  const infos = allFindings.filter(f => f.severity === 'INFO');

  if (JSON_OUTPUT) {
    console.log(JSON.stringify({ criticals, warnings, allowlisted, infos, stats }, null, 2));
    return;
  }

  console.log('\n══════════════════════════════════════════════════════════');
  console.log('   MULTI-TENANT QUERY SECURITY SCAN');
  console.log('══════════════════════════════════════════════════════════');
  console.log(`   Arquivos escaneados : ${stats.scanned}`);
  console.log(`   Tempo               : ${stats.elapsed}ms`);
  console.log(`   CRITICALs           : ${criticals.length}`);
  console.log(`   WARNINGs            : ${warnings.length}`);
  console.log(`   Allowlistados       : ${allowlisted.length}`);
  console.log(`   INFOs               : ${infos.length}`);
  console.log('══════════════════════════════════════════════════════════\n');

  if (criticals.length > 0) {
    console.log('🔴 CRITICAL — Vulnerabilidades de isolamento multi-tenant:\n');
    for (const f of criticals) {
      console.log(`  [CRITICAL] ${f.file}:${f.line}`);
      console.log(`             Model     : ${f.model}`);
      console.log(`             Operação  : .${f.operation}()`);
      console.log(`             Motivo    : ${f.reason}`);
      console.log(`             Snippet   : ${f.snippet}`);
      console.log();
    }
  }

  if (warnings.length > 0) {
    console.log('🟡 WARNING — Requer revisão (adicione à allowlist se intencional):\n');
    for (const f of warnings) {
      console.log(`  [WARNING] ${f.file}:${f.line}`);
      console.log(`            Model     : ${f.model}`);
      console.log(`            Operação  : .${f.operation}()`);
      console.log(`            Motivo    : ${f.reason}`);
      console.log(`            Snippet   : ${f.snippet}`);
      console.log();
    }
  }

  if (allowlisted.length > 0) {
    console.log('✅ ALLOWLISTADOS (justificados e documentados):\n');
    for (const f of allowlisted) {
      console.log(`  [${f.severity}] ${f.file}:${f.line} — ${f.allowlistEntry?.reason} (expira ${f.allowlistEntry?.expiresAt})`);
    }
    console.log();
  }

  if (infos.length > 0) {
    console.log('ℹ️  INFO — Modelos não catalogados (verificar manualmente):\n');
    for (const f of infos) {
      console.log(`  [INFO] ${f.file}:${f.line} — ${f.reason}`);
    }
    console.log();
  }

  if (criticals.length === 0 && warnings.length === 0) {
    console.log('✅ Scan limpo — nenhuma query cross-tenant detectada fora da allowlist.\n');
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main(): void {
  const start = Date.now();
  const allowlist = loadAllowlist();

  // Validar allowlist: itens sem expiresAt são rejeitados
  for (const entry of allowlist) {
    if (!entry.expiresAt) {
      console.error(`[audit-multitenancy] ERRO: allowlist entry para '${entry.file}' não tem expiresAt obrigatório`);
      if (!REPORT_ONLY) process.exit(1);
    }
  }

  const files = walkFiles(SRC_DIR).filter(f => !isTestFile(f) && !isLegacyFile(f));
  const allFindings: Finding[] = [];

  for (const file of files) {
    try {
      const findings = scanFile(file, allowlist);
      allFindings.push(...findings);
    } catch (err) {
      console.warn(`[audit-multitenancy] Erro ao escanear ${file}: ${(err as Error).message}`);
    }
  }

  const elapsed = Date.now() - start;
  printReport(allFindings, { scanned: files.length, elapsed });

  if (!REPORT_ONLY) {
    const criticals = allFindings.filter(f => f.severity === 'CRITICAL' && !f.allowlisted);
    const warnings = allFindings.filter(f => f.severity === 'WARNING' && !f.allowlisted);

    if (criticals.length > 0) {
      console.error(`❌ CI FAIL: ${criticals.length} vulnerabilidade(s) CRITICAL detectada(s). Corrija antes de fazer merge.\n`);
      process.exit(1);
    }
    if (warnings.length > 0) {
      console.error(`⚠️  CI FAIL: ${warnings.length} WARNING(s) não allowlistado(s). Adicione justificativa em audit-multitenancy.allowlist.json ou corrija.\n`);
      process.exit(2);
    }
  }
}

main();
