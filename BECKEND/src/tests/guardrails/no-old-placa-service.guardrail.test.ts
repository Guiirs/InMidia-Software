// GUARDRAIL — OLD placa.service.ts must not be imported by production code.
//
// Context:
//   The original file src/modules/placas/placa.service.ts was classified
//   LEGADO_MORTO in FASE 6A and archived to src/legacy/archived-placa.service.ts
//   in FASE 7 (2026-06-01).
//
//   The active service is: src/modules/placas/services/placa.service.ts
//
// This test fails if any production TypeScript file imports from the OLD path:
//   @modules/placas/placa.service
//
// Excluded from scan (not production code):
//   - src/legacy/           (archived dead code)
//   - src/.../tests/        (test directories)
//   - files ending in .test.ts, .spec.ts, .guardrail.test.ts

import * as fs from 'fs';
import * as path from 'path';

function collectTsFiles(dir: string, ignorePatterns: RegExp[]): string[] {
  const results: string[] = [];
  let entries: fs.Dirent[];

  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (ignorePatterns.some((re) => re.test(fullPath.replace(/\\/g, '/')))) continue;

    if (entry.isDirectory()) {
      results.push(...collectTsFiles(fullPath, ignorePatterns));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      results.push(fullPath);
    }
  }

  return results;
}

describe('GUARDRAIL: OLD placa.service.ts must not be imported by production code', () => {
  const SRC_ROOT = path.resolve(__dirname, '../..');

  const IGNORE_PATTERNS: RegExp[] = [
    /\/legacy\//,
    /\/node_modules\//,
    /\/tests?\//,
    /\.test\.ts$/,
    /\.spec\.ts$/,
    /\.guardrail\.test\.ts$/,
  ];

  // Patterns must include import keywords to avoid false-positives from comments
  // that mention the forbidden path (e.g. "Não importar '@modules/placas/placa.service'").
  const FORBIDDEN_IMPORT_PATTERNS: string[] = [
    `from '@modules/placas/placa.service'`,
    `from "@modules/placas/placa.service"`,
    `require('@modules/placas/placa.service')`,
    `require("@modules/placas/placa.service")`,
    // relative imports targeting the old root-level file
    `from '../placa.service'`,
    `from "../placa.service"`,
  ];

  it('no production file imports from @modules/placas/placa.service (LEGADO_MORTO)', () => {
    const files = collectTsFiles(SRC_ROOT, IGNORE_PATTERNS);
    const violations: string[] = [];

    for (const file of files) {
      let content: string;
      try {
        content = fs.readFileSync(file, 'utf-8');
      } catch {
        continue;
      }

      for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
        if (content.includes(pattern)) {
          violations.push(`${path.relative(SRC_ROOT, file)}: imports "${pattern}"`);
          break; // one report per file
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('active PlacaService is importable from canonical path', () => {
    // Verify the NEW service file exists at the expected path
    const activePath = path.join(SRC_ROOT, 'modules/placas/services/placa.service.ts');
    expect(fs.existsSync(activePath)).toBe(true);
  });

  it('OLD service file no longer exists at original production path', () => {
    // Verify the LEGADO_MORTO file was removed from production path
    const oldPath = path.join(SRC_ROOT, 'modules/placas/placa.service.ts');
    expect(fs.existsSync(oldPath)).toBe(false);
  });
});
