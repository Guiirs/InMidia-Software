#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();

const DEFAULT_SCAN_DIRS = [
  'src/v4-painel',
  'src/v4',
];

const scanDirs = (process.env.SYNC_BOUNDARY_DIRS ?? DEFAULT_SCAN_DIRS.join(','))
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const allowedPathFragments = [
  'src/core/sync-core/adapters/',
  'src/services/',
  '.test.',
  '.spec.',
  '__tests__',
];

const ignoredPathFragments = [
  '/docs/',
  '/dist/',
  '/node_modules/',
  '/REVIEW_',
  '/README',
  '/governance/',
];

// Legacy allowlist intentionally empty after the Sync Core migration.
const legacyAllowlist = [];

const legacyAllowedFiles = new Map(legacyAllowlist.map((item) => [item.file, item]));

const forbiddenRules = [
  { name: 'axios import', pattern: /(?:^|\n)\s*import\s+.*?from\s+['"]axios['"]/ },
  { name: 'apiClient import', pattern: /(?:^|\n)\s*import\s+.*?apiClient.*?from\s+['"].*?apiClient(?:\.js)?['"]/ },
  { name: 'services/api import', pattern: /(?:^|\n)\s*import\s+.*?from\s+['"].*?services\/api(?:Client)?(?:\.js)?['"]/ },
  { name: 'direct services import from UI', pattern: /(?:^|\n)\s*import\s+.*?from\s+['"](?:\.\.\/)+services\/.*?['"]/ },
  { name: 'services/inventory import', pattern: /(?:^|\n)\s*import\s+.*?from\s+['"].*?services\/inventory.*?['"]/ },
  { name: 'getInventorySummary import/use', pattern: /\bgetInventorySummary\b/ },
  { name: 'listBoards import/use', pattern: /\blistBoards\b/ },
  { name: 'direct updateBoard service import/use', pattern: /\bupdateBoard\b.*from\s+['"].*?services\/boardService(?:\.js)?['"]/ },
  { name: 'fetch call', pattern: /\bfetch\s*\(/ },
  { name: 'legacy data-orchestrator import', pattern: /(?:^|\n)\s*import\s+.*?from\s+['"].*?data-orchestrator\/.*?['"]/ },
  { name: 'legacy useV4Resource/useV4Refresh', pattern: /\buseV4(?:Resource|Refresh)\b/ },
];

const extensions = new Set(['.js', '.jsx', '.ts', '.tsx']);

function toPosix(filePath) {
  return filePath.replaceAll(path.sep, '/');
}

function relative(filePath) {
  return toPosix(path.relative(ROOT, filePath));
}

function getLegacyAllowance(filePath) {
  const rel = relative(filePath);
  return legacyAllowedFiles.get(rel);
}

function isGenerallyAllowed(filePath) {
  const rel = relative(filePath);
  return allowedPathFragments.some((fragment) => rel.includes(fragment));
}

function isIgnored(filePath) {
  const rel = `/${relative(filePath)}`;
  return ignoredPathFragments.some((fragment) => rel.includes(fragment));
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }

    if (extensions.has(path.extname(entry.name)) && !isIgnored(fullPath)) {
      files.push(fullPath);
    }
  }

  return files;
}

const violations = [];
const allowlistedFiles = new Map();
let analyzedFiles = 0;

for (const scanDir of scanDirs) {
  const absoluteDir = path.join(ROOT, scanDir);
  for (const file of walk(absoluteDir)) {
    analyzedFiles += 1;

    const legacyAllowance = getLegacyAllowance(file);
    if (legacyAllowance) {
      allowlistedFiles.set(legacyAllowance.file, legacyAllowance);
      continue;
    }

    if (isGenerallyAllowed(file)) continue;

    const source = fs.readFileSync(file, 'utf8');
    forbiddenRules.forEach((rule) => {
      if (rule.pattern.test(source)) {
        violations.push({ file: relative(file), rule: rule.name });
      }
    });
  }
}

function printSummary(log = console.log) {
  log('Sync boundary summary:');
  log(`- Scan dirs: ${scanDirs.join(', ')}`);
  log(`- Files analyzed: ${analyzedFiles}`);
  log(`- Violations found: ${violations.length}`);
  log(`- Files allowed by migration allowlist: ${allowlistedFiles.size}`);

  if (allowlistedFiles.size) {
    log('- Allowlist entries in use:');
    Array.from(allowlistedFiles.values()).forEach((item) => {
      log(`  - ${item.file} (${item.domain}, deadline ${item.deadline})`);
    });
  }

  log('Next steps:');
  log('- Keep new API access inside src/core/sync-core/adapters or src/services.');
  log(allowlistedFiles.size
    ? '- Migrate allowlisted files to useSyncResource/useSyncMutation and remove exceptions.'
    : '- Keep the legacy allowlist empty; do not reintroduce V4 data-orchestrator aliases.');
}

if (violations.length) {
  console.error('\nSync boundary violations found:');
  violations.forEach(({ file, rule }) => {
    console.error(`- ${file}: ${rule}`);
  });
  console.error('');
  printSummary(console.error);
  console.error('\nUse Sync Core domain adapters + useSyncResource/useSyncMutation instead of direct API access.\n');
  process.exit(1);
}

console.log('Sync boundary check passed.\n');
printSummary();
