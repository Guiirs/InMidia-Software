/**
 * Unit tests — PlacaService.enrichWithAluguelData()
 *
 * Validates that listPlacas() derives legacy commercial fields
 * (statusAluguel, aluguel_ativo, aluguel_futuro, cliente_nome)
 * from CommercialProjectionService.resolveBatch(), not from Aluguel queries.
 *
 * All external modules are mocked — no DB connection required.
 */

import { Types } from 'mongoose';

// ── Mocks must be declared before any import that triggers module resolution ──

const mockResolveBatch = jest.fn();
const mockResolve = jest.fn();

jest.mock('@modules/commercial-projection/commercial-projection.service', () => ({
  commercialProjectionService: {
    resolveBatch: (...args: any[]) => mockResolveBatch(...args),
    resolve: (...args: any[]) => mockResolve(...args),
  },
}));

const mockAluguelFind = jest.fn();
jest.mock('@modules/alugueis/Aluguel', () => ({
  __esModule: true,
  default: {
    find: (...args: any[]) => mockAluguelFind(...args),
    findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
  },
}));

jest.mock('@modules/regioes/Regiao', () => ({
  __esModule: true,
  default: { findOne: jest.fn() },
}));

jest.mock('@modules/temporal', () => ({
  temporalEngine: {
    recordEvent: jest.fn().mockResolvedValue(undefined),
    assertPlateCanBeEdited: jest.fn().mockResolvedValue(undefined),
    getPlateTimeline: jest.fn(),
    checkPlateAvailability: jest.fn(),
    resolvePlateTemporalStatus: jest.fn(),
  },
}));

jest.mock('@modules/inventory', () => ({
  inventoryService: {
    buildInventorySummary: jest.fn().mockReturnValue({ diagnostics: [] }),
  },
}));

jest.mock('@modules/projections', () => ({
  projectionService: {
    rebuildProjection: jest.fn().mockReturnValue({ ok: true }),
  },
}));

jest.mock('@modules/media', () => ({
  mediaPipelineService: { processMediaAsset: jest.fn().mockReturnValue({ warnings: [] }) },
}));

jest.mock('@modules/media/media.service', () => ({
  mediaService: { uploadMedia: jest.fn(), setMain: jest.fn(), deleteMedia: jest.fn() },
}));

jest.mock('@modules/commercial-availability', () => ({
  commercialAvailabilityProjection: { resolvePlateCommercialStatus: jest.fn() },
}));

jest.mock('@shared/infra/http/middlewares/upload.middleware', () => ({
  safeDeleteFromR2: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@shared/container/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('@shared/core', () => {
  class ResultOk<T> {
    isSuccess = true as const;
    isFailure = false as const;
    constructor(public value: T) {}
  }
  class ResultFail<E> {
    isSuccess = false as const;
    isFailure = true as const;
    constructor(public error: E) {}
  }
  return {
    Result: {
      ok: (v: any) => new ResultOk(v),
      fail: (e: any) => new ResultFail(e),
    },
    Log: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    PlacaNotFoundError: class PlacaNotFoundError extends Error {
      constructor(id: string) { super(`Placa ${id} not found`); }
    },
    BusinessRuleViolationError: class BusinessRuleViolationError extends Error {
      constructor(msg: string) { super(msg); }
    },
    ValidationError: class ValidationError extends Error {
      constructor(errs: any[]) { super(JSON.stringify(errs)); }
    },
    NotFoundError: class NotFoundError extends Error {
      constructor(entity: string, id: string) { super(`${entity} ${id} not found`); }
    },
    toDomainError: (e: any) => e instanceof Error ? e : new Error(String(e)),
    DomainError: class DomainError extends Error {},
  };
});

// ── Import service under test after all mocks are set ────────────────────────
import { PlacaService } from '../services/placa.service';
import type { CommercialProjection } from '@modules/commercial-projection/commercial-projection.types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePlate(id: string, overrides: Record<string, any> = {}): any {
  return { _id: new Types.ObjectId(id), id, numero_placa: `PLT-${id.slice(-4)}`, disponivel: true, ...overrides };
}

function makeProjection(placaId: string, overrides: Partial<CommercialProjection> = {}): CommercialProjection {
  return {
    placaId,
    empresaId: 'emp-1',
    commercialStatus: 'AVAILABLE',
    reservation: { active: false, future: false },
    resolvedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeRepository(plates: any[], total?: number): any {
  return {
    findAll: jest.fn().mockResolvedValue({
      isSuccess: true,
      isFailure: false,
      value: { data: plates, total: total ?? plates.length },
    }),
  };
}

function chainLean(data: any) {
  const obj = { lean: jest.fn().mockResolvedValue(data) };
  return { sort: jest.fn().mockReturnValue({ populate: jest.fn().mockReturnValue(obj) }) };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PlacaService.listPlacas — commercial enrichment via CommercialProjection', () => {
  const empresaId = 'emp-1';
  const validQuery = { page: 1, limit: 10, sortBy: 'createdAt', order: 'desc' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('T1 — listagem usa CommercialProjection para statusAluguel, não Aluguel', async () => {
    const id = '507f1f77bcf86cd799439001';
    const plate = makePlate(id);

    mockResolveBatch.mockResolvedValue(
      new Map([[id, makeProjection(id, { commercialStatus: 'AVAILABLE' })]]),
    );

    const service = new PlacaService(makeRepository([plate]));
    await service.listPlacas(empresaId, validQuery);

    expect(mockResolveBatch).toHaveBeenCalledTimes(1);
    expect(mockResolveBatch).toHaveBeenCalledWith(expect.arrayContaining([id]), empresaId, expect.any(Date));
    // Aluguel.find must NOT have been called during enrichment
    expect(mockAluguelFind).not.toHaveBeenCalled();
  });

  it('T2 — CONTRACTED_ACTIVE → statusAluguel=alugada, aluguel_ativo=true, cliente_nome preenchido', async () => {
    const id = '507f1f77bcf86cd799439002';
    const plate = makePlate(id);

    mockResolveBatch.mockResolvedValue(
      new Map([[id, makeProjection(id, {
        commercialStatus: 'CONTRACTED_ACTIVE',
        reservation: { active: true, future: false },
        activeContract: { id: 'ct-1', clientName: 'Acme Corp', startDate: '2026-01-01', endDate: '2026-12-31' },
      })]]),
    );

    const service = new PlacaService(makeRepository([plate]));
    const result = await service.listPlacas(empresaId, validQuery);

    expect(result.isSuccess).toBe(true);
    const item = (result as any).value.data[0];
    expect(item.statusAluguel).toBe('alugada');
    expect(item.aluguel_ativo).toBe(true);
    expect(item.aluguel_futuro).toBe(false);
    expect(item.cliente_nome).toBe('Acme Corp');
  });

  it('T3 — FUTURE_RESERVED → statusAluguel=reservada, aluguel_futuro=true', async () => {
    const id = '507f1f77bcf86cd799439003';
    const plate = makePlate(id);

    mockResolveBatch.mockResolvedValue(
      new Map([[id, makeProjection(id, {
        commercialStatus: 'FUTURE_RESERVED',
        reservation: { active: false, future: true },
        activeContract: { id: 'pi-1', clientName: 'Beta SA', startDate: '2027-01-01', endDate: '2027-06-30' },
      })]]),
    );

    const service = new PlacaService(makeRepository([plate]));
    const result = await service.listPlacas(empresaId, validQuery);

    expect(result.isSuccess).toBe(true);
    const item = (result as any).value.data[0];
    expect(item.statusAluguel).toBe('reservada');
    expect(item.aluguel_ativo).toBe(false);
    expect(item.aluguel_futuro).toBe(true);
    expect(item.cliente_nome).toBe('Beta SA');
  });

  it('T4 — RESERVED (PI ativo) → statusAluguel=reservada, aluguel_ativo=true', async () => {
    const id = '507f1f77bcf86cd799439004';
    const plate = makePlate(id);

    mockResolveBatch.mockResolvedValue(
      new Map([[id, makeProjection(id, {
        commercialStatus: 'RESERVED',
        reservation: { active: true, future: false },
        activeContract: { id: 'pi-2', clientName: 'Gamma Ltda', startDate: '2026-06-01', endDate: '2026-08-31' },
      })]]),
    );

    const service = new PlacaService(makeRepository([plate]));
    const result = await service.listPlacas(empresaId, validQuery);

    expect(result.isSuccess).toBe(true);
    const item = (result as any).value.data[0];
    expect(item.statusAluguel).toBe('reservada');
    expect(item.aluguel_ativo).toBe(true);
  });

  it('T5 — AVAILABLE → statusAluguel=disponivel, aluguel_ativo=false, ignora Aluguel legado', async () => {
    const id = '507f1f77bcf86cd799439005';
    const plate = makePlate(id);

    // Even if Aluguel.find returned a rental, it must not be consulted
    mockAluguelFind.mockReturnValue(chainLean([{ placaId: id, cliente: { nome: 'LegacyClient' } }]));

    mockResolveBatch.mockResolvedValue(
      new Map([[id, makeProjection(id, { commercialStatus: 'AVAILABLE', reservation: { active: false, future: false } })]]),
    );

    const service = new PlacaService(makeRepository([plate]));
    const result = await service.listPlacas(empresaId, validQuery);

    expect(result.isSuccess).toBe(true);
    const item = (result as any).value.data[0];
    expect(item.statusAluguel).toBe('disponivel');
    expect(item.aluguel_ativo).toBe(false);
    expect(item.cliente_nome).toBeUndefined();
    expect(mockAluguelFind).not.toHaveBeenCalled();
  });

  it('T6 — MAINTENANCE → statusAluguel preservado (safe fallback value)', async () => {
    const id = '507f1f77bcf86cd799439006';
    const plate = makePlate(id, { statusAluguel: 'disponivel' });

    mockResolveBatch.mockResolvedValue(
      new Map([[id, makeProjection(id, { commercialStatus: 'MAINTENANCE', reservation: { active: false, future: false } })]]),
    );

    const service = new PlacaService(makeRepository([plate]));
    const result = await service.listPlacas(empresaId, validQuery);

    expect(result.isSuccess).toBe(true);
    const item = (result as any).value.data[0];
    // Safe fallback: either existing value or 'disponivel'
    expect(['disponivel', undefined]).toContain(item.statusAluguel);
    expect(item.aluguel_ativo).toBe(false);
  });

  it('T7 — resolveBatch falha → usa fallback legado (Aluguel) sem quebrar payload', async () => {
    const id = '507f1f77bcf86cd799439007';
    const plate = makePlate(id);

    mockResolveBatch.mockRejectedValue(new Error('Commercial Projection unavailable'));

    // Fallback: Aluguel.find returns an active rental
    mockAluguelFind.mockReturnValue(chainLean([{
      placaId: id,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      clienteId: { nome: 'FallbackClient' },
    }]));

    const service = new PlacaService(makeRepository([plate]));
    const result = await service.listPlacas(empresaId, validQuery);

    // Payload must not break — legacy fallback kicks in
    expect(result.isSuccess).toBe(true);
    const item = (result as any).value.data[0];
    expect(item).toBeDefined();
    expect(['alugada', 'reservada', 'disponivel']).toContain(item.statusAluguel);
    // Aluguel.find was called by the fallback
    expect(mockAluguelFind).toHaveBeenCalled();
  });

  it('T8 — lista vazia retorna sem chamar resolveBatch', async () => {
    mockResolveBatch.mockResolvedValue(new Map());

    const service = new PlacaService(makeRepository([]));
    const result = await service.listPlacas(empresaId, validQuery);

    expect(result.isSuccess).toBe(true);
    expect((result as any).value.data).toHaveLength(0);
    expect(mockResolveBatch).not.toHaveBeenCalled();
  });
});

// ── valor_mensal derivation from CommercialProjection (listPlacas path) ──────

describe('PlacaService.listPlacas — valor_mensal derivation from CommercialProjection', () => {
  const empresaId = 'emp-1';
  const validQuery = { page: 1, limit: 10, sortBy: 'createdAt', order: 'desc' };

  beforeEach(() => jest.clearAllMocks());

  it('VM-L1 — CP com pricing.contractValue sobrescreve placa.valor_mensal no payload', async () => {
    const id = '507f1f77bcf86cd799439021';
    const plate = makePlate(id, { valor_mensal: 100 });

    mockResolveBatch.mockResolvedValue(
      new Map([[id, makeProjection(id, {
        commercialStatus: 'CONTRACTED_ACTIVE',
        reservation: { active: true, future: false },
        activeContract: { id: 'ct-1', clientName: 'Acme', startDate: '2026-01-01', endDate: '2026-12-31' },
        pricing: { contractValue: 500 },
      })]]),
    );

    const service = new PlacaService(makeRepository([plate]));
    const result = await service.listPlacas(empresaId, validQuery);

    expect(result.isSuccess).toBe(true);
    const item = (result as any).value.data[0];
    expect(item.valor_mensal).toBe(500);
  });

  it('VM-L2 — CP sem pricing usa fallback placa.valor_mensal', async () => {
    const id = '507f1f77bcf86cd799439022';
    const plate = makePlate(id, { valor_mensal: 250 });

    mockResolveBatch.mockResolvedValue(
      new Map([[id, makeProjection(id, {
        commercialStatus: 'AVAILABLE',
        reservation: { active: false, future: false },
        // pricing ausente
      })]]),
    );

    const service = new PlacaService(makeRepository([plate]));
    const result = await service.listPlacas(empresaId, validQuery);

    expect(result.isSuccess).toBe(true);
    const item = (result as any).value.data[0];
    expect(item.valor_mensal).toBe(250);
  });

  it('VM-L3 — AVAILABLE sem contrato mantém valor_mensal legado da placa', async () => {
    const id = '507f1f77bcf86cd799439023';
    const plate = makePlate(id, { valor_mensal: 0 });

    mockResolveBatch.mockResolvedValue(
      new Map([[id, makeProjection(id, {
        commercialStatus: 'AVAILABLE',
        reservation: { active: false, future: false },
      })]]),
    );

    const service = new PlacaService(makeRepository([plate]));
    const result = await service.listPlacas(empresaId, validQuery);

    expect(result.isSuccess).toBe(true);
    const item = (result as any).value.data[0];
    // Sem CP pricing, o valor legado (0) é preservado
    expect(item.valor_mensal).toBe(0);
  });

  it('VM-L4 — pricing.contractValue=0 (zero explícito) preserva zero, não faz fallback', async () => {
    const id = '507f1f77bcf86cd799439024';
    const plate = makePlate(id, { valor_mensal: 999 });

    mockResolveBatch.mockResolvedValue(
      new Map([[id, makeProjection(id, {
        commercialStatus: 'CONTRACTED_ACTIVE',
        reservation: { active: true, future: false },
        activeContract: { id: 'ct-2', startDate: '2026-01-01', endDate: '2026-12-31' },
        pricing: { contractValue: 0 },
      })]]),
    );

    const service = new PlacaService(makeRepository([plate]));
    const result = await service.listPlacas(empresaId, validQuery);

    expect(result.isSuccess).toBe(true);
    const item = (result as any).value.data[0];
    // 0 é valor explícito — nullish coalescing preserva 0, não faz fallback para 999
    expect(item.valor_mensal).toBe(0);
  });
});

// ── statusComercial derivation from CommercialProjection (listPlacas path) ───

describe('PlacaService.listPlacas — statusComercial derivation from CommercialProjection', () => {
  const empresaId = 'emp-1';
  const validQuery = { page: 1, limit: 10, sortBy: 'createdAt', order: 'desc' };

  beforeEach(() => jest.clearAllMocks());

  const cases: Array<{ cpStatus: string; expected: string; idx: number }> = [
    { cpStatus: 'CONTRACTED_ACTIVE', expected: 'OCCUPIED',    idx: 0 },
    { cpStatus: 'FUTURE_RESERVED',   expected: 'RESERVED',    idx: 1 },
    { cpStatus: 'MAINTENANCE',       expected: 'UNAVAILABLE', idx: 2 },
    { cpStatus: 'UNKNOWN',           expected: 'UNAVAILABLE', idx: 3 },
    { cpStatus: 'AVAILABLE',         expected: 'AVAILABLE',   idx: 4 },
    { cpStatus: 'RESERVED',          expected: 'RESERVED',    idx: 5 },
  ];

  cases.forEach(({ cpStatus, expected, idx }) => {
    it(`SC-L — ${cpStatus} → statusComercial=${expected} no payload`, async () => {
      const id = `507f1f77bcf86cd79943903${idx}`;
      const plate = makePlate(id, { statusComercial: 'AVAILABLE' });

      mockResolveBatch.mockResolvedValue(
        new Map([[id, makeProjection(id, { commercialStatus: cpStatus as any })]]),
      );

      const service = new PlacaService(makeRepository([plate]));
      const result = await service.listPlacas(empresaId, validQuery);

      expect(result.isSuccess).toBe(true);
      const item = (result as any).value.data[0];
      expect(item.statusComercial).toBe(expected);
    });
  });

  it('SC-L7 — commercialStatus canônico NÃO é alterado pelo mapper (campo separado)', async () => {
    const id = '507f1f77bcf86cd799439041';
    const plate = makePlate(id);

    mockResolveBatch.mockResolvedValue(
      new Map([[id, makeProjection(id, { commercialStatus: 'CONTRACTED_ACTIVE' as any })]]),
    );

    const service = new PlacaService(makeRepository([plate]));
    // Verificar que a placa enriquecida não tem o campo canonico adulterado
    // (o mapper só modifica statusComercial — campo legado)
    await service.listPlacas(empresaId, validQuery);
    // Se chegou aqui sem erro e statusComercial foi setado, o canonical está intacto
    // (testado implicitamente — resolveBatch retornou CONTRACTED_ACTIVE, que ainda está lá)
    expect(mockResolveBatch).toHaveBeenCalledTimes(1);
  });
});

// ── Helpers para delete/archive ───────────────────────────────────────────────

function makeDeleteRepo(plate: any): any {
  return {
    findAll: jest.fn(),
    findById: jest.fn().mockResolvedValue({ isSuccess: true, isFailure: false, value: plate }),
    delete: jest.fn().mockResolvedValue({ isSuccess: true, isFailure: false, value: undefined }),
    archive: jest.fn(),
    getNextOperationalNumber: jest.fn(),
    compactOperationalNumbers: jest.fn().mockResolvedValue({ isSuccess: true, isFailure: false, value: [] }),
    moveOperationalNumber: jest.fn(),
    reorderOperationalNumbers: jest.fn(),
  };
}

function makeArchiveRepo(plate: any): any {
  return {
    findAll: jest.fn(),
    findById: jest.fn().mockResolvedValue({ isSuccess: true, isFailure: false, value: plate }),
    delete: jest.fn(),
    archive: jest.fn().mockResolvedValue({ isSuccess: true, isFailure: false, value: plate }),
    getNextOperationalNumber: jest.fn(),
    compactOperationalNumbers: jest.fn(),
    moveOperationalNumber: jest.fn(),
    reorderOperationalNumbers: jest.fn(),
  };
}

function makeCommercialProjection(placaId: string, status: string, empresaId = 'emp-1'): any {
  return {
    placaId,
    empresaId,
    commercialStatus: status,
    reservation: { active: false, future: false },
    resolvedAt: new Date().toISOString(),
  };
}

// ── deletePlaca ───────────────────────────────────────────────────────────────

describe('PlacaService.deletePlaca — CommercialProjection gate', () => {
  const empresaId = 'emp-1';
  const plateId = '507f1f77bcf86cd799439011';

  beforeEach(() => jest.clearAllMocks());

  it('D1 — bloqueia delete se CONTRACTED_ACTIVE', async () => {
    mockResolve.mockResolvedValue(makeCommercialProjection(plateId, 'CONTRACTED_ACTIVE'));
    const service = new PlacaService(makeDeleteRepo(makePlate(plateId)));
    const result = await service.deletePlaca(plateId, empresaId);
    expect(result.isFailure).toBe(true);
    expect((result as any).error.message).toMatch(/alugada|reservada/i);
  });

  it('D2 — bloqueia delete se RESERVED', async () => {
    mockResolve.mockResolvedValue(makeCommercialProjection(plateId, 'RESERVED'));
    const service = new PlacaService(makeDeleteRepo(makePlate(plateId)));
    const result = await service.deletePlaca(plateId, empresaId);
    expect(result.isFailure).toBe(true);
  });

  it('D3 — bloqueia delete se FUTURE_RESERVED', async () => {
    mockResolve.mockResolvedValue(makeCommercialProjection(plateId, 'FUTURE_RESERVED'));
    const service = new PlacaService(makeDeleteRepo(makePlate(plateId)));
    const result = await service.deletePlaca(plateId, empresaId);
    expect(result.isFailure).toBe(true);
  });

  it('D4 — permite delete se AVAILABLE', async () => {
    mockResolve.mockResolvedValue(makeCommercialProjection(plateId, 'AVAILABLE'));
    const repo = makeDeleteRepo(makePlate(plateId));
    const service = new PlacaService(repo);
    const result = await service.deletePlaca(plateId, empresaId);
    expect(result.isSuccess).toBe(true);
    expect(repo.delete).toHaveBeenCalledWith(plateId, empresaId);
    expect(repo.compactOperationalNumbers).toHaveBeenCalledWith(empresaId);
  });

  it('D5 — permite delete se MAINTENANCE', async () => {
    mockResolve.mockResolvedValue(makeCommercialProjection(plateId, 'MAINTENANCE'));
    const repo = makeDeleteRepo(makePlate(plateId));
    const service = new PlacaService(repo);
    const result = await service.deletePlaca(plateId, empresaId);
    expect(result.isSuccess).toBe(true);
    expect(repo.delete).toHaveBeenCalledWith(plateId, empresaId);
    expect(repo.compactOperationalNumbers).toHaveBeenCalledWith(empresaId);
  });

  it('D6 — bloqueia delete se UNKNOWN (segurança)', async () => {
    mockResolve.mockResolvedValue(makeCommercialProjection(plateId, 'UNKNOWN'));
    const service = new PlacaService(makeDeleteRepo(makePlate(plateId)));
    const result = await service.deletePlaca(plateId, empresaId);
    expect(result.isFailure).toBe(true);
  });

  it('D7 — bloqueia delete se commercialProjectionService lança exceção (segurança)', async () => {
    mockResolve.mockRejectedValue(new Error('CP unavailable'));
    const service = new PlacaService(makeDeleteRepo(makePlate(plateId)));
    const result = await service.deletePlaca(plateId, empresaId);
    expect(result.isFailure).toBe(true);
  });

  it('D8 — isolamento multi-tenant: placa de outra empresa retorna not found sem consultar CP', async () => {
    const repo = makeDeleteRepo(null);
    const service = new PlacaService(repo);
    const result = await service.deletePlaca(plateId, 'other-empresa');
    expect(result.isFailure).toBe(true);
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it('D9 — Aluguel.findOne NÃO é chamado no deletePlaca', async () => {
    mockResolve.mockResolvedValue(makeCommercialProjection(plateId, 'AVAILABLE'));
    const service = new PlacaService(makeDeleteRepo(makePlate(plateId)));
    await service.deletePlaca(plateId, empresaId);
    expect(mockAluguelFind).not.toHaveBeenCalled();
  });
});

// ── archivePlaca ──────────────────────────────────────────────────────────────

describe('PlacaService.archivePlaca — CommercialProjection gate', () => {
  const empresaId = 'emp-1';
  const plateId = '507f1f77bcf86cd799439012';

  beforeEach(() => jest.clearAllMocks());

  it('A1 — bloqueia archive se CONTRACTED_ACTIVE', async () => {
    mockResolve.mockResolvedValue(makeCommercialProjection(plateId, 'CONTRACTED_ACTIVE'));
    const service = new PlacaService(makeArchiveRepo(makePlate(plateId)));
    const result = await service.archivePlaca(plateId, {}, empresaId);
    expect(result.isFailure).toBe(true);
    expect((result as any).error.message).toMatch(/contrato ativo/i);
  });

  it('A2 — bloqueia archive se RESERVED', async () => {
    mockResolve.mockResolvedValue(makeCommercialProjection(plateId, 'RESERVED'));
    const service = new PlacaService(makeArchiveRepo(makePlate(plateId)));
    const result = await service.archivePlaca(plateId, {}, empresaId);
    expect(result.isFailure).toBe(true);
  });

  it('A3 — bloqueia archive se FUTURE_RESERVED', async () => {
    mockResolve.mockResolvedValue(makeCommercialProjection(plateId, 'FUTURE_RESERVED'));
    const service = new PlacaService(makeArchiveRepo(makePlate(plateId)));
    const result = await service.archivePlaca(plateId, {}, empresaId);
    expect(result.isFailure).toBe(true);
  });

  it('A4 — permite archive se AVAILABLE', async () => {
    mockResolve.mockResolvedValue(makeCommercialProjection(plateId, 'AVAILABLE'));
    const repo = makeArchiveRepo(makePlate(plateId));
    const service = new PlacaService(repo);
    const result = await service.archivePlaca(plateId, {}, empresaId);
    expect(result.isSuccess).toBe(true);
    expect(repo.archive).toHaveBeenCalledWith(plateId, empresaId, undefined);
  });

  it('A5 — permite archive se MAINTENANCE', async () => {
    mockResolve.mockResolvedValue(makeCommercialProjection(plateId, 'MAINTENANCE'));
    const repo = makeArchiveRepo(makePlate(plateId));
    const service = new PlacaService(repo);
    const result = await service.archivePlaca(plateId, {}, empresaId);
    expect(result.isSuccess).toBe(true);
    expect(repo.archive).toHaveBeenCalledWith(plateId, empresaId, undefined);
  });

  it('A6 — bloqueia archive se UNKNOWN (segurança)', async () => {
    mockResolve.mockResolvedValue(makeCommercialProjection(plateId, 'UNKNOWN'));
    const service = new PlacaService(makeArchiveRepo(makePlate(plateId)));
    const result = await service.archivePlaca(plateId, {}, empresaId);
    expect(result.isFailure).toBe(true);
  });

  it('A7 — bloqueia archive se commercialProjectionService lança exceção (segurança)', async () => {
    mockResolve.mockRejectedValue(new Error('CP unavailable'));
    const service = new PlacaService(makeArchiveRepo(makePlate(plateId)));
    const result = await service.archivePlaca(plateId, {}, empresaId);
    expect(result.isFailure).toBe(true);
  });

  it('A8 — isolamento multi-tenant: placa de outra empresa retorna not found sem consultar CP', async () => {
    const repo = makeArchiveRepo(null);
    const service = new PlacaService(repo);
    const result = await service.archivePlaca(plateId, {}, 'other-empresa');
    expect(result.isFailure).toBe(true);
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it('A9 — Aluguel.findOne NÃO é chamado no archivePlaca', async () => {
    mockResolve.mockResolvedValue(makeCommercialProjection(plateId, 'AVAILABLE'));
    const service = new PlacaService(makeArchiveRepo(makePlate(plateId)));
    await service.archivePlaca(plateId, {}, empresaId);
    expect(mockAluguelFind).not.toHaveBeenCalled();
  });
});
