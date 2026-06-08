// GUARDRAIL — Legacy placa image resolver must not exist or be imported.
//
// Context:
//   placa-image-reference.resolver.ts and placa-image-key.resolver.ts were the
//   pre-PlateMedia image resolution layer. Both files were deleted in FASE 9
//   (2026-06-08). Any re-introduction would mean code is reading from legacy DB
//   fields instead of PlateMedia.activeKey.
//
// This test fails if:
//   1. The resolver files are re-created at their original paths.
//   2. Any production TypeScript file imports from or references these paths.
//   3. Any production TypeScript file calls resolvePlacaImageReference.
//
// Excluded from scan (not production code):
//   - src/legacy/           (archived dead code)
//   - src/.../tests/        (test directories)
//   - files ending in .test.ts, .spec.ts, .guardrail.test.ts
//   - scripts/              (historical migration scripts)

import * as fs from 'fs';
import * as path from 'path';

const SRC_ROOT = path.resolve(__dirname, '../..');

const IGNORE_PATTERNS: RegExp[] = [
  /\/legacy\//,
  /\/archived\//,
  /\/node_modules\//,
  /\/tests?\//,
  /\.test\.ts$/,
  /\.spec\.ts$/,
  /\.guardrail\.test\.ts$/,
  /[/\\]scripts[/\\]/,
];

function collectTsFiles(dir: string): string[] {
  const results: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (IGNORE_PATTERNS.some((re) => re.test(fullPath.replace(/\\/g, '/')))) continue;
    if (entry.isDirectory()) {
      results.push(...collectTsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

// ── 1. File existence checks ───────────────────────────────────────────────────

describe('GUARDRAIL: legacy resolver files must not exist', () => {
  it('placa-image-reference.resolver.ts was deleted', () => {
    const p = path.join(SRC_ROOT, 'modules/media/placa-image-reference.resolver.ts');
    expect(fs.existsSync(p)).toBe(false);
  });

  it('placa-image-key.resolver.ts was deleted', () => {
    const p = path.join(SRC_ROOT, 'modules/public-plates/placa-image-key.resolver.ts');
    expect(fs.existsSync(p)).toBe(false);
  });

  it('legacy resolver test file was deleted', () => {
    const p = path.join(SRC_ROOT, 'modules/media/tests/placa-image-reference.resolver.test.ts');
    expect(fs.existsSync(p)).toBe(false);
  });
});

// ── 2. Import scan ─────────────────────────────────────────────────────────────

describe('GUARDRAIL: no production file imports from legacy resolver', () => {
  const FORBIDDEN_IMPORT_PATTERNS: string[] = [
    `from '@modules/media/placa-image-reference.resolver'`,
    `from "@modules/media/placa-image-reference.resolver"`,
    `from '@modules/public-plates/placa-image-key.resolver'`,
    `from "@modules/public-plates/placa-image-key.resolver"`,
    `require('@modules/media/placa-image-reference.resolver')`,
    `require("@modules/media/placa-image-reference.resolver")`,
  ];

  it('no production file imports the legacy resolver module', () => {
    const files = collectTsFiles(SRC_ROOT);
    const violations: string[] = [];

    for (const file of files) {
      let content: string;
      try { content = fs.readFileSync(file, 'utf-8'); } catch { continue; }

      for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
        if (content.includes(pattern)) {
          violations.push(`${path.relative(SRC_ROOT, file)}: imports "${pattern}"`);
          break;
        }
      }
    }

    expect(violations).toEqual([]);
  });
});

// ── 3. Symbol scan ─────────────────────────────────────────────────────────────

describe('GUARDRAIL: resolvePlacaImageReference must not be called in production', () => {
  // Matches call-sites and import references (but not this guardrail or comments).
  const FORBIDDEN_SYMBOL_PATTERNS: string[] = [
    'resolvePlacaImageReference(',
    'resolvePlacaImageKey(',
    'getPlacaImageCandidates(',
    'hasResolvablePlacaImage(',
  ];

  it('no production file calls legacy resolver functions', () => {
    const files = collectTsFiles(SRC_ROOT);
    const violations: string[] = [];

    for (const file of files) {
      let content: string;
      try { content = fs.readFileSync(file, 'utf-8'); } catch { continue; }

      for (const sym of FORBIDDEN_SYMBOL_PATTERNS) {
        if (content.includes(sym)) {
          violations.push(`${path.relative(SRC_ROOT, file)}: uses "${sym}"`);
          break;
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
