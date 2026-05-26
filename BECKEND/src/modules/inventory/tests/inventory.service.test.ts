import { inventoryService } from '../services/inventory.service';
import type { InventorySource } from '../contracts/inventory.contracts';

const NOW = new Date('2026-05-18T12:00:00.000Z');

function baseSource(overrides: Partial<InventorySource['placa']> = {}): InventorySource {
  return {
    placa: {
      _id: 'placa-1',
      empresaId: 'empresa-1',
      regiaoId: 'regiao-1',
      numero_placa: 'A-001',
      numeroOperacional: 1,
      coordenadas: '-23.55052,-46.633308',
      disponivel: true,
      ...overrides,
    },
  };
}

describe('InventoryService', () => {
  it('evaluates an available placa', () => {
    const result = inventoryService.evaluateInventoryItem(baseSource(), { now: NOW });

    expect(result.item.availability.status).toBe('available');
    expect(result.item.status.physical).toBe('active');
    expect(result.item.status.operational).toBe('healthy');
    expect(result.diagnostics).toHaveLength(0);
  });

  it('evaluates an occupied placa from active aluguel', () => {
    const result = inventoryService.evaluateInventoryItem({
      ...baseSource(),
      alugueis: [{
        id: 'aluguel-1',
        status: 'ativo',
        startDate: '2026-05-01T00:00:00.000Z',
        endDate: '2026-05-30T00:00:00.000Z',
      }],
    }, { now: NOW });

    expect(result.item.availability.status).toBe('occupied');
    expect(result.item.occupancy.occupied).toBe(true);
    expect(result.item.occupancy.activeSourceIds).toEqual(['aluguel-1']);
  });

  it('evaluates a reserved placa from future aluguel', () => {
    const result = inventoryService.evaluateInventoryItem({
      ...baseSource(),
      alugueis: [{
        id: 'aluguel-2',
        status: 'ativo',
        startDate: '2026-06-01T00:00:00.000Z',
        endDate: '2026-06-30T00:00:00.000Z',
      }],
    }, { now: NOW });

    expect(result.item.availability.status).toBe('reserved');
    expect(result.item.occupancy.reserved).toBe(true);
  });

  it('returns unknown when availability data is incomplete', () => {
    const result = inventoryService.evaluateInventoryItem(baseSource({ disponivel: null, ativa: null }), { now: NOW });

    expect(result.item.availability.status).toBe('unknown');
    expect(result.item.status.operational).toBe('attention');
  });

  it('detects availability conflict with active contract', () => {
    const result = inventoryService.evaluateInventoryItem({
      ...baseSource(),
      contratos: [{ id: 'contrato-1', status: 'ativo' }],
    }, { now: NOW });

    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'AVAILABLE_WITH_ACTIVE_CONTRACT' }),
      ]),
    );
  });

  it('detects duplicated operational number in same empresa/regiao', () => {
    const first = baseSource({ _id: 'placa-1', numeroOperacional: 7 });
    const second = baseSource({ _id: 'placa-2', numeroOperacional: 7 });

    const result = inventoryService.evaluateInventoryItem(first, { now: NOW, sources: [first, second] });

    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'DUPLICATED_OPERATIONAL_NUMBER' }),
      ]),
    );
  });

  it('detects incomplete item without operational number', () => {
    const result = inventoryService.evaluateInventoryItem(baseSource({ numeroOperacional: null }), { now: NOW });

    expect(result.item.status.operational).toBe('incomplete');
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'MISSING_OPERATIONAL_NUMBER' }),
      ]),
    );
  });

  it('detects invalid coordinates for map usage', () => {
    const result = inventoryService.evaluateInventoryItem(baseSource({ coordenadas: '999,999' }), { now: NOW });

    expect(result.item.status.operational).toBe('incomplete');
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'INVALID_MAP_COORDINATES' }),
      ]),
    );
  });

  it('builds inventory summary', () => {
    const sources = [
      baseSource({ _id: 'placa-1', numeroOperacional: 1 }),
      baseSource({ _id: 'placa-2', numeroOperacional: 2, disponivel: false }),
    ];

    const summary = inventoryService.buildInventorySummary(sources, { now: NOW });

    expect(summary.total).toBe(2);
    expect(summary.available).toBe(1);
    expect(summary.unavailable).toBe(1);
  });

  it('keeps compatibility with legacy enriched placa fields', () => {
    const result = inventoryService.evaluateInventoryItem(baseSource({
      statusAluguel: 'alugada',
      aluguel_ativo: true,
    }), { now: NOW });

    expect(result.item.availability.status).toBe('occupied');
    expect(result.item.occupancy.occupied).toBe(true);
  });
});
