#!/usr/bin/env node
/**
 * Gate anti-regressão: conta arquivos .ts com @ts-nocheck em src/ (excluindo src/legacy/).
 *
 * BASELINE (2026-05-13, ARCH-4): 20 arquivos ativos com @ts-nocheck.
 * Todos documentados em src/legacy/README.md.
 *
 * CI falha se o número AUMENTAR acima do baseline.
 * Reporta quando o número DIMINUIR (progresso positivo).
 *
 * Uso:
 *   node scripts/check-ts-nocheck.js            # verifica com baseline padrão (20)
 *   node scripts/check-ts-nocheck.js --report   # só imprime, não falha
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const reportOnly = args.includes('--report');
// Baseline final: ARCH-10 corrigiu o último arquivo ativo (1 → 0).
// Todos os 20 arquivos originais com @ts-nocheck foram corrigidos.
// Somente src/legacy/ (21 arquivos) mantém @ts-nocheck — arquivos mortos aguardando remoção.
const BASELINE = 0;

const srcDir = path.join(__dirname, '..', 'src');
const legacyDir = path.join(srcDir, 'legacy');

function findTsNoCheck(dir, results = []) {
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Excluir src/legacy/ da contagem
      if (fullPath === legacyDir) continue;
      // Excluir node_modules, dist, tests
      if (['node_modules', 'dist', 'tests'].includes(entry.name)) continue;
      findTsNoCheck(fullPath, results);
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes('// @ts-nocheck') || content.includes('//@ts-nocheck')) {
          results.push(fullPath.replace(srcDir + path.sep, '').replace(srcDir + '/', ''));
        }
      } catch (_) {}
    }
  }
  return results;
}

const files = findTsNoCheck(srcDir);
const count = files.length;

console.log('');
console.log('╔══════════════════════════════╗');
console.log('║  @ts-nocheck Gate  ARCH-10   ║');
console.log('╚══════════════════════════════╝');
console.log(`  Baseline: ${BASELINE} arquivos`);
console.log(`  Atual:    ${count} arquivos`);

if (count < BASELINE) {
  console.log(`  ✅ Progresso! ${BASELINE - count} arquivo(s) eliminados do baseline.`);
} else if (count === BASELINE) {
  console.log('  ✅ Estável — nenhum novo @ts-nocheck introduzido.');
} else {
  console.log(`  ❌ REGRESSÃO: ${count - BASELINE} arquivo(s) acima do baseline.`);
}

if (files.length > 0) {
  console.log('\nArquivos com @ts-nocheck (excluindo legacy/):');
  files.sort().forEach(f => console.log(`  - ${f}`));
}

const legacyCount = findTsNoCheckLegacy(legacyDir);
console.log(`\n  (src/legacy/ tem ${legacyCount} arquivos com @ts-nocheck — não contados)`);
console.log('');

function findTsNoCheckLegacy(dir) {
  if (!fs.existsSync(dir)) return 0;
  let count = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.ts')) {
      try {
        const content = fs.readFileSync(path.join(dir, entry.name), 'utf8');
        if (content.includes('@ts-nocheck')) count++;
      } catch (_) {}
    }
  }
  return count;
}

if (!reportOnly && count > BASELINE) {
  process.exit(1);
}
