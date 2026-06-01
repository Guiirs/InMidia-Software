/**
 * Unit tests — InventoryBoardsService.listBoards() valor_mensal derivation
 *
 * Validates that valorMensal / valor_mensal in board responses derives its
 * primary value from CommercialProjection.pricing.contractValue, with
 * placa.valor_mensal used only as a fallback.
 *
 * All external I/O (Mongoose, Aluguel, CP service) is mocked.
 */

// ── Mocks (hoisted before imports) ───────────────────────────────────────────

const mockResolveBatch = jest.fn();

jest.mock('@modules/commercial-projection/commercial-projection.service', () => ({
  commercialProjectionService: {
    resolveBatch: (...args: any[]) => mockResolveBatch(...args),
  },
}));

const mockPlacaLean = jest.fn();
const mockPlacaPopulate = jest.fn().mockReturnValue({ lean: mockPlacaLean });
const mockPlacaFind = jest.fn().mockReturnValue({ populate: mockPlacaPopulate });

jest.mock('@modules/placas/Placa', () => ({
  __esModule: true,
  default: { find: (...args: any[]) => mockPlacaFind(...args) },
}));

const mockAluguelLean = jest.fn().mockResolvedValue([]);
const mockAluguelFind = jest.fn().mockReturnValue({ lean: mockAluguelLean });

jest.mock('@modules/alugueis/Aluguel', () => ({
  __esModule: true,
  default: { find: (...args: any[]) => mockAluguelFind(...args) },
}));

jest.mock('@modules/regions/region.service', () => ({
  regionService: { getRegions: jest.fn() },
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import { InventoryBoardsService } from '../services/inventory-boards.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

const PLATE_ID = '507f1f77bcf86cd799439051';
const EMPRESA_ID = '507f1f77bcf86cd799439099';

function makeRawPlate(overrides: Record<string, any> = {}): any {
  return {
    _id: PLATE_ID,
    numero_placa: 'PLT-001',
    valor_mensal: 100,
    disponivel: true,
    regiaoId: null,
    ...overrides,
  };
}

function makeCpProjection(overrides: Record<string, any> = {}): any {
  return {
    placaId: PLATE_ID,
    empresaId: EMPRESA_ID,
    commercialStatus: 'AVAILABLE',
    reservation: { active: false, future: false },
    resolvedAt: new Date().toISOString(),
    ...overrides,
  };
}

function setupPlacaMock(plate: any): void {
  mockPlacaLean.mockResolvedValue([plate]);
}

function setupCpMock(projection: any): void {
  mockResolveBatch.mockResolvedValue(new Map([[PLATE_ID, projection]]));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('InventoryBoardsService.listBoards — valor_mensal derivation from CommercialProjection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPlacaFind.mockReturnValue({ populate: mockPlacaPopulate });
    mockPlacaPopulate.mockReturnValue({ lean: mockPlacaLean });
    mockAluguelFind.mockReturnValue({ lean: mockAluguelLean });
    mockAluguelLean.mockResolvedValue([]);
  });

  it('VM-B1 — valorMensal usa CP pricing.contractValue quando disponível', async () => {
    setupPlacaMock(makeRawPlate({ valor_mensal: 100 }));
    setupCpMock(makeCpProjection({
      commercialStatus: 'CONTRACTED_ACTIVE',
      reservation: { active: true, future: false },
      activeContract: { id: 'ct-1', clientName: 'Acme', startDate: '2026-01-01', endDate: '2026-12-31' },
      pricing: { contractValue: 750 },
    }));

    const service = new InventoryBoardsService();
    const result = await service.listBoards(EMPRESA_ID, {});

    expect(result.boards).toHaveLength(1);
    const board1 = result.boards[0]!;
    expect(board1.valorMensal).toBe(750);
    expect(board1.valor_mensal).toBe(750);
  });

  it('VM-B2 — valorMensal usa fallback placa.valor_mensal quando CP não tem pricing', async () => {
    setupPlacaMock(makeRawPlate({ valor_mensal: 200 }));
    setupCpMock(makeCpProjection({
      commercialStatus: 'AVAILABLE',
      reservation: { active: false, future: false },
      // sem pricing
    }));

    const service = new InventoryBoardsService();
    const result = await service.listBoards(EMPRESA_ID, {});

    const board2 = result.boards[0]!;
    expect(board2.valorMensal).toBe(200);
    expect(board2.valor_mensal).toBe(200);
  });

  it('VM-B3 — AVAILABLE sem contrato preserva placa.valor_mensal como fallback', async () => {
    setupPlacaMock(makeRawPlate({ valor_mensal: 350 }));
    setupCpMock(makeCpProjection({ commercialStatus: 'AVAILABLE' }));

    const service = new InventoryBoardsService();
    const result = await service.listBoards(EMPRESA_ID, {});

    const board3 = result.boards[0]!;
    expect(board3.valorMensal).toBe(350);
    expect(board3.valor_mensal).toBe(350);
  });

  it('VM-B4 — CP pricing.contractValue=0 (zero explícito) não faz fallback para placa.valor_mensal', async () => {
    setupPlacaMock(makeRawPlate({ valor_mensal: 999 }));
    setupCpMock(makeCpProjection({
      commercialStatus: 'CONTRACTED_ACTIVE',
      reservation: { active: true, future: false },
      activeContract: { id: 'ct-2', startDate: '2026-01-01', endDate: '2026-12-31' },
      pricing: { contractValue: 0 },
    }));

    const service = new InventoryBoardsService();
    const result = await service.listBoards(EMPRESA_ID, {});

    // 0 é valor explícito — nullish coalescing preserva 0
    const board4 = result.boards[0]!;
    expect(board4.valorMensal).toBe(0);
    expect(board4.valor_mensal).toBe(0);
  });

  it('SC-B1 — CONTRACTED_ACTIVE → statusComercial=OCCUPIED no board', async () => {
    setupPlacaMock(makeRawPlate({ statusComercial: 'AVAILABLE' }));
    setupCpMock(makeCpProjection({
      commercialStatus: 'CONTRACTED_ACTIVE',
      reservation: { active: true, future: false },
      activeContract: { id: 'ct-sc', clientName: 'X', startDate: '2026-01-01', endDate: '2026-12-31' },
    }));

    const service = new InventoryBoardsService();
    const result = await service.listBoards(EMPRESA_ID, {});

    const board = result.boards[0]!;
    expect(board.statusComercial).toBe('OCCUPIED');
    // commercialStatus canônico preservado
    expect(board.commercialStatus).toBe('CONTRACTED_ACTIVE');
  });

  it('SC-B2 — FUTURE_RESERVED → statusComercial=RESERVED no board', async () => {
    setupPlacaMock(makeRawPlate());
    setupCpMock(makeCpProjection({
      commercialStatus: 'FUTURE_RESERVED',
      reservation: { active: false, future: true },
    }));

    const service = new InventoryBoardsService();
    const result = await service.listBoards(EMPRESA_ID, {});

    expect(result.boards[0]!.statusComercial).toBe('RESERVED');
  });

  it('SC-B3 — MAINTENANCE → statusComercial=UNAVAILABLE no board', async () => {
    setupPlacaMock(makeRawPlate());
    setupCpMock(makeCpProjection({ commercialStatus: 'MAINTENANCE' }));

    const service = new InventoryBoardsService();
    const result = await service.listBoards(EMPRESA_ID, {});

    expect(result.boards[0]!.statusComercial).toBe('UNAVAILABLE');
  });

  it('SC-B4 — AVAILABLE → statusComercial=AVAILABLE no board', async () => {
    setupPlacaMock(makeRawPlate());
    setupCpMock(makeCpProjection({ commercialStatus: 'AVAILABLE' }));

    const service = new InventoryBoardsService();
    const result = await service.listBoards(EMPRESA_ID, {});

    expect(result.boards[0]!.statusComercial).toBe('AVAILABLE');
  });

  it('SC-B5 — sem CP, statusComercial fallback para placa.statusComercial', async () => {
    setupPlacaMock(makeRawPlate({ statusComercial: 'OCCUPIED' }));
    // CP retorna Map vazio (placa não encontrada)
    mockResolveBatch.mockResolvedValue(new Map());

    const service = new InventoryBoardsService();
    const result = await service.listBoards(EMPRESA_ID, {});

    expect(result.boards[0]!.statusComercial).toBe('OCCUPIED');
  });

  it('VM-B5 — lista vazia retorna boards vazio', async () => {
    mockPlacaLean.mockResolvedValue([]);
    mockResolveBatch.mockResolvedValue(new Map());

    const service = new InventoryBoardsService();
    const result = await service.listBoards(EMPRESA_ID, {});

    expect(result.boards).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});
