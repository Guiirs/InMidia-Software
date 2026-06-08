/**
 * plate-media-fase3-audit.test.ts — FASE 3 + FASE 4 (contrato de flags)
 *
 * Valida a segurança dos scripts de migração antes de qualquer execução real.
 *
 * Cobre os cenários canônicos:
 *   A  Placa com imagemPrincipal, sem PlateMedia → migração cria PlateMedia
 *   B  Placa com imagemPrincipal E PlateMedia    → não sobrescreve activeKey
 *   C  PlateMedia.activeKey aponta R2 inexistente → aparece na auditoria, não é corrigido
 *   D  Placa sem imagem                          → não cria PlateMedia vazio
 *   E  Legado diverge de PlateMedia.activeKey    → auditoria detecta, sem auto-correção
 *
 * Propriedades gerais:
 *   - dry-run não persiste nada
 *   - idempotência (segunda execução skips tudo)
 *   - activeKey null/vazio detectada pelo audit
 *   - conflito entre campo legado e PlateMedia reportado, não resolvido
 *   - guarda do remove-legacy bloqueia quando cobertura PlateMedia incompleta
 */

// ──────────────────────────────────────────────────────────────────────────────
// Extração inline das funções puras dos scripts (não exportadas pelos scripts)
// ──────────────────────────────────────────────────────────────────────────────

function extractFirstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const v of values) {
    if (v && typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

/** Replica a lógica de resolveKey de migrate-plate-media.ts */
function resolveKey(doc: any): string | null {
  const direct = extractFirstNonEmpty(
    doc.imagemPrincipal, doc.imagem, doc.storageKey, doc.imagemKey, doc.r2Key,
  );
  if (direct) return direct;

  const images: any[] = Array.isArray(doc.imagens) ? doc.imagens : [];
  const main = images.find((img: any) => img?.isMain) ?? images[0] ?? null;
  if (main) {
    return extractFirstNonEmpty(
      main.storageKey, main.imagemKey, main.r2Key, main.key, main.url,
    );
  }
  return null;
}

// ──────────────────────────────────────────────────────────────────────────────
// Simulação da lógica de migração (loop body de migrate-plate-media.ts)
// ──────────────────────────────────────────────────────────────────────────────

interface MigReport {
  total:        number;
  migrated:     number;
  skipped:      number;
  noImage:      number;
  brokenLegacy: number;
  errors:       Array<{ plateId: string; reason: string }>;
}

async function runMigration(
  plates: any[],
  opts: {
    isDryRun:        boolean;
    findExisting:    (plateId: string) => Promise<any | null>;
    createPlateMedia:(plateId: string, empresaId: string, key: string) => Promise<void>;
    verifyR2?:       (key: string) => Promise<boolean>;
  },
): Promise<MigReport> {
  const report: MigReport = {
    total: 0, migrated: 0, skipped: 0, noImage: 0, brokenLegacy: 0, errors: [],
  };
  const verifyR2 = opts.verifyR2 ?? (async () => true);

  for (const doc of plates) {
    report.total += 1;
    const plateId   = String(doc._id);
    const empresaId = String(doc.empresaId ?? '');

    try {
      const existing = await opts.findExisting(plateId);
      if (existing) { report.skipped += 1; continue; }

      const key = resolveKey(doc);
      if (!key) { report.noImage += 1; continue; }

      const existsInR2 = await verifyR2(key);
      if (!existsInR2) { report.brokenLegacy += 1; continue; }

      if (!opts.isDryRun) {
        await opts.createPlateMedia(plateId, empresaId, key);
      }
      report.migrated += 1;
    } catch (err) {
      report.errors.push({
        plateId,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return report;
}

// ──────────────────────────────────────────────────────────────────────────────
// Simulação da lógica de auditoria (loop body de audit-plate-media-consistency.ts)
// ──────────────────────────────────────────────────────────────────────────────

interface AuditRecord {
  plateId:                   string;
  issues:                    string[];
  hasPlateMedia:             boolean;
  activeKey:                 string | null;
  plateMediaStatus:          string | null;
  legacyKey:                 string | null;
  hasLegacyImagemPrincipal:  boolean;
  r2KeyExists?:              boolean | null;
}

function detectIssues(
  placa:    any,
  pm:       any | null,
  r2Exists: boolean | null = null,
): AuditRecord {
  const hasPlateMedia             = !!pm;
  const activeKey: string | null  = pm?.activeKey ?? null;
  const plateMediaStatus: string | null = pm?.status ?? null;
  const hasLegacyImagemPrincipal  = typeof placa.imagemPrincipal === 'string' && placa.imagemPrincipal.trim().length > 0;
  const hasLegacyImagem           = typeof placa.imagem === 'string' && placa.imagem.trim().length > 0;
  const hasLegacyImagens          = Array.isArray(placa.imagens) && placa.imagens.length > 0;
  const issues: string[]          = [];

  if (!hasPlateMedia) {
    issues.push('NO_PLATE_MEDIA');
    if (hasLegacyImagemPrincipal || hasLegacyImagem || hasLegacyImagens) {
      issues.push('HAS_LEGACY_FIELDS_NO_MIGRATION');
    }
  } else if (!activeKey) {
    // activeKey null + status 'missing' = OK_CANONICAL_NO_IMAGE (placa sem foto intencionalmente)
    if (plateMediaStatus !== 'missing') {
      issues.push('MISSING_INVALID');
    }
  }

  if (hasLegacyImagemPrincipal) issues.push('LEGACY_IMAGEM_PRINCIPAL');
  if (hasLegacyImagem)          issues.push('LEGACY_IMAGEM');

  // Cenário E — divergência entre campo legado e PlateMedia.activeKey
  if (hasPlateMedia && activeKey && hasLegacyImagemPrincipal) {
    if (placa.imagemPrincipal.trim() !== activeKey) {
      issues.push('LEGACY_DIVERGES_FROM_PLATE_MEDIA');
    }
  }

  if (r2Exists === false && activeKey) issues.push('R2_KEY_NOT_FOUND');

  return {
    plateId:                  String(placa._id),
    issues,
    hasPlateMedia,
    activeKey,
    plateMediaStatus,
    legacyKey:                hasLegacyImagemPrincipal ? placa.imagemPrincipal.trim() : null,
    hasLegacyImagemPrincipal,
    r2KeyExists:              r2Exists,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

const EMPRESA_ID = '507f1f77bcf86cd799439010';
function makeId(suffix: string | number = 1) { return `507f1f77bcf86cd79943900${suffix}`; }

function makePlaca(overrides: Record<string, unknown> = {}): any {
  return { _id: makeId(1), empresaId: EMPRESA_ID, ...overrides };
}

function makePlateMediaDoc(plateId: string, activeKey: string | null = 'key/img.jpg'): any {
  return { plateId, activeKey, status: activeKey ? 'active' : 'missing' };
}

// ──────────────────────────────────────────────────────────────────────────────
// BLOCO 1 — resolveKey (função pura)
// ──────────────────────────────────────────────────────────────────────────────

describe('resolveKey — prioridade de campos', () => {
  it('retorna imagemPrincipal quando presente', () => {
    expect(resolveKey({ imagemPrincipal: 'key/a.jpg' })).toBe('key/a.jpg');
  });

  it('retorna imagem quando imagemPrincipal ausente', () => {
    expect(resolveKey({ imagem: 'key/b.jpg' })).toBe('key/b.jpg');
  });

  it('retorna storageKey quando imagemPrincipal e imagem ausentes', () => {
    expect(resolveKey({ storageKey: 'key/c.jpg' })).toBe('key/c.jpg');
  });

  it('retorna imagemKey quando campos anteriores ausentes', () => {
    expect(resolveKey({ imagemKey: 'key/d.jpg' })).toBe('key/d.jpg');
  });

  it('retorna r2Key quando todos os outros ausentes', () => {
    expect(resolveKey({ r2Key: 'key/e.jpg' })).toBe('key/e.jpg');
  });

  it('prefere imagemPrincipal sobre imagem', () => {
    expect(resolveKey({ imagemPrincipal: 'key/principal.jpg', imagem: 'key/imagem.jpg' }))
      .toBe('key/principal.jpg');
  });

  it('retorna imagens[isMain].storageKey quando não há campo direto', () => {
    const doc = {
      imagens: [
        { storageKey: 'key/gal1.jpg', isMain: false },
        { storageKey: 'key/gal2.jpg', isMain: true },
      ],
    };
    expect(resolveKey(doc)).toBe('key/gal2.jpg');
  });

  it('retorna imagens[0] quando nenhum isMain', () => {
    const doc = { imagens: [{ key: 'key/first.jpg' }, { key: 'key/second.jpg' }] };
    expect(resolveKey(doc)).toBe('key/first.jpg');
  });

  it('retorna null quando nenhum campo de imagem', () => {
    expect(resolveKey({})).toBeNull();
  });

  it('ignora strings vazias e whitespace', () => {
    expect(resolveKey({ imagemPrincipal: '   ', imagem: '' })).toBeNull();
  });

  it('faz trim do valor retornado', () => {
    expect(resolveKey({ imagemPrincipal: '  key/img.jpg  ' })).toBe('key/img.jpg');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// BLOCO 2 — CENÁRIO A: Placa com imagemPrincipal, sem PlateMedia
// ──────────────────────────────────────────────────────────────────────────────

describe('CENÁRIO A — Placa com imagemPrincipal sem PlateMedia', () => {
  it('[dry-run] conta migrated mas não chama createPlateMedia', async () => {
    const createFn = jest.fn();
    const plate    = makePlaca({ imagemPrincipal: 'key/img.jpg' });

    const report = await runMigration([plate], {
      isDryRun:         true,
      findExisting:     async () => null,
      createPlateMedia: createFn,
    });

    expect(report.total).toBe(1);
    expect(report.migrated).toBe(1);
    expect(report.skipped).toBe(0);
    expect(report.noImage).toBe(0);
    expect(createFn).not.toHaveBeenCalled();
  });

  it('[fix] chama createPlateMedia com a key correta', async () => {
    const createFn = jest.fn().mockResolvedValue(undefined);
    const plate    = makePlaca({ imagemPrincipal: 'key/img.jpg' });

    const report = await runMigration([plate], {
      isDryRun:         false,
      findExisting:     async () => null,
      createPlateMedia: createFn,
    });

    expect(report.migrated).toBe(1);
    expect(createFn).toHaveBeenCalledWith(String(plate._id), EMPRESA_ID, 'key/img.jpg');
  });

  it('auditoria detecta NO_PLATE_MEDIA + HAS_LEGACY_FIELDS_NO_MIGRATION', () => {
    const placa = makePlaca({ imagemPrincipal: 'key/img.jpg' });
    const rec   = detectIssues(placa, null);

    expect(rec.hasPlateMedia).toBe(false);
    expect(rec.issues).toContain('NO_PLATE_MEDIA');
    expect(rec.issues).toContain('HAS_LEGACY_FIELDS_NO_MIGRATION');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// BLOCO 3 — CENÁRIO B: Placa com imagemPrincipal E PlateMedia existente
// ──────────────────────────────────────────────────────────────────────────────

describe('CENÁRIO B — Placa com imagemPrincipal E PlateMedia existente', () => {
  it('[fix] pula e não chama createPlateMedia (não sobrescreve activeKey)', async () => {
    const createFn = jest.fn();
    const plate    = makePlaca({ imagemPrincipal: 'key/legacy.jpg' });
    const existing = makePlateMediaDoc(String(plate._id), 'key/canonical.jpg');

    const report = await runMigration([plate], {
      isDryRun:         false,
      findExisting:     async () => existing,
      createPlateMedia: createFn,
    });

    expect(report.skipped).toBe(1);
    expect(report.migrated).toBe(0);
    expect(createFn).not.toHaveBeenCalled();
  });

  it('auditoria: PlateMedia com activeKey — sem issue NO_PLATE_MEDIA', () => {
    const placa = makePlaca({ imagemPrincipal: 'key/legacy.jpg' });
    const pm    = makePlateMediaDoc(String(placa._id), 'key/canonical.jpg');
    const rec   = detectIssues(placa, pm);

    expect(rec.hasPlateMedia).toBe(true);
    expect(rec.activeKey).toBe('key/canonical.jpg');
    expect(rec.issues).not.toContain('NO_PLATE_MEDIA');
    expect(rec.issues).not.toContain('PLATE_MEDIA_NO_ACTIVE_KEY');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// BLOCO 4 — CENÁRIO C: PlateMedia.activeKey aponta para R2 inexistente
// ──────────────────────────────────────────────────────────────────────────────

describe('CENÁRIO C — PlateMedia.activeKey aponta para R2 inexistente', () => {
  it('[dry-run] conta brokenLegacy quando R2 retorna false e não cria PlateMedia', async () => {
    const createFn = jest.fn();
    const plate    = makePlaca({ imagemPrincipal: 'key/broken.jpg' });

    const report = await runMigration([plate], {
      isDryRun:         true,
      findExisting:     async () => null,
      createPlateMedia: createFn,
      verifyR2:         async () => false,
    });

    expect(report.brokenLegacy).toBe(1);
    expect(report.migrated).toBe(0);
    expect(createFn).not.toHaveBeenCalled();
  });

  it('[fix] não cria PlateMedia com activeKey apontando para R2 inexistente', async () => {
    const createFn = jest.fn();
    const plate    = makePlaca({ imagemPrincipal: 'key/broken.jpg' });

    const report = await runMigration([plate], {
      isDryRun:         false,
      findExisting:     async () => null,
      createPlateMedia: createFn,
      verifyR2:         async () => false,
    });

    expect(report.brokenLegacy).toBe(1);
    expect(createFn).not.toHaveBeenCalled();
  });

  it('auditoria com --checkR2 detecta R2_KEY_NOT_FOUND sem corrigir', () => {
    const placa = makePlaca();
    const pm    = makePlateMediaDoc(String(placa._id), 'key/broken.jpg');
    const rec   = detectIssues(placa, pm, /* r2Exists */ false);

    expect(rec.issues).toContain('R2_KEY_NOT_FOUND');
    expect(rec.activeKey).toBe('key/broken.jpg'); // chave inalterada no relatório
  });

  it('auditoria sem --checkR2 NÃO detecta R2_KEY_NOT_FOUND (opt-in)', () => {
    const placa = makePlaca();
    const pm    = makePlateMediaDoc(String(placa._id), 'key/broken.jpg');
    const rec   = detectIssues(placa, pm, /* r2Exists */ null);

    expect(rec.issues).not.toContain('R2_KEY_NOT_FOUND');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// BLOCO 5 — CENÁRIO D: Placa sem imagem
// ──────────────────────────────────────────────────────────────────────────────

describe('CENÁRIO D — Placa sem nenhuma imagem', () => {
  it('[dry-run] conta noImage e não chama createPlateMedia', async () => {
    const createFn = jest.fn();
    const plate    = makePlaca({ /* sem imagemPrincipal, imagem, imagens */ });

    const report = await runMigration([plate], {
      isDryRun:         true,
      findExisting:     async () => null,
      createPlateMedia: createFn,
    });

    expect(report.noImage).toBe(1);
    expect(report.migrated).toBe(0);
    expect(createFn).not.toHaveBeenCalled();
  });

  it('[fix] não cria PlateMedia para placa sem imagem', async () => {
    const createFn = jest.fn();
    const plate    = makePlaca({});

    await runMigration([plate], {
      isDryRun:         false,
      findExisting:     async () => null,
      createPlateMedia: createFn,
    });

    expect(createFn).not.toHaveBeenCalled();
  });

  it('auditoria: sem PlateMedia, sem campos legados → só NO_PLATE_MEDIA (sem HAS_LEGACY)', () => {
    const placa = makePlaca({});
    const rec   = detectIssues(placa, null);

    expect(rec.issues).toContain('NO_PLATE_MEDIA');
    expect(rec.issues).not.toContain('HAS_LEGACY_FIELDS_NO_MIGRATION');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// BLOCO 6 — CENÁRIO E: Divergência entre campo legado e PlateMedia.activeKey
// ──────────────────────────────────────────────────────────────────────────────

describe('CENÁRIO E — Divergência legacy vs PlateMedia.activeKey', () => {
  it('auditoria detecta LEGACY_DIVERGES_FROM_PLATE_MEDIA sem corrigir', () => {
    const placa = makePlaca({ imagemPrincipal: 'key/legacy.jpg' });
    const pm    = makePlateMediaDoc(String(placa._id), 'key/canonical-different.jpg');
    const rec   = detectIssues(placa, pm);

    expect(rec.issues).toContain('LEGACY_DIVERGES_FROM_PLATE_MEDIA');
    expect(rec.activeKey).toBe('key/canonical-different.jpg'); // inalterado
    expect(rec.legacyKey).toBe('key/legacy.jpg');             // inalterado
  });

  it('auditoria NÃO reporta divergência quando legacy === activeKey', () => {
    const KEY   = 'key/same.jpg';
    const placa = makePlaca({ imagemPrincipal: KEY });
    const pm    = makePlateMediaDoc(String(placa._id), KEY);
    const rec   = detectIssues(placa, pm);

    expect(rec.issues).not.toContain('LEGACY_DIVERGES_FROM_PLATE_MEDIA');
  });

  it('múltiplas placas inconsistentes: todas aparecem no relatório', () => {
    const plates = [
      { placa: makePlaca({ _id: makeId(1), imagemPrincipal: 'key/A.jpg' }),
        pm:    makePlateMediaDoc(makeId(1), 'key/B.jpg') },
      { placa: makePlaca({ _id: makeId(2), imagemPrincipal: 'key/C.jpg' }),
        pm:    makePlateMediaDoc(makeId(2), 'key/D.jpg') },
    ];

    const divergent = plates
      .map(({ placa, pm }) => detectIssues(placa, pm))
      .filter((r) => r.issues.includes('LEGACY_DIVERGES_FROM_PLATE_MEDIA'));

    expect(divergent).toHaveLength(2);
    // Confirma que não escolhe vencedor: ambas as keys preservadas intactas
    expect(divergent[0]!.activeKey).not.toBe(divergent[0]!.legacyKey);
    expect(divergent[1]!.activeKey).not.toBe(divergent[1]!.legacyKey);
  });

  it('migração não altera PlateMedia existente quando divergência existe (skip)', async () => {
    const createFn = jest.fn();
    const plate    = makePlaca({ imagemPrincipal: 'key/legacy.jpg' });
    const existing = makePlateMediaDoc(String(plate._id), 'key/canonical.jpg');

    const report = await runMigration([plate], {
      isDryRun:         false,
      findExisting:     async () => existing,
      createPlateMedia: createFn,
    });

    expect(report.skipped).toBe(1);
    expect(createFn).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// BLOCO 7 — Idempotência
// ──────────────────────────────────────────────────────────────────────────────

describe('Idempotência — segunda execução do migrate', () => {
  it('segunda execução skips tudo (nenhuma escrita adicional)', async () => {
    const createFn = jest.fn().mockResolvedValue(undefined);
    const plate    = makePlaca({ imagemPrincipal: 'key/img.jpg' });

    // Primeira execução
    const created: Record<string, any> = {};
    await runMigration([plate], {
      isDryRun:         false,
      findExisting:     async (id) => created[id] ?? null,
      createPlateMedia: async (id, _empId, key) => { created[id] = { plateId: id, activeKey: key }; },
    });

    // Segunda execução — PlateMedia já existe
    const secondRun = await runMigration([plate], {
      isDryRun:         false,
      findExisting:     async (id) => created[id] ?? null,
      createPlateMedia: createFn,
    });

    expect(secondRun.skipped).toBe(1);
    expect(secondRun.migrated).toBe(0);
    expect(createFn).not.toHaveBeenCalled();
  });

  it('dry-run repetido retorna sempre o mesmo relatório', async () => {
    const plates = [
      makePlaca({ _id: makeId(1), imagemPrincipal: 'key/1.jpg' }),
      makePlaca({ _id: makeId(2) }),
    ];

    const run1 = await runMigration(plates, {
      isDryRun: true, findExisting: async () => null, createPlateMedia: jest.fn(),
    });
    const run2 = await runMigration(plates, {
      isDryRun: true, findExisting: async () => null, createPlateMedia: jest.fn(),
    });

    expect(run1).toEqual(run2);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// BLOCO 8 — activeKey inválida / ausente
// ──────────────────────────────────────────────────────────────────────────────

describe('activeKey inválida ou ausente', () => {
  it('activeKey null com status missing → OK_CANONICAL_NO_IMAGE (sem issue)', () => {
    const placa = makePlaca({});
    const pm    = makePlateMediaDoc(String(placa._id), null); // status: 'missing'
    const rec   = detectIssues(placa, pm);

    expect(rec.hasPlateMedia).toBe(true);
    expect(rec.activeKey).toBeNull();
    expect(rec.plateMediaStatus).toBe('missing');
    expect(rec.issues).not.toContain('PLATE_MEDIA_NO_ACTIVE_KEY');
    expect(rec.issues).not.toContain('MISSING_INVALID');
  });

  it('activeKey null com status active → MISSING_INVALID (BLOQUEADOR)', () => {
    const placa = makePlaca({});
    const pm    = { plateId: String(placa._id), activeKey: null, status: 'active' };
    const rec   = detectIssues(placa, pm);

    expect(rec.issues).toContain('MISSING_INVALID');
    expect(rec.hasPlateMedia).toBe(true);
  });

  it('activeKey null com status processing → MISSING_INVALID (BLOQUEADOR)', () => {
    const placa = makePlaca({});
    const pm    = { plateId: String(placa._id), activeKey: null, status: 'processing' };
    const rec   = detectIssues(placa, pm);

    expect(rec.issues).toContain('MISSING_INVALID');
  });

  it('activeKey string vazia com status missing → OK_CANONICAL_NO_IMAGE (sem issue)', () => {
    const placa = makePlaca({});
    const pm    = { plateId: String(placa._id), activeKey: '', status: 'missing' };
    const rec   = detectIssues(placa, pm);

    expect(rec.issues).not.toContain('MISSING_INVALID');
    expect(rec.issues).not.toContain('PLATE_MEDIA_NO_ACTIVE_KEY');
  });

  it('migração não cria PlateMedia quando resolveKey retorna apenas whitespace', async () => {
    const createFn = jest.fn();
    const plate    = makePlaca({ imagemPrincipal: '   ' });

    const report = await runMigration([plate], {
      isDryRun:         false,
      findExisting:     async () => null,
      createPlateMedia: createFn,
    });

    expect(report.noImage).toBe(1);
    expect(createFn).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// BLOCO 9 — Dry-run não persiste nada
// ──────────────────────────────────────────────────────────────────────────────

describe('Dry-run — garantia de não mutação', () => {
  it('dry-run nunca chama createPlateMedia mesmo com 10 placas pendentes', async () => {
    const createFn = jest.fn();
    const plates   = Array.from({ length: 10 }, (_, i) =>
      makePlaca({ _id: makeId(i), imagemPrincipal: `key/${i}.jpg` }),
    );

    const report = await runMigration(plates, {
      isDryRun:         true,
      findExisting:     async () => null,
      createPlateMedia: createFn,
    });

    expect(report.migrated).toBe(10);
    expect(createFn).not.toHaveBeenCalled();
  });

  it('dry-run com mix de cenários: contagens corretas, sem mutação', async () => {
    const createFn = jest.fn();
    const plates = [
      makePlaca({ _id: makeId(1), imagemPrincipal: 'key/1.jpg' }),  // migrateable
      makePlaca({ _id: makeId(2) }),                                  // noImage
      makePlaca({ _id: makeId(3), imagemPrincipal: 'key/3.jpg' }),  // skip (existing)
    ];
    const existingIds = new Set([makeId(3)]);

    const report = await runMigration(plates, {
      isDryRun:         true,
      findExisting:     async (id) => existingIds.has(id) ? { plateId: id } : null,
      createPlateMedia: createFn,
    });

    expect(report.total).toBe(3);
    expect(report.migrated).toBe(1);
    expect(report.skipped).toBe(1);
    expect(report.noImage).toBe(1);
    expect(createFn).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// BLOCO 10 — Guarda do remove-legacy (lógica de pré-validação)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Simula a guarda de cobertura usada em remove-legacy-plate-images.ts
 * (após a correção: usa IDs exatos, não contagem global).
 */
function checkRemoveLegacyGuard(
  activePlacaIds: string[],
  plateMediaPlateIds: string[],
): { canProceed: boolean; missing: number } {
  const mediaSet  = new Set(plateMediaPlateIds);
  const missing   = activePlacaIds.filter((id) => !mediaSet.has(id)).length;
  return { canProceed: missing === 0, missing };
}

describe('Guarda do remove-legacy — pré-validação de cobertura', () => {
  it('bloqueia quando alguma placa ativa não tem PlateMedia', () => {
    const placaIds = [makeId(1), makeId(2), makeId(3)];
    const mediaIds = [makeId(1), makeId(2)]; // makeId(3) ausente

    const result = checkRemoveLegacyGuard(placaIds, mediaIds);
    expect(result.canProceed).toBe(false);
    expect(result.missing).toBe(1);
  });

  it('permite quando todas as placas ativas têm PlateMedia', () => {
    const ids    = [makeId(1), makeId(2), makeId(3)];
    const result = checkRemoveLegacyGuard(ids, ids);

    expect(result.canProceed).toBe(true);
    expect(result.missing).toBe(0);
  });

  it('não é enganada por PlateMedia de placas arquivadas (órfãos)', () => {
    // Cenário que o bug original permitia: contagem global > ativas
    // Placas ativas: 2; PlateMedia total (incluindo archived): 5
    const activePlacaIds  = [makeId(1), makeId(2)];
    const allMediaIds     = [makeId(1), makeId(3), makeId(4), makeId(5), makeId(6)];
    // makeId(2) não tem PlateMedia — deveria bloquear

    const result = checkRemoveLegacyGuard(activePlacaIds, allMediaIds);
    expect(result.canProceed).toBe(false);
    expect(result.missing).toBe(1);
  });

  it('permite conjunto vazio (base já limpa)', () => {
    const result = checkRemoveLegacyGuard([], []);
    expect(result.canProceed).toBe(true);
    expect(result.missing).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// BLOCO 11 — Auditoria completa: resumo multi-placa
// ──────────────────────────────────────────────────────────────────────────────

describe('Auditoria — resumo multi-placa', () => {
  it('resume correto após migração completa (sem pendências)', () => {
    const KEY = 'key/canonical.jpg';
    const plates = [
      { placa: makePlaca({ _id: makeId(1), imagemPrincipal: KEY }),
        pm:    makePlateMediaDoc(makeId(1), KEY) },
      { placa: makePlaca({ _id: makeId(2) }),
        pm:    makePlateMediaDoc(makeId(2), 'key/2.jpg') },
    ];

    const records = plates.map(({ placa, pm }) => detectIssues(placa, pm));

    const noMedia  = records.filter((r) => !r.hasPlateMedia).length;
    const noKey    = records.filter((r) => r.hasPlateMedia && !r.activeKey).length;
    const diverged = records.filter((r) => r.issues.includes('LEGACY_DIVERGES_FROM_PLATE_MEDIA')).length;

    expect(noMedia).toBe(0);
    expect(noKey).toBe(0);
    expect(diverged).toBe(0);
  });

  it('resume correto com mix de todos os cenários', () => {
    const scenarios = [
      // A: sem PlateMedia, com legado
      { placa: makePlaca({ _id: makeId(1), imagemPrincipal: 'key/A.jpg' }), pm: null },
      // B: PlateMedia OK, sem divergência
      { placa: makePlaca({ _id: makeId(2), imagemPrincipal: 'key/B.jpg' }),
        pm:    makePlateMediaDoc(makeId(2), 'key/B.jpg') },
      // D: sem imagem, sem PlateMedia
      { placa: makePlaca({ _id: makeId(4) }), pm: null },
      // E: divergência
      { placa: makePlaca({ _id: makeId(5), imagemPrincipal: 'key/E-legacy.jpg' }),
        pm:    makePlateMediaDoc(makeId(5), 'key/E-canonical.jpg') },
    ];

    const records = scenarios.map(({ placa, pm }) => detectIssues(placa, pm));

    expect(records.filter((r) => r.issues.includes('NO_PLATE_MEDIA'))).toHaveLength(2);
    expect(records.filter((r) => r.issues.includes('HAS_LEGACY_FIELDS_NO_MIGRATION'))).toHaveLength(1);
    expect(records.filter((r) => r.issues.includes('LEGACY_DIVERGES_FROM_PLATE_MEDIA'))).toHaveLength(1);
    expect(records.filter((r) => r.hasPlateMedia && !!r.activeKey && !r.issues.includes('LEGACY_DIVERGES_FROM_PLATE_MEDIA'))).toHaveLength(1);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// BLOCO 12 — FASE 4: contrato de flags do migrate-plate-media.ts
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Replica a lógica de parseamento de flags introduzida na v1.1.0 do script.
 * Testa o contrato sem precisar importar o módulo (que tem side-effects de conexão).
 */
function parseMigrateFlags(argv: string[]): { isDryRun: boolean; verifyR2: boolean } | never {
  const hasFix     = argv.includes('--fix');
  const hasDryRun  = argv.includes('--dry-run');
  const verifyR2   = argv.includes('--verify');

  if (hasFix && hasDryRun) {
    throw new Error('CONFLICT: --fix e --dry-run não podem ser usados juntos');
  }

  const isDryRun = hasDryRun || !hasFix;
  return { isDryRun, verifyR2 };
}

describe('FASE 4 — Contrato de flags do migrate-plate-media', () => {
  it('--dry-run explícito → isDryRun=true', () => {
    const { isDryRun } = parseMigrateFlags(['--dry-run']);
    expect(isDryRun).toBe(true);
  });

  it('sem flags → isDryRun=true (dry-run por padrão)', () => {
    const { isDryRun } = parseMigrateFlags([]);
    expect(isDryRun).toBe(true);
  });

  it('--fix → isDryRun=false (modo mutação)', () => {
    const { isDryRun } = parseMigrateFlags(['--fix']);
    expect(isDryRun).toBe(false);
  });

  it('--fix --dry-run juntos → lança erro (conflito)', () => {
    expect(() => parseMigrateFlags(['--fix', '--dry-run'])).toThrow('CONFLICT');
  });

  it('--dry-run --fix (ordem invertida) → também lança erro', () => {
    expect(() => parseMigrateFlags(['--dry-run', '--fix'])).toThrow('CONFLICT');
  });

  it('--dry-run --verify → isDryRun=true, verifyR2=true', () => {
    const flags = parseMigrateFlags(['--dry-run', '--verify']);
    expect(flags.isDryRun).toBe(true);
    expect(flags.verifyR2).toBe(true);
  });

  it('--fix --verify → isDryRun=false, verifyR2=true', () => {
    const flags = parseMigrateFlags(['--fix', '--verify']);
    expect(flags.isDryRun).toBe(false);
    expect(flags.verifyR2).toBe(true);
  });

  it('flags desconhecidas são ignoradas sem alterar o modo', () => {
    const flags = parseMigrateFlags(['--unknown', '--whatever=123']);
    expect(flags.isDryRun).toBe(true);
    expect(flags.verifyR2).toBe(false);
  });

  it('dry-run com verifyR2=true nunca chama createPlateMedia mesmo com key válida', async () => {
    const createFn = jest.fn();
    const plate    = makePlaca({ imagemPrincipal: 'key/img.jpg' });
    const { isDryRun } = parseMigrateFlags(['--dry-run', '--verify']);

    const report = await runMigration([plate], {
      isDryRun,
      findExisting:     async () => null,
      createPlateMedia: createFn,
      verifyR2:         async () => true,
    });

    expect(isDryRun).toBe(true);
    expect(report.migrated).toBe(1);
    expect(createFn).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Helpers FASE 7 — resumo de métricas canônicas e guarda de remoção
// ──────────────────────────────────────────────────────────────────────────────

function buildAuditSummary(records: AuditRecord[]) {
  return {
    totalPlates:                    records.length,
    totalWithPlateMedia:            records.filter((r) => r.hasPlateMedia).length,
    totalWithoutPlateMedia:         records.filter((r) => !r.hasPlateMedia).length,
    totalWithActiveKey:             records.filter((r) => !!r.activeKey).length,
    totalWithoutActiveKey:          records.filter((r) => !r.activeKey).length,
    totalMissingCanonical:          records.filter((r) => r.hasPlateMedia && !r.activeKey && r.plateMediaStatus === 'missing').length,
    totalMissingInvalid:            records.filter((r) => r.issues.includes('MISSING_INVALID')).length,
    totalBrokenR2:                  records.filter((r) => r.issues.includes('R2_KEY_NOT_FOUND')).length,
    totalLegacyDivergesFromPlateMedia: records.filter((r) => r.issues.includes('LEGACY_DIVERGES_FROM_PLATE_MEDIA')).length,
  };
}

function isReadyForLegacyRemoval(summary: ReturnType<typeof buildAuditSummary>): boolean {
  return (
    summary.totalWithoutPlateMedia === 0 &&
    summary.totalMissingInvalid === 0 &&
    summary.totalBrokenR2 === 0 &&
    summary.totalLegacyDivergesFromPlateMedia === 0
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// BLOCO 13 — FASE 7: status missing canônico vs inválido
// ──────────────────────────────────────────────────────────────────────────────

describe('FASE 7 — missing canônico vs inválido', () => {
  it('missing canônico (activeKey null + status missing) não bloqueia remoção legacy', () => {
    const placa = makePlaca({});
    const pm    = { plateId: String(placa._id), activeKey: null, status: 'missing' };
    const rec   = detectIssues(placa, pm);

    expect(rec.issues).not.toContain('MISSING_INVALID');
    expect(rec.plateMediaStatus).toBe('missing');
    expect(isReadyForLegacyRemoval(buildAuditSummary([rec]))).toBe(true);
  });

  it('activeKey null com status active bloqueia remoção legacy', () => {
    const placa = makePlaca({});
    const pm    = { plateId: String(placa._id), activeKey: null, status: 'active' };
    const rec   = detectIssues(placa, pm);

    expect(rec.issues).toContain('MISSING_INVALID');
    expect(isReadyForLegacyRemoval(buildAuditSummary([rec]))).toBe(false);
  });

  it('activeKey null sem status bloqueia remoção legacy', () => {
    const placa = makePlaca({});
    const pm    = { plateId: String(placa._id), activeKey: null, status: undefined };
    const rec   = detectIssues(placa, pm);

    expect(rec.issues).toContain('MISSING_INVALID');
    expect(isReadyForLegacyRemoval(buildAuditSummary([rec]))).toBe(false);
  });

  it('activeKey quebrada no R2 bloqueia remoção legacy', () => {
    const placa = makePlaca({});
    const pm    = makePlateMediaDoc(String(placa._id), 'key/broken.jpg');
    const rec   = detectIssues(placa, pm, /* r2Exists */ false);

    expect(rec.issues).toContain('R2_KEY_NOT_FOUND');
    expect(isReadyForLegacyRemoval(buildAuditSummary([rec]))).toBe(false);
  });

  it('divergência legacy vs PlateMedia bloqueia remoção legacy', () => {
    const placa = makePlaca({ imagemPrincipal: 'key/legacy.jpg' });
    const pm    = makePlateMediaDoc(String(placa._id), 'key/canonical.jpg');
    const rec   = detectIssues(placa, pm);

    expect(rec.issues).toContain('LEGACY_DIVERGES_FROM_PLATE_MEDIA');
    expect(isReadyForLegacyRemoval(buildAuditSummary([rec]))).toBe(false);
  });

  it('totalWithoutActiveKey > 0 não bloqueia se todos forem missing canônico', () => {
    const plates = [
      { placa: makePlaca({ _id: makeId(1) }), pm: { plateId: makeId(1), activeKey: null, status: 'missing' } },
      { placa: makePlaca({ _id: makeId(2) }), pm: { plateId: makeId(2), activeKey: null, status: 'missing' } },
      { placa: makePlaca({ _id: makeId(3) }), pm: makePlateMediaDoc(makeId(3), 'key/3.jpg') },
    ];

    const records = plates.map(({ placa, pm }) => detectIssues(placa, pm));
    const summary = buildAuditSummary(records);

    expect(summary.totalWithoutActiveKey).toBe(2);
    expect(summary.totalMissingCanonical).toBe(2);
    expect(summary.totalMissingInvalid).toBe(0);
    expect(isReadyForLegacyRemoval(summary)).toBe(true);
  });

  it('mix: 6 missing canônicos + 32 com activeKey = pronto para remoção', () => {
    const canonicals = Array.from({ length: 6 }, (_, i) => ({
      placa: makePlaca({ _id: makeId(i) }),
      pm:    { plateId: makeId(i), activeKey: null, status: 'missing' },
    }));
    const actives = Array.from({ length: 32 }, (_, i) => ({
      placa: makePlaca({ _id: makeId(i + 10) }),
      pm:    makePlateMediaDoc(makeId(i + 10), `key/${i}.jpg`),
    }));

    const records = [...canonicals, ...actives].map(({ placa, pm }) => detectIssues(placa, pm));
    const summary = buildAuditSummary(records);

    expect(summary.totalPlates).toBe(38);
    expect(summary.totalWithoutActiveKey).toBe(6);
    expect(summary.totalMissingCanonical).toBe(6);
    expect(summary.totalMissingInvalid).toBe(0);
    expect(isReadyForLegacyRemoval(summary)).toBe(true);
  });
});
