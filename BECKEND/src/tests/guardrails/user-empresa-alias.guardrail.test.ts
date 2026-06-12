// GUARDRAIL — User queries must filter by `empresa`, not by the `empresaId` alias.
//
// Context:
//   src/database/schemas/user.schema.ts declares:
//     empresa: { type: ObjectId, ref: 'Empresa', alias: 'empresaId', ... }
//
//   Mongoose document aliases (`alias: 'empresaId'`) only affect document
//   getters/setters (doc.empresaId / doc.set({ empresaId })). They are NOT
//   resolved for query filters: `User.find({ empresaId })` silently matches
//   on a non-existent top-level field and returns ZERO documents (or, worse,
//   ALL documents if combined with $or/$and logic), breaking multi-tenant
//   isolation.
//
//   The correct field for query filters is `empresa`.
//
// This test fails if any production TypeScript file calls a Mongoose query
// method on `User` with a top-level `empresaId` filter key, e.g.:
//   User.find({ empresaId })
//   User.findOne({ empresaId: x })
//   User.updateMany({ empresaId: x }, { ... })
//
// It does NOT flag `empresaId` used outside of User.* query filters (e.g.
// other models, JWT payloads, DTOs).
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

/**
 * Extracts the argument text of `User.<method>(...)` calls, respecting nested
 * parentheses, so we can inspect the filter object passed to each call.
 */
function extractUserQueryCallArgs(content: string): string[] {
  const QUERY_METHODS = [
    'find',
    'findOne',
    'findOneAndUpdate',
    'findOneAndDelete',
    'findOneAndReplace',
    'updateOne',
    'updateMany',
    'deleteOne',
    'deleteMany',
    'countDocuments',
    'aggregate',
    'exists',
  ];

  const callArgs: string[] = [];
  const callRegex = new RegExp(`User\\.(?:${QUERY_METHODS.join('|')})\\s*\\(`, 'g');

  let match: RegExpExecArray | null;
  while ((match = callRegex.exec(content)) !== null) {
    const start = match.index + match[0].length;
    let depth = 1;
    let i = start;
    while (i < content.length && depth > 0) {
      if (content[i] === '(') depth++;
      else if (content[i] === ')') depth--;
      i++;
    }
    callArgs.push(content.slice(start, i - 1));
  }

  return callArgs;
}

describe('GUARDRAIL: User.* queries must use `empresa`, not the `empresaId` alias', () => {
  const SRC_ROOT = path.resolve(__dirname, '../..');

  const IGNORE_PATTERNS: RegExp[] = [
    /\/legacy\//,
    /\/node_modules\//,
    /\/tests?\//,
    /\.test\.ts$/,
    /\.spec\.ts$/,
    /\.guardrail\.test\.ts$/,
  ];

  // Matches `empresaId` used as an object KEY, e.g. `{ empresaId }`,
  // `{ empresaId: x }`, `{ _id: userId, empresaId }`.
  //
  // Requires `empresaId` to be the first token of a property (preceded by
  // `{`, `,` or `(`, possibly across whitespace/newlines). This deliberately
  // does NOT match `{ empresa: empresaId }`, where `empresaId` is merely a
  // VALUE (a variable name) assigned to the correct `empresa` key — that is
  // the correct, safe pattern and must not be flagged.
  const EMPRESA_ID_KEY_PATTERN = /(^|[{,(])\s*empresaId\s*[,:}]/;

  it('no User.* query filter uses the empresaId alias', () => {
    const files = collectTsFiles(SRC_ROOT, IGNORE_PATTERNS);
    const violations: string[] = [];

    for (const file of files) {
      let content: string;
      try {
        content = fs.readFileSync(file, 'utf-8');
      } catch {
        continue;
      }

      if (!content.includes('User.')) continue;

      const args = extractUserQueryCallArgs(content);
      for (const arg of args) {
        if (EMPRESA_ID_KEY_PATTERN.test(arg)) {
          violations.push(
            `${path.relative(SRC_ROOT, file)}: User.* query uses 'empresaId' — use 'empresa' instead (alias not resolved in query filters)`
          );
          break; // one report per file
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('User schema documents the empresa/empresaId alias contract', () => {
    const schemaPath = path.join(SRC_ROOT, 'database/schemas/user.schema.ts');
    const content = fs.readFileSync(schemaPath, 'utf-8');

    expect(content).toContain("alias: 'empresaId'");
  });
});
