/**
 * Commercial Projection Service — unit tests
 *
 * All Mongoose models are mocked so no DB connection is required.
 * Tests cover the 5 canonical scenarios + multi-tenant isolation.
 */

import { Types } from 'mongoose';

// ─── Model mocks (must be set before import of the service) ───────────────────

const mockPlacaFindOne = jest.fn();
const mockPlacaFind = jest.fn();
const mockTemporalFindOne = jest.fn();
const mockTemporalFind = jest.fn();
const mockContratoFindOne = jest.fn();
const mockContratoFind = jest.fn();
const mockPiFindOne = jest.fn();
const mockPiFind = jest.fn();
const mockClienteFindOne = jest.fn();
const mockClienteFind = jest.fn();
const mockOperationFindOne = jest.fn();
const mockOperationFind = jest.fn();

jest.mock('@modules/placas/Placa', () => ({
  __esModule: true,
  default: {
    findOne: (...args: any[]) => mockPlacaFindOne(...args),
    find: (...args: any[]) => mockPlacaFind(...args),
  },
}));

jest.mock('@modules/temporal/TemporalReservation', () => ({
  __esModule: true,
  default: {
    find: (...args: any[]) => mockTemporalFind(...args),
    findOne: (...args: any[]) => mockTemporalFindOne(...args),
  },
}));

jest.mock('@modules/contratos/Contrato', () => ({
  __esModule: true,
  default: {
    findOne: (...args: any[]) => mockContratoFindOne(...args),
    find: (...args: any[]) => mockContratoFind(...args),
  },
}));

jest.mock('@modules/propostas-internas/PropostaInterna', () => ({
  __esModule: true,
  default: {
    findOne: (...args: any[]) => mockPiFindOne(...args),
    find: (...args: any[]) => mockPiFind(...args),
  },
}));

jest.mock('@modules/clientes/Cliente', () => ({
  __esModule: true,
  default: {
    findOne: (...args: any[]) => mockClienteFindOne(...args),
    find: (...args: any[]) => mockClienteFind(...args),
  },
}));

jest.mock('@modules/operations/services/operations-v4.service', () => ({
  __esModule: true,
  OperationRecord: {
    findOne: (...args: any[]) => mockOperationFindOne(...args),
    find: (...args: any[]) => mockOperationFind(...args),
  },
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

import CommercialProjectionService from '../commercial-projection.service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PLACA_ID = new Types.ObjectId().toHexString();
const EMPRESA_ID = new Types.ObjectId().toHexString();
const OTHER_EMPRESA_ID = new Types.ObjectId().toHexString();
const CONTRACT_ID = new Types.ObjectId().toHexString();
const PI_ID = new Types.ObjectId().toHexString();
const CLIENT_ID = new Types.ObjectId().toHexString();

const NOW = new Date('2026-06-01T10:00:00.000Z');
const PAST = new Date('2026-01-01T00:00:00.000Z');
const FUTURE = new Date('2026-12-31T23:59:59.000Z');
const NEXT_WEEK = new Date('2026-06-08T10:00:00.000Z');

/** Returns a lean-like chain for Mongoose queries */
function chainLean(value: any) {
  return {
    select: () => chainLean(value),
    populate: () => chainLean(value),
    sort: () => chainLean(value),
    lean: () => Promise.resolve(value),
  };
}

function makeReservation(overrides: Partial<any> = {}): any {
  return {
    _id: new Types.ObjectId(),
    empresaId: new Types.ObjectId(EMPRESA_ID),
    plateId: new Types.ObjectId(PLACA_ID),
    sourceType: 'CONTRACT',
    sourceId: CONTRACT_ID,
    customerId: new Types.ObjectId(CLIENT_ID),
    startDate: PAST,
    endDate: FUTURE,
    status: 'ACTIVE',
    ...overrides,
  };
}

function makePlate(overrides: Partial<any> = {}): any {
  return { _id: new Types.ObjectId(PLACA_ID), disponivel: true, ativa: true, ...overrides };
}

function makeOperation(overrides: Partial<any> = {}): any {
  const id = overrides._id ?? new Types.ObjectId();
  return {
    _id: id,
    empresaId: new Types.ObjectId(EMPRESA_ID),
    type: 'OPERATION',
    status: 'PENDING',
    payload: {},
    ...overrides,
  };
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('CommercialProjectionService', () => {
  let service: CommercialProjectionService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(NOW);
    mockOperationFind.mockReturnValue(chainLean([]));
    service = new CommercialProjectionService();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ── Scenario 1: No contract → AVAILABLE ──────────────────────────────────

  describe('Scenario 1 — no contract or reservation', () => {
    beforeEach(() => {
      mockPlacaFindOne.mockReturnValue(chainLean(makePlate()));
      // no blocking reservations, no expired
      mockTemporalFind.mockReturnValue(chainLean([]));
    });

    it('returns AVAILABLE when plate is active and has no reservations', async () => {
      const result = await service.resolve(PLACA_ID, EMPRESA_ID);

      expect(result.commercialStatus).toBe('AVAILABLE');
      expect(result.activeContract).toBeUndefined();
      expect(result.reservation.active).toBe(false);
      expect(result.reservation.future).toBe(false);
      expect(result.pricing).toBeUndefined();
      expect(result.placaId).toBe(PLACA_ID);
      expect(result.empresaId).toBe(EMPRESA_ID);
      expect(result.resolvedAt).toBeDefined();
    });
  });

  // ── Scenario 2: Future reservation → FUTURE_RESERVED ────────────────────

  describe('Scenario 2 — future reservation only', () => {
    beforeEach(() => {
      mockPlacaFindOne.mockReturnValue(chainLean(makePlate()));

      const futureReservation = makeReservation({
        sourceType: 'PI',
        sourceId: PI_ID,
        startDate: NEXT_WEEK,
        endDate: FUTURE,
        status: 'RESERVED',
      });

      // First find() call = blocking active (empty), second = future reservations
      // Service does one find() for blocking, one for expired
      mockTemporalFind
        .mockReturnValueOnce(chainLean([futureReservation])) // blocking reservations (no active ones)
        .mockReturnValueOnce(chainLean([])); // expired pending

      mockPiFindOne.mockReturnValue(
        chainLean({
          _id: new Types.ObjectId(PI_ID),
          pi_code: 'PI-2026-001',
          valorTotal: 5000,
          clienteId: { _id: new Types.ObjectId(CLIENT_ID), nome: 'Empresa X', nomeFantasia: null },
          startDate: NEXT_WEEK,
          endDate: FUTURE,
        }),
      );
    });

    it('returns FUTURE_RESERVED when only a future PI reservation exists', async () => {
      const result = await service.resolve(PLACA_ID, EMPRESA_ID);

      expect(result.commercialStatus).toBe('FUTURE_RESERVED');
      expect(result.reservation.active).toBe(false);
      expect(result.reservation.future).toBe(true);
      expect(result.activeContract?.piCode).toBe('PI-2026-001');
      expect(result.activeContract?.clientName).toBe('Empresa X');
      expect(result.pricing?.contractValue).toBe(5000);
    });
  });

  // ── Scenario 3: Active contract → CONTRACTED_ACTIVE ─────────────────────

  describe('Scenario 3 — active contract', () => {
    beforeEach(() => {
      mockPlacaFindOne.mockReturnValue(chainLean(makePlate()));

      const activeReservation = makeReservation({
        sourceType: 'CONTRACT',
        sourceId: CONTRACT_ID,
        startDate: PAST,
        endDate: FUTURE,
        status: 'ACTIVE',
      });

      mockTemporalFind
        .mockReturnValueOnce(chainLean([activeReservation]))
        .mockReturnValueOnce(chainLean([]));

      mockContratoFindOne.mockReturnValue(
        chainLean({
          _id: new Types.ObjectId(CONTRACT_ID),
          numero: 'CONT-2026-100',
          piId: {
            _id: new Types.ObjectId(PI_ID),
            pi_code: 'PI-2026-050',
            valorTotal: 12000,
            startDate: PAST,
            endDate: FUTURE,
          },
          clienteId: {
            _id: new Types.ObjectId(CLIENT_ID),
            nome: 'Cliente Ativo Ltda',
            nomeFantasia: 'ClienteAtivo',
          },
        }),
      );
    });

    it('returns CONTRACTED_ACTIVE with full enrichment', async () => {
      const result = await service.resolve(PLACA_ID, EMPRESA_ID);

      expect(result.commercialStatus).toBe('CONTRACTED_ACTIVE');
      expect(result.reservation.active).toBe(true);
      expect(result.activeContract?.contractCode).toBe('CONT-2026-100');
      expect(result.activeContract?.clientName).toBe('ClienteAtivo');
      expect(result.activeContract?.piCode).toBe('PI-2026-050');
      expect(result.pricing?.contractValue).toBe(12000);
    });
  });

  // ── Scenario 4: Maintenance (plate physically unavailable) ───────────────

  describe('Scenario 4 — maintenance', () => {
    beforeEach(() => {
      mockPlacaFindOne.mockReturnValue(chainLean(makePlate({ disponivel: false })));
      mockTemporalFind
        .mockReturnValueOnce(chainLean([]))
        .mockReturnValueOnce(chainLean([]));
    });

    it('returns MAINTENANCE when plate.disponivel is false', async () => {
      const result = await service.resolve(PLACA_ID, EMPRESA_ID);

      expect(result.commercialStatus).toBe('MAINTENANCE');
      expect(result.activeContract).toBeUndefined();
    });
  });

  describe('Scenario 4b — MANUAL_BLOCK reservation', () => {
    beforeEach(() => {
      mockPlacaFindOne.mockReturnValue(chainLean(makePlate()));

      const blockedReservation = makeReservation({
        sourceType: 'MANUAL_BLOCK',
        sourceId: 'manual-block-1',
        startDate: PAST,
        endDate: FUTURE,
        status: 'BLOCKED',
      });

      mockTemporalFind
        .mockReturnValueOnce(chainLean([blockedReservation]))
        .mockReturnValueOnce(chainLean([]));
    });

    it('returns MAINTENANCE when active MANUAL_BLOCK reservation exists', async () => {
      const result = await service.resolve(PLACA_ID, EMPRESA_ID);

      expect(result.commercialStatus).toBe('MAINTENANCE');
      expect(result.activeContract).toBeUndefined();
    });
  });

  // ── operationalBlock enrichment (OPERATION-sourced reservations) ─────────

  describe('operationalBlock enrichment', () => {
    const OPERATION_ID = new Types.ObjectId();

    function setupActiveOperationReservation(payload: Record<string, any>) {
      mockPlacaFindOne.mockReturnValue(chainLean(makePlate()));

      const operationReservation = makeReservation({
        sourceType: 'OPERATION',
        sourceId: String(OPERATION_ID),
        startDate: PAST,
        endDate: FUTURE,
        status: 'ACTIVE',
      });

      mockTemporalFind
        .mockReturnValueOnce(chainLean([operationReservation]))
        .mockReturnValueOnce(chainLean([]));

      mockOperationFind.mockReturnValue(chainLean([
        makeOperation({ _id: OPERATION_ID, payload: { plateId: PLACA_ID, ...payload } }),
      ]));
    }

    it.each([
      ['INSTALLATION', 'PENDING', 'Pendente de instalação'],
      ['INSTALLATION', 'IN_PROGRESS', 'Instalação em andamento'],
      ['SCRAPING', 'PENDING', 'Raspagem pendente'],
      ['SCRAPING', 'IN_PROGRESS', 'Raspagem em andamento'],
      ['MAINTENANCE', 'PENDING', 'Manutenção pendente'],
      ['MAINTENANCE', 'IN_PROGRESS', 'Manutenção em andamento'],
      ['BLOCK', 'PENDING', 'Bloqueio operacional'],
      ['BLOCK', 'IN_PROGRESS', 'Bloqueio operacional'],
    ])('resolve(): %s/%s -> "%s"', async (operationType, operationStatus, expectedLabel) => {
      setupActiveOperationReservation({
        operationType,
        operationStatus,
        assignedTo: 'Equipe Norte',
        notes: 'Observacao do operador',
      });

      const result = await service.resolve(PLACA_ID, EMPRESA_ID);

      expect(result.commercialStatus).toBe('MAINTENANCE');
      expect(result.operationalBlock).toBeDefined();
      expect(result.operationalBlock?.blocked).toBe(true);
      expect(result.operationalBlock?.reason).toBe('Esta placa já possui uma operação em aberto.');
      expect(result.operationalBlock?.operationId).toBe(String(OPERATION_ID));
      expect(result.operationalBlock?.operationType).toBe(operationType);
      expect(result.operationalBlock?.operationStatus).toBe(operationStatus);
      expect(result.operationalBlock?.label).toBe(expectedLabel);
      expect(result.operationalBlock?.assignedTo).toBe('Equipe Norte');
      expect(result.operationalBlock?.notes).toBe('Observacao do operador');
    });

    it('resolve(): omits assignedTo/notes when not present on the operation', async () => {
      setupActiveOperationReservation({ operationType: 'INSTALLATION', operationStatus: 'PENDING' });

      const result = await service.resolve(PLACA_ID, EMPRESA_ID);

      expect(result.operationalBlock).toBeDefined();
      expect(result.operationalBlock?.assignedTo).toBeUndefined();
      expect(result.operationalBlock?.notes).toBeUndefined();
    });

    it('resolve(): propagates teamSnapshot from the open operation payload', async () => {
      const teamSnapshot = { id: 'team-1', name: 'Equipe Fortaleza 01', memberCount: 3, members: [] };
      setupActiveOperationReservation({ operationType: 'SCRAPING', operationStatus: 'IN_PROGRESS', teamSnapshot });

      const result = await service.resolve(PLACA_ID, EMPRESA_ID);

      expect(result.operationalBlock?.teamSnapshot).toEqual(teamSnapshot);
    });

    it('resolve(): omits teamSnapshot when the open operation has no team assigned', async () => {
      setupActiveOperationReservation({ operationType: 'INSTALLATION', operationStatus: 'PENDING' });

      const result = await service.resolve(PLACA_ID, EMPRESA_ID);

      expect(result.operationalBlock?.teamSnapshot).toBeUndefined();
    });

    it('resolve(): does not set operationalBlock when the active reservation is not OPERATION-sourced', async () => {
      mockPlacaFindOne.mockReturnValue(chainLean(makePlate()));

      const contractReservation = makeReservation({
        sourceType: 'CONTRACT',
        sourceId: CONTRACT_ID,
        startDate: PAST,
        endDate: FUTURE,
        status: 'ACTIVE',
      });

      mockTemporalFind
        .mockReturnValueOnce(chainLean([contractReservation]))
        .mockReturnValueOnce(chainLean([]));

      mockContratoFindOne.mockReturnValue(chainLean(null));

      const result = await service.resolve(PLACA_ID, EMPRESA_ID);

      expect(result.operationalBlock).toBeUndefined();
      expect(mockOperationFindOne).not.toHaveBeenCalled();
    });

    describe('resolveMany / resolveBatch', () => {
      beforeEach(() => {
        mockContratoFind.mockReturnValue(chainLean([]));
        mockPiFind.mockReturnValue(chainLean([]));
        mockClienteFind.mockReturnValue(chainLean([]));
      });

      it('enriches operationalBlock for plates with an active OPERATION reservation', async () => {
        mockPlacaFind.mockReturnValue(chainLean([makePlate()]));

        const operationReservation = makeReservation({
          sourceType: 'OPERATION',
          sourceId: String(OPERATION_ID),
          startDate: PAST,
          endDate: FUTURE,
          status: 'ACTIVE',
        });

        mockTemporalFind
          .mockReturnValueOnce(chainLean([operationReservation]))
          .mockReturnValueOnce(chainLean([]));

        mockOperationFind.mockReturnValue(chainLean([
          makeOperation({
            _id: OPERATION_ID,
            payload: {
              plateId: PLACA_ID,
              operationType: 'MAINTENANCE',
              operationStatus: 'IN_PROGRESS',
              assignedTo: 'Equipe Sul',
              notes: 'Troca de lona',
            },
          }),
        ]));

        const [result] = await service.resolveMany([PLACA_ID], EMPRESA_ID);

        expect(result.commercialStatus).toBe('MAINTENANCE');
        expect(result.operationalBlock).toBeDefined();
        expect(result.operationalBlock?.operationId).toBe(String(OPERATION_ID));
        expect(result.operationalBlock?.operationType).toBe('MAINTENANCE');
        expect(result.operationalBlock?.operationStatus).toBe('IN_PROGRESS');
        expect(result.operationalBlock?.label).toBe('Manutenção em andamento');
        expect(result.operationalBlock?.assignedTo).toBe('Equipe Sul');
        expect(result.operationalBlock?.notes).toBe('Troca de lona');
      });

      it('does not set operationalBlock for plates without an active OPERATION reservation', async () => {
        mockPlacaFind.mockReturnValue(chainLean([makePlate()]));
        mockTemporalFind
          .mockReturnValueOnce(chainLean([]))
          .mockReturnValueOnce(chainLean([]));

        const [result] = await service.resolveMany([PLACA_ID], EMPRESA_ID);

        expect(result.operationalBlock).toBeUndefined();
        expect(mockOperationFind).toHaveBeenCalled();
      });

      it('enriches operationalBlock from an open operation even without a temporal reservation', async () => {
        mockPlacaFind.mockReturnValue(chainLean([makePlate()]));
        mockTemporalFind
          .mockReturnValueOnce(chainLean([]))
          .mockReturnValueOnce(chainLean([]));
        mockOperationFind.mockReturnValue(chainLean([
          makeOperation({
            payload: {
              plateId: PLACA_ID,
              operationType: 'SCRAPING',
              operationStatus: 'SCHEDULED',
            },
          }),
        ]));

        const [result] = await service.resolveMany([PLACA_ID], EMPRESA_ID);

        expect(result.operationalBlock).toMatchObject({
          blocked: true,
          operationType: 'SCRAPING',
          operationStatus: 'SCHEDULED',
          label: 'Raspagem pendente',
        });
      });

      it.each(['DONE', 'CANCELLED', 'finalizado', 'cancelado'])(
        'does not block the plate for final operation status %s',
        async (operationStatus) => {
          mockPlacaFind.mockReturnValue(chainLean([makePlate()]));
          mockTemporalFind
            .mockReturnValueOnce(chainLean([]))
            .mockReturnValueOnce(chainLean([]));
          mockOperationFind.mockReturnValue(chainLean([
            makeOperation({
              payload: { plateId: PLACA_ID, operationType: 'MAINTENANCE', operationStatus },
            }),
          ]));

          const [result] = await service.resolveMany([PLACA_ID], EMPRESA_ID);
          expect(result.operationalBlock).toBeUndefined();
        },
      );
    });
  });

  // ── Scenario 5: Inconsistent data → UNKNOWN ──────────────────────────────

  describe('Scenario 5 — expired pending release (inconsistent state)', () => {
    beforeEach(() => {
      mockPlacaFindOne.mockReturnValue(chainLean(makePlate()));
      mockTemporalFind
        .mockReturnValueOnce(chainLean([]))  // no active blocking
        .mockReturnValueOnce(chainLean([{ _id: new Types.ObjectId() }])); // expired pending
    });

    it('returns UNKNOWN when expired reservations have not been released', async () => {
      const result = await service.resolve(PLACA_ID, EMPRESA_ID);

      expect(result.commercialStatus).toBe('UNKNOWN');
    });
  });

  // ── Multi-tenant isolation ────────────────────────────────────────────────

  describe('Multi-tenant isolation', () => {
    it('throws 404 when plate belongs to a different empresaId', async () => {
      mockPlacaFindOne.mockReturnValue(chainLean(null)); // plate not found for this tenant

      await expect(service.resolve(PLACA_ID, OTHER_EMPRESA_ID)).rejects.toMatchObject({
        message: 'Placa nao encontrada.',
        statusCode: 404,
      });

      // Verify the query included the empresaId filter
      expect(mockPlacaFindOne).toHaveBeenCalledWith(
        expect.objectContaining({ empresaId: expect.any(Types.ObjectId) }),
      );
    });

    it('does not leak reservations from another tenant', async () => {
      // Plate exists for EMPRESA_ID but TemporalReservation.find is called with empresaId filter
      mockPlacaFindOne.mockReturnValue(chainLean(makePlate()));
      mockTemporalFind
        .mockReturnValueOnce(chainLean([]))
        .mockReturnValueOnce(chainLean([]));

      await service.resolve(PLACA_ID, EMPRESA_ID);

      const findCalls = mockTemporalFind.mock.calls;
      findCalls.forEach((call: any[]) => {
        expect(call[0]).toMatchObject({
          empresaId: expect.any(Types.ObjectId),
        });
      });
    });
  });

  // ── resolveMany (now backed by resolveBatch) ─────────────────────────────

  describe('resolveMany', () => {
    beforeEach(() => {
      // resolveMany calls resolveBatch which uses find (not findOne)
      mockContratoFind.mockReturnValue(chainLean([]));
      mockPiFind.mockReturnValue(chainLean([]));
      mockClienteFind.mockReturnValue(chainLean([]));
    });

    it('resolves multiple plates independently via batch', async () => {
      const plate2 = new Types.ObjectId().toHexString();

      // resolveBatch uses Placa.find + TemporalReservation.find (×2)
      mockPlacaFind.mockReturnValue(chainLean([makePlate(), { _id: new Types.ObjectId(plate2), disponivel: true, ativa: true }]));
      mockTemporalFind
        .mockReturnValueOnce(chainLean([]))   // blocking
        .mockReturnValueOnce(chainLean([]));  // expired

      const results = await service.resolveMany([PLACA_ID, plate2], EMPRESA_ID);

      expect(results).toHaveLength(2);
      results.forEach((r) => expect(r.commercialStatus).toBe('AVAILABLE'));
    });
  });
});
