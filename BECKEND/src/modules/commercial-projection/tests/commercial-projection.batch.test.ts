/**
 * CommercialProjectionService.resolveBatch() and resolveMany() — batch tests
 *
 * Verifies:
 * - 5 canonical commercial scenarios
 * - Multi-tenant isolation (no cross-tenant data leakage)
 * - No N+1: TemporalReservation.find is called at most once per resolveBatch call
 * - Contracts, PIs, and Clients are fetched in a single batch per call
 */

import { Types } from 'mongoose';

// ─── Model mocks ─────────────────────────────────────────────────────────────

const mockPlacaFind = jest.fn();
const mockTemporalFind = jest.fn();
const mockContratoFind = jest.fn();
const mockPiFind = jest.fn();
const mockClienteFind = jest.fn();

jest.mock('@modules/placas/Placa', () => ({
  __esModule: true,
  default: { find: (...args: any[]) => mockPlacaFind(...args) },
}));

jest.mock('@modules/temporal/TemporalReservation', () => ({
  __esModule: true,
  default: {
    find: (...args: any[]) => mockTemporalFind(...args),
    findOne: jest.fn(),
  },
}));

jest.mock('@modules/contratos/Contrato', () => ({
  __esModule: true,
  default: {
    find: (...args: any[]) => mockContratoFind(...args),
    findOne: jest.fn(),
  },
}));

jest.mock('@modules/propostas-internas/PropostaInterna', () => ({
  __esModule: true,
  default: {
    find: (...args: any[]) => mockPiFind(...args),
    findOne: jest.fn(),
  },
}));

jest.mock('@modules/clientes/Cliente', () => ({
  __esModule: true,
  default: {
    find: (...args: any[]) => mockClienteFind(...args),
    findOne: jest.fn(),
  },
}));

// ─── Import service after mocks ───────────────────────────────────────────────

import CommercialProjectionService from '../commercial-projection.service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const EMPRESA_A = new Types.ObjectId().toHexString();
const EMPRESA_B = new Types.ObjectId().toHexString();

const PLACA_1 = new Types.ObjectId().toHexString();
const PLACA_2 = new Types.ObjectId().toHexString();
const PLACA_3 = new Types.ObjectId().toHexString();
const PLACA_4 = new Types.ObjectId().toHexString();
const PLACA_5 = new Types.ObjectId().toHexString();

const CONTRACT_ID = new Types.ObjectId().toHexString();
const PI_ID = new Types.ObjectId().toHexString();
const CLIENT_ID = new Types.ObjectId().toHexString();

const NOW = new Date('2026-06-01T10:00:00.000Z');
const PAST = new Date('2026-01-01T00:00:00.000Z');
const FUTURE = new Date('2026-12-31T23:59:59.000Z');
const NEXT_WEEK = new Date('2026-06-08T10:00:00.000Z');

function chainQuery(value: any) {
  const chain = {
    select: () => chain,
    populate: () => chain,
    sort: () => chain,
    lean: () => Promise.resolve(value),
  };
  return chain;
}

function makePlate(id: string, overrides: any = {}) {
  return { _id: new Types.ObjectId(id), disponivel: true, ativa: true, ...overrides };
}

function makeReservation(plateId: string, overrides: any = {}) {
  return {
    _id: new Types.ObjectId(),
    empresaId: new Types.ObjectId(EMPRESA_A),
    plateId: new Types.ObjectId(plateId),
    sourceType: 'CONTRACT',
    sourceId: CONTRACT_ID,
    customerId: new Types.ObjectId(CLIENT_ID),
    startDate: PAST,
    endDate: FUTURE,
    status: 'ACTIVE',
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CommercialProjectionService.resolveBatch()', () => {
  let service: CommercialProjectionService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(NOW);
    service = new CommercialProjectionService();

    // Default: no enrichment data needed
    mockContratoFind.mockReturnValue(chainQuery([]));
    mockPiFind.mockReturnValue(chainQuery([]));
    mockClienteFind.mockReturnValue(chainQuery([]));
  });

  afterEach(() => jest.useRealTimers());

  // ── Scenario 1: No contract → AVAILABLE ──────────────────────────────────

  it('Scenario 1 — plate with no reservations → AVAILABLE', async () => {
    mockPlacaFind.mockReturnValue(chainQuery([makePlate(PLACA_1)]));
    mockTemporalFind
      .mockReturnValueOnce(chainQuery([]))   // blocking reservations
      .mockReturnValueOnce(chainQuery([]));  // expired reservations

    const map = await service.resolveBatch([PLACA_1], EMPRESA_A, NOW);
    const cp = map.get(PLACA_1)!;

    expect(cp.commercialStatus).toBe('AVAILABLE');
    expect(cp.activeContract).toBeUndefined();
    expect(cp.reservation.active).toBe(false);
    expect(cp.reservation.future).toBe(false);
  });

  // ── Scenario 2: Future reservation → FUTURE_RESERVED ────────────────────

  it('Scenario 2 — future PI reservation → FUTURE_RESERVED', async () => {
    mockPlacaFind.mockReturnValue(chainQuery([makePlate(PLACA_2)]));
    mockTemporalFind
      .mockReturnValueOnce(chainQuery([
        makeReservation(PLACA_2, {
          sourceType: 'PI',
          sourceId: PI_ID,
          startDate: NEXT_WEEK,
          endDate: FUTURE,
          status: 'RESERVED',
        }),
      ]))
      .mockReturnValueOnce(chainQuery([]));

    mockPiFind.mockReturnValue(
      chainQuery([{
        _id: new Types.ObjectId(PI_ID),
        pi_code: 'PI-001',
        valorTotal: 4500,
        clienteId: { _id: new Types.ObjectId(CLIENT_ID), nome: 'Empresa Beta', nomeFantasia: null },
      }]),
    );

    const map = await service.resolveBatch([PLACA_2], EMPRESA_A, NOW);
    const cp = map.get(PLACA_2)!;

    expect(cp.commercialStatus).toBe('FUTURE_RESERVED');
    expect(cp.reservation.future).toBe(true);
    expect(cp.reservation.active).toBe(false);
    expect(cp.activeContract?.piCode).toBe('PI-001');
    expect(cp.activeContract?.clientName).toBe('Empresa Beta');
    expect(cp.pricing?.contractValue).toBe(4500);
  });

  // ── Scenario 3: Active contract → CONTRACTED_ACTIVE ─────────────────────

  it('Scenario 3 — active CONTRACT reservation → CONTRACTED_ACTIVE with full enrichment', async () => {
    mockPlacaFind.mockReturnValue(chainQuery([makePlate(PLACA_3)]));
    mockTemporalFind
      .mockReturnValueOnce(chainQuery([makeReservation(PLACA_3)]))
      .mockReturnValueOnce(chainQuery([]));

    mockContratoFind.mockReturnValue(
      chainQuery([{
        _id: new Types.ObjectId(CONTRACT_ID),
        numero: 'CONT-2026-42',
        piId: { _id: new Types.ObjectId(PI_ID), pi_code: 'PI-042', valorTotal: 9900 },
        clienteId: { _id: new Types.ObjectId(CLIENT_ID), nome: 'Alpha Ltda', nomeFantasia: 'Alpha' },
      }]),
    );

    const map = await service.resolveBatch([PLACA_3], EMPRESA_A, NOW);
    const cp = map.get(PLACA_3)!;

    expect(cp.commercialStatus).toBe('CONTRACTED_ACTIVE');
    expect(cp.reservation.active).toBe(true);
    expect(cp.activeContract?.contractCode).toBe('CONT-2026-42');
    expect(cp.activeContract?.clientName).toBe('Alpha');
    expect(cp.activeContract?.piCode).toBe('PI-042');
    expect(cp.pricing?.contractValue).toBe(9900);
  });

  // ── Scenario 4: MAINTENANCE (physical block) ─────────────────────────────

  it('Scenario 4 — plate.disponivel=false → MAINTENANCE', async () => {
    mockPlacaFind.mockReturnValue(chainQuery([makePlate(PLACA_4, { disponivel: false })]));
    mockTemporalFind
      .mockReturnValueOnce(chainQuery([]))
      .mockReturnValueOnce(chainQuery([]));

    const map = await service.resolveBatch([PLACA_4], EMPRESA_A, NOW);
    const cp = map.get(PLACA_4)!;

    expect(cp.commercialStatus).toBe('MAINTENANCE');
    expect(cp.activeContract).toBeUndefined();
  });

  // ── Scenario 5: Expired pending → UNKNOWN ────────────────────────────────

  it('Scenario 5 — expired reservation pending release → UNKNOWN', async () => {
    mockPlacaFind.mockReturnValue(chainQuery([makePlate(PLACA_5)]));
    mockTemporalFind
      .mockReturnValueOnce(chainQuery([]))
      .mockReturnValueOnce(chainQuery([{ plateId: new Types.ObjectId(PLACA_5) }]));

    const map = await service.resolveBatch([PLACA_5], EMPRESA_A, NOW);
    const cp = map.get(PLACA_5)!;

    expect(cp.commercialStatus).toBe('UNKNOWN');
  });

  // ── Batch: no N+1 queries ─────────────────────────────────────────────────

  it('does NOT call TemporalReservation.find more than twice for any batch size', async () => {
    const plates = [PLACA_1, PLACA_2, PLACA_3, PLACA_4, PLACA_5];

    mockPlacaFind.mockReturnValue(chainQuery(plates.map((id) => makePlate(id))));
    mockTemporalFind
      .mockReturnValueOnce(chainQuery([]))   // blocking
      .mockReturnValueOnce(chainQuery([]));  // expired

    await service.resolveBatch(plates, EMPRESA_A, NOW);

    // Exactly 2 calls to TemporalReservation.find regardless of 5 plates
    expect(mockTemporalFind).toHaveBeenCalledTimes(2);

    // And exactly 1 call to Placa.find for all plates
    expect(mockPlacaFind).toHaveBeenCalledTimes(1);
  });

  it('fetches contracts in ONE batch query when multiple plates share different contracts', async () => {
    const CONTRACT_B = new Types.ObjectId().toHexString();
    const plates = [PLACA_1, PLACA_2];
    mockPlacaFind.mockReturnValue(chainQuery(plates.map((id) => makePlate(id))));
    mockTemporalFind
      .mockReturnValueOnce(chainQuery([
        makeReservation(PLACA_1, { sourceId: CONTRACT_ID }),
        makeReservation(PLACA_2, { sourceId: CONTRACT_B }),
      ]))
      .mockReturnValueOnce(chainQuery([]));

    mockContratoFind.mockReturnValue(chainQuery([]));

    await service.resolveBatch(plates, EMPRESA_A, NOW);

    // Only 1 batch Contrato.find call for both plates
    expect(mockContratoFind).toHaveBeenCalledTimes(1);
    const callArg = mockContratoFind.mock.calls[0][0];
    expect(callArg._id.$in).toHaveLength(2);
  });

  // ── Multi-tenant isolation ────────────────────────────────────────────────

  it('does not return plates from a different empresa', async () => {
    // Placa query always filters by empresaId — simulate plate not found for EMPRESA_B
    mockPlacaFind.mockReturnValue(chainQuery([]));
    mockTemporalFind
      .mockReturnValueOnce(chainQuery([]))
      .mockReturnValueOnce(chainQuery([]));

    const map = await service.resolveBatch([PLACA_1], EMPRESA_B, NOW);
    const cp = map.get(PLACA_1)!;

    // Plate not found → UNKNOWN
    expect(cp.commercialStatus).toBe('UNKNOWN');

    // Verify the Placa.find query included the tenant filter
    expect(mockPlacaFind).toHaveBeenCalledWith(
      expect.objectContaining({ empresaId: expect.any(Types.ObjectId) }),
    );
  });

  it('Placa.find and TemporalReservation.find always include empresaId filter', async () => {
    mockPlacaFind.mockReturnValue(chainQuery([makePlate(PLACA_1)]));
    mockTemporalFind
      .mockReturnValueOnce(chainQuery([]))
      .mockReturnValueOnce(chainQuery([]));

    await service.resolveBatch([PLACA_1], EMPRESA_A, NOW);

    const placaArg = mockPlacaFind.mock.calls[0][0];
    expect(placaArg).toHaveProperty('empresaId');

    mockTemporalFind.mock.calls.forEach(([arg]: any[]) => {
      expect(arg).toHaveProperty('empresaId');
    });
  });

  // ── resolveMany ───────────────────────────────────────────────────────────

  it('resolveMany() returns an ordered array aligned to input placaIds', async () => {
    const ids = [PLACA_1, PLACA_2];
    mockPlacaFind.mockReturnValue(chainQuery(ids.map((id) => makePlate(id))));
    mockTemporalFind
      .mockReturnValueOnce(chainQuery([]))
      .mockReturnValueOnce(chainQuery([]));

    const results = await service.resolveMany(ids, EMPRESA_A);

    expect(results).toHaveLength(2);
    expect(results[0]?.placaId).toBe(PLACA_1);
    expect(results[1]?.placaId).toBe(PLACA_2);
  });

  it('resolveMany([]) returns empty array without querying DB', async () => {
    const results = await service.resolveMany([], EMPRESA_A);
    expect(results).toEqual([]);
    expect(mockPlacaFind).not.toHaveBeenCalled();
  });
});
