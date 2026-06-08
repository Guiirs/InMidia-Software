/**
 * plate-media-repair.test.ts — FASE 5
 *
 * Testa o contrato do script repair-plate-media-missing.ts.
 *
 * Cobre:
 *   1.  parseRepairFlags: --dry-run não muta
 *   2.  parseRepairFlags: sem flags → isDryRun=true
 *   3.  parseRepairFlags: --fix → isDryRun=false
 *   4.  parseRepairFlags: --fix --dry-run → lança erro (CONFLICT)
 *   5.  parseRepairFlags: --dry-run --fix (ordem invertida) → lança erro
 *   6.  parseRepairFlags: --verifyR2 detectado corretamente
 *   7.  parseRepairFlags: --plateIds parseado corretamente
 *   8.  repairPlate CASO 1: dry-run — placa sem PlateMedia → conta createdMissing, não chama create
 *   9.  repairPlate CASO 1: fix — placa sem PlateMedia → chama createMissingPlateMedia
 *  10.  repairPlate CASO 1: fix — empresaId inválido → retorna error
 *  11.  repairPlate CASO 2: PlateMedia já missing (activeKey=null) → alreadyMissing, sem ação
 *  12.  repairPlate CASO 3: fix sem verifyR2 — confia no caller, chama clearBrokenKey
 *  13.  repairPlate CASO 3: fix com verifyR2 — key válida no R2 → skippedValidKey, não limpa
 *  14.  repairPlate CASO 3: fix com verifyR2 — key quebrada no R2 → chama clearBrokenKey
 *  15.  repairPlate: placa não encontrada → skippedNoPlate
 *  16.  repairPlate: plateId inválido → error invalid_objectid
 *  17.  Idempotência: segunda execução → alreadyMissing (não duplica PlateMedia)
 *  18.  empresaId: createMissingPlateMedia recebe empresaId correto da Placa
 *  19.  clearBrokenKey: move key para history, não apaga R2
 *  20.  Dry-run com mix de todos os casos: zero mutações
 */

// ── Imports ────────────────────────────────────────────────────────────────────

import { Types } from 'mongoose';
import {
  parseRepairFlags,
  repairPlate,
  type RepairPlateOpts,
} from '../../../scripts/repair-plate-media-missing';

// ── Helpers ────────────────────────────────────────────────────────────────────

const VALID_ID_1 = new Types.ObjectId().toString();
const VALID_ID_2 = new Types.ObjectId().toString();
const VALID_ID_3 = new Types.ObjectId().toString();
const EMPRESA_ID = new Types.ObjectId().toString();
const BROKEN_KEY = 'empresas/emp/plates/abc/history/broken.png';
const VALID_KEY  = 'empresas/emp/plates/abc/main/valid.jpg';

function makePlacaStub(id = VALID_ID_1, empresaId = EMPRESA_ID) {
  return { _id: id, empresaId, numero_placa: `Placa-${id.slice(-4)}` };
}

function makeOpts(overrides: Partial<RepairPlateOpts> = {}): RepairPlateOpts {
  return {
    isDryRun:               true,
    verifyR2:               false,
    reason:                 'test',
    getPlaca:               async () => makePlacaStub(),
    getPlateMedia:          async () => null,
    checkR2:                async () => false,
    createMissingPlateMedia: jest.fn().mockResolvedValue(undefined),
    clearBrokenKey:         jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ── BLOCO 1 — parseRepairFlags ─────────────────────────────────────────────────

describe('parseRepairFlags', () => {
  it('--dry-run explícito → isDryRun=true', () => {
    expect(parseRepairFlags(['--dry-run', '--plateIds=abc']).isDryRun).toBe(true);
  });

  it('sem flags → isDryRun=true (padrão seguro)', () => {
    expect(parseRepairFlags(['--plateIds=abc']).isDryRun).toBe(true);
  });

  it('--fix → isDryRun=false', () => {
    expect(parseRepairFlags(['--fix', '--plateIds=abc']).isDryRun).toBe(false);
  });

  it('--fix --dry-run → lança CONFLICT', () => {
    expect(() => parseRepairFlags(['--fix', '--dry-run'])).toThrow('CONFLICT');
  });

  it('--dry-run --fix (ordem invertida) → lança CONFLICT', () => {
    expect(() => parseRepairFlags(['--dry-run', '--fix'])).toThrow('CONFLICT');
  });

  it('--verifyR2 → verifyR2=true', () => {
    expect(parseRepairFlags(['--verifyR2', '--plateIds=abc']).verifyR2).toBe(true);
  });

  it('sem --verifyR2 → verifyR2=false', () => {
    expect(parseRepairFlags(['--plateIds=abc']).verifyR2).toBe(false);
  });

  it('--plateIds=id1,id2,id3 → array com 3 elementos', () => {
    const { plateIds } = parseRepairFlags([`--plateIds=${VALID_ID_1},${VALID_ID_2},${VALID_ID_3}`]);
    expect(plateIds).toHaveLength(3);
    expect(plateIds[0]).toBe(VALID_ID_1);
  });

  it('--plateIds ausente → array vazio', () => {
    expect(parseRepairFlags([]).plateIds).toHaveLength(0);
  });

  it('--reason= capturado corretamente', () => {
    const { reason } = parseRepairFlags(['--reason=fase5_repair']);
    expect(reason).toBe('fase5_repair');
  });

  it('--reason ausente → default manual_repair', () => {
    const { reason } = parseRepairFlags([]);
    expect(reason).toBe('manual_repair');
  });
});

// ── BLOCO 2 — repairPlate: CASO 1 (sem PlateMedia) ───────────────────────────

describe('repairPlate — CASO 1: placa sem PlateMedia', () => {
  it('[dry-run] retorna createdMissing sem chamar createMissingPlateMedia', async () => {
    const createFn = jest.fn();
    const opts     = makeOpts({ isDryRun: true, createMissingPlateMedia: createFn });

    const result = await repairPlate(VALID_ID_1, opts);

    expect(result.action).toBe('createdMissing');
    expect(createFn).not.toHaveBeenCalled();
  });

  it('[fix] retorna createdMissing e chama createMissingPlateMedia', async () => {
    const createFn = jest.fn().mockResolvedValue(undefined);
    const opts     = makeOpts({ isDryRun: false, createMissingPlateMedia: createFn });

    const result = await repairPlate(VALID_ID_1, opts);

    expect(result.action).toBe('createdMissing');
    expect(createFn).toHaveBeenCalledTimes(1);
    expect(createFn).toHaveBeenCalledWith(VALID_ID_1, EMPRESA_ID);
  });

  it('[fix] respeita empresaId da Placa — passa empresaId correto para createMissingPlateMedia', async () => {
    const OTHER_EMPRESA = new Types.ObjectId().toString();
    const createFn = jest.fn().mockResolvedValue(undefined);
    const opts = makeOpts({
      isDryRun:               false,
      getPlaca:               async () => ({ _id: VALID_ID_1, empresaId: OTHER_EMPRESA }),
      createMissingPlateMedia: createFn,
    });

    await repairPlate(VALID_ID_1, opts);

    expect(createFn).toHaveBeenCalledWith(VALID_ID_1, OTHER_EMPRESA);
  });

  it('[fix] empresaId inválido → retorna error', async () => {
    const createFn = jest.fn();
    const opts = makeOpts({
      isDryRun: false,
      getPlaca: async () => ({ _id: VALID_ID_1, empresaId: 'not-valid-oid' }),
      createMissingPlateMedia: createFn,
    });

    const result = await repairPlate(VALID_ID_1, opts);

    expect(result.action).toBe('error');
    expect(result.reason).toBe('empresaId_invalid');
    expect(createFn).not.toHaveBeenCalled();
  });
});

// ── BLOCO 3 — repairPlate: CASO 2 (PlateMedia já missing) ────────────────────

describe('repairPlate — CASO 2: PlateMedia já missing', () => {
  it('retorna alreadyMissing quando activeKey é null', async () => {
    const clearFn = jest.fn();
    const opts    = makeOpts({
      isDryRun:      false,
      getPlateMedia: async () => ({ activeKey: null }),
      clearBrokenKey: clearFn,
    });

    const result = await repairPlate(VALID_ID_1, opts);

    expect(result.action).toBe('alreadyMissing');
    expect(clearFn).not.toHaveBeenCalled();
  });

  it('retorna alreadyMissing quando activeKey é string vazia', async () => {
    const opts = makeOpts({
      isDryRun:      false,
      getPlateMedia: async () => ({ activeKey: '' }),
    });
    // '' é falsy → mesmo tratamento que null
    const result = await repairPlate(VALID_ID_1, opts);
    expect(result.action).toBe('alreadyMissing');
  });
});

// ── BLOCO 4 — repairPlate: CASO 3 (activeKey presente) ───────────────────────

describe('repairPlate — CASO 3: PlateMedia com activeKey', () => {
  it('[fix] sem --verifyR2 → confia no caller, chama clearBrokenKey', async () => {
    const clearFn = jest.fn().mockResolvedValue(undefined);
    const checkR2 = jest.fn();
    const opts    = makeOpts({
      isDryRun:       false,
      verifyR2:       false,
      getPlateMedia:  async () => ({ activeKey: BROKEN_KEY }),
      checkR2,
      clearBrokenKey: clearFn,
    });

    const result = await repairPlate(VALID_ID_1, opts);

    expect(result.action).toBe('clearedBrokenKey');
    expect(clearFn).toHaveBeenCalledTimes(1);
    expect(checkR2).not.toHaveBeenCalled(); // não verifica R2
  });

  it('[fix] --verifyR2 + key válida no R2 → retorna skippedValidKey, não limpa', async () => {
    const clearFn = jest.fn();
    const opts    = makeOpts({
      isDryRun:       false,
      verifyR2:       true,
      getPlateMedia:  async () => ({ activeKey: VALID_KEY }),
      checkR2:        async () => true,
      clearBrokenKey: clearFn,
    });

    const result = await repairPlate(VALID_ID_1, opts);

    expect(result.action).toBe('skippedValidKey');
    expect(clearFn).not.toHaveBeenCalled();
  });

  it('[fix] --verifyR2 + key quebrada no R2 → chama clearBrokenKey', async () => {
    const clearFn = jest.fn().mockResolvedValue(undefined);
    const opts    = makeOpts({
      isDryRun:       false,
      verifyR2:       true,
      getPlateMedia:  async () => ({ activeKey: BROKEN_KEY, mimeType: 'image/png', size: 12345 }),
      checkR2:        async () => false,
      clearBrokenKey: clearFn,
    });

    const result = await repairPlate(VALID_ID_1, opts);

    expect(result.action).toBe('clearedBrokenKey');
    expect(clearFn).toHaveBeenCalledWith(VALID_ID_1, BROKEN_KEY, 'image/png', 12345);
  });

  it('[dry-run] com activeKey quebrada → retorna clearedBrokenKey sem chamar clearBrokenKey', async () => {
    const clearFn = jest.fn();
    const opts    = makeOpts({
      isDryRun:       true,
      verifyR2:       false,
      getPlateMedia:  async () => ({ activeKey: BROKEN_KEY }),
      clearBrokenKey: clearFn,
    });

    const result = await repairPlate(VALID_ID_1, opts);

    expect(result.action).toBe('clearedBrokenKey');
    expect(clearFn).not.toHaveBeenCalled();
  });

  it('[dry-run] --verifyR2 + key válida → skippedValidKey sem mutação', async () => {
    const clearFn = jest.fn();
    const opts    = makeOpts({
      isDryRun:       true,
      verifyR2:       true,
      getPlateMedia:  async () => ({ activeKey: VALID_KEY }),
      checkR2:        async () => true,
      clearBrokenKey: clearFn,
    });

    const result = await repairPlate(VALID_ID_1, opts);

    expect(result.action).toBe('skippedValidKey');
    expect(clearFn).not.toHaveBeenCalled();
  });
});

// ── BLOCO 5 — repairPlate: casos de borda ────────────────────────────────────

describe('repairPlate — casos de borda', () => {
  it('placa não encontrada → retorna skippedNoPlate', async () => {
    const opts = makeOpts({ getPlaca: async () => null });
    const result = await repairPlate(VALID_ID_1, opts);
    expect(result.action).toBe('skippedNoPlate');
  });

  it('plateId inválido → retorna error invalid_objectid', async () => {
    const result = await repairPlate('not-a-valid-id', makeOpts());
    expect(result.action).toBe('error');
    expect(result.reason).toBe('invalid_objectid');
  });

  it('plateId inválido não chama getPlaca', async () => {
    const getPlaca = jest.fn();
    await repairPlate('bad-id', makeOpts({ getPlaca }));
    expect(getPlaca).not.toHaveBeenCalled();
  });
});

// ── BLOCO 6 — Idempotência ────────────────────────────────────────────────────

describe('Idempotência', () => {
  it('segunda execução após --fix → alreadyMissing (PlateMedia já existe com activeKey=null)', async () => {
    const store: Record<string, { activeKey: string | null }> = {};

    const opts: RepairPlateOpts = {
      isDryRun: false,
      verifyR2: false,
      reason:   'test',
      getPlaca:               async () => makePlacaStub(),
      getPlateMedia:          async (id) => store[id] ?? null,
      checkR2:                async () => false,
      createMissingPlateMedia: async (id) => { store[id] = { activeKey: null }; },
      clearBrokenKey:          jest.fn(),
    };

    // Primeira execução
    const first = await repairPlate(VALID_ID_1, opts);
    expect(first.action).toBe('createdMissing');
    expect(store[VALID_ID_1]).toEqual({ activeKey: null });

    // Segunda execução — PlateMedia já existe com activeKey=null
    const second = await repairPlate(VALID_ID_1, opts);
    expect(second.action).toBe('alreadyMissing');
  });

  it('clearBrokenKey idempotente: segunda execução → alreadyMissing (activeKey já null)', async () => {
    const store: Record<string, { activeKey: string | null }> = {
      [VALID_ID_1]: { activeKey: BROKEN_KEY },
    };

    const opts: RepairPlateOpts = {
      isDryRun: false,
      verifyR2: false,
      reason:   'test',
      getPlaca:               async () => makePlacaStub(),
      getPlateMedia:          async (id) => store[id] ?? null,
      checkR2:                async () => false,
      createMissingPlateMedia: jest.fn(),
      clearBrokenKey:          async (id) => { store[id] = { activeKey: null }; },
    };

    const first = await repairPlate(VALID_ID_1, opts);
    expect(first.action).toBe('clearedBrokenKey');

    const second = await repairPlate(VALID_ID_1, opts);
    expect(second.action).toBe('alreadyMissing');
  });
});

// ── BLOCO 7 — Dry-run mix: zero mutações ─────────────────────────────────────

describe('Dry-run — zero mutações para qualquer combinação de casos', () => {
  it('nenhuma mutação com mix de Caso1, Caso2, Caso3', async () => {
    const createFn = jest.fn();
    const clearFn  = jest.fn();

    const plateMediaStore: Record<string, { activeKey: string | null }> = {
      [VALID_ID_2]: { activeKey: null    }, // Caso 2: já missing
      [VALID_ID_3]: { activeKey: BROKEN_KEY }, // Caso 3: broken
    };

    const baseOpts: RepairPlateOpts = {
      isDryRun:               true,
      verifyR2:               false,
      reason:                 'test',
      getPlaca:               async () => makePlacaStub(),
      getPlateMedia:          async (id) => plateMediaStore[id] ?? null,
      checkR2:                async () => false,
      createMissingPlateMedia: createFn,
      clearBrokenKey:          clearFn,
    };

    const results = await Promise.all([
      repairPlate(VALID_ID_1, baseOpts), // Caso 1: sem PlateMedia
      repairPlate(VALID_ID_2, baseOpts), // Caso 2: já missing
      repairPlate(VALID_ID_3, baseOpts), // Caso 3: broken key
    ]);

    expect(results.map(r => r.action)).toEqual(['createdMissing', 'alreadyMissing', 'clearedBrokenKey']);
    expect(createFn).not.toHaveBeenCalled();
    expect(clearFn).not.toHaveBeenCalled();
  });
});

// ── BLOCO 8 — clearBrokenKey preserva evidência (history) ────────────────────

describe('clearBrokenKey — preservação de evidência', () => {
  it('chama clearBrokenKey com a brokenKey e metadata do PlateMedia original', async () => {
    const clearFn = jest.fn().mockResolvedValue(undefined);
    const PM_DATA = { activeKey: BROKEN_KEY, mimeType: 'image/png', size: 88888 };

    const opts = makeOpts({
      isDryRun:       false,
      verifyR2:       false,
      getPlateMedia:  async () => PM_DATA,
      clearBrokenKey: clearFn,
    });

    await repairPlate(VALID_ID_1, opts);

    // O script deve passar key, mimeType e size para que clearBrokenKey possa registrar no history
    expect(clearFn).toHaveBeenCalledWith(VALID_ID_1, BROKEN_KEY, 'image/png', 88888);
  });

  it('não chama clearBrokenKey quando dry-run (key não apagada, sem evidência forjada)', async () => {
    const clearFn = jest.fn();
    const opts    = makeOpts({
      isDryRun:       true,
      getPlateMedia:  async () => ({ activeKey: BROKEN_KEY }),
      clearBrokenKey: clearFn,
    });

    await repairPlate(VALID_ID_1, opts);
    expect(clearFn).not.toHaveBeenCalled();
  });
});
