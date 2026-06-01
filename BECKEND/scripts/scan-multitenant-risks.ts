/**
 * Guardrail: Multi-Tenant Query Risk Scanner
 *
 * Scans TypeScript source files for dangerous query patterns that could cause
 * cross-tenant data leakage. Run with:
 *   npx ts-node scripts/scan-multitenant-risks.ts
 */

import fs from 'fs';
import path from 'path';

// Collections that are genuinely global (no empresaId required)
const GLOBAL_COLLECTION_ALLOWLIST = new Set([
  'Empresa',
  'User',         // if users span tenants
  'Region',       // if regions are shared globally
  'PiGenJob',     // jobs are scoped at query level by empresaId
]);

interface Finding {
  file: string;
  line: number;
  pattern: string;
  snippet: string;
}

const DANGEROUS_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  // find({}) — no filter at all
  {
    name: 'find({})',
    regex: /\.find\s*\(\s*\{\s*\}\s*\)/,
  },
  // updateMany({ without empresaId as first key (heuristic: opening brace + not empresaId)
  {
    name: 'updateMany({ <no empresaId>',
    regex: /\.updateMany\s*\(\s*\{(?![^}]*empresaId)/,
  },
  // deleteMany({ without empresaId (same heuristic)
  {
    name: 'deleteMany({ <no empresaId>',
    regex: /\.deleteMany\s*\(\s*\{(?![^}]*empresaId)/,
  },
  // findOne({ name: — name-only lookup without tenant
  {
    name: 'findOne({ name: <no empresaId>',
    regex: /\.findOne\s*\(\s*\{\s*name\s*:/,
  },
  // Conditional empresaId spread: empresaId ? { empresaId } : {}
  {
    name: 'conditional empresaId spread empresaId ? { empresaId } : {}',
    regex: /empresaId\s*\?\s*\{\s*empresaId\s*\}\s*:\s*\{\s*\}/,
  },
  // if (empresaId) filter.empresaId — conditional add pattern
  {
    name: 'if (empresaId) filter.empresaId — conditional add',
    regex: /if\s*\(\s*empresaId\s*\)\s*\w+\.empresaId/,
  },
  // if (options.empresaId) — conditional add inside options
  {
    name: 'if (options.empresaId) — conditional add',
    regex: /if\s*\(\s*options\.empresaId\s*\)/,
  },
];

function walkDir(dir: string, results: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
      walkDir(fullPath, results);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
      results.push(fullPath);
    }
  }
  return results;
}

function isAllowlisted(line: string): boolean {
  for (const collection of GLOBAL_COLLECTION_ALLOWLIST) {
    // If the line references an allowlisted collection immediately before the method call
    if (new RegExp(`\\b${collection}\\b`).test(line)) {
      return true;
    }
  }
  return false;
}

function scanFile(filePath: string): Finding[] {
  const findings: Finding[] = [];
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();

    // Skip comments and type declarations
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;

    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.regex.test(line)) {
        if (isAllowlisted(line)) continue;
        findings.push({
          file: filePath,
          line: i + 1,
          pattern: pattern.name,
          snippet: trimmed.substring(0, 120),
        });
      }
    }
  }

  return findings;
}

function main() {
  const srcDir = path.resolve(__dirname, '../src');
  const allFiles = walkDir(srcDir);
  const allFindings: Finding[] = [];

  for (const file of allFiles) {
    const findings = scanFile(file);
    allFindings.push(...findings);
  }

  if (allFindings.length === 0) {
    console.log('✅ Nenhum padrão perigoso encontrado.');
    process.exit(0);
  }

  console.error(`\n❌ ${allFindings.length} padrão(ões) potencialmente perigoso(s) encontrado(s):\n`);

  for (const f of allFindings) {
    const rel = path.relative(srcDir, f.file);
    console.error(`  [${f.pattern}]`);
    console.error(`    ${rel}:${f.line}`);
    console.error(`    ${f.snippet}`);
    console.error('');
  }

  console.error('Revise cada ocorrência acima. Para coleções globais legítimas, adicione-as em GLOBAL_COLLECTION_ALLOWLIST.\n');
  process.exit(1);
}

main();
