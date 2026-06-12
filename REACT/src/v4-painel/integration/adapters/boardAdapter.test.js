import { describe, expect, it } from 'vitest';
import { normalizeBoard } from './boardAdapter.js';

describe('boardAdapter operationalBlock', () => {
  it('preserva operationalBlock retornado no nivel canonico da board', () => {
    const operationalBlock = {
      blocked: true,
      reason: 'Esta placa já possui uma operação em aberto.',
      operationId: 'op-1',
      operationType: 'MAINTENANCE',
      operationStatus: 'IN_PROGRESS',
      status: 'IN_PROGRESS',
      label: 'Manutenção em andamento',
    };

    const board = normalizeBoard({
      id: 'board-1',
      numero_placa: '07',
      operationalBlock,
    });

    expect(board.operationalBlock).toEqual(operationalBlock);
    expect(board.isAllocationBlocked).toBe(true);
  });

  it('trata operationalBlock blocked=false como placa liberada', () => {
    const board = normalizeBoard({
      id: 'board-1',
      numero_placa: '07',
      commercialProjection: { operationalBlock: { blocked: false } },
    });

    expect(board.operationalBlock).toBeNull();
    expect(board.isAllocationBlocked).toBe(false);
  });

  it('preserva operationalBlock de raspagem (SCRAPING) recebido via commercialProjection', () => {
    const operationalBlock = {
      blocked: true,
      reason: 'Esta placa já possui uma operação em aberto.',
      operationId: 'op-rasp-1',
      operationType: 'SCRAPING',
      operationStatus: 'PENDING',
      status: 'PENDING',
      label: 'Raspagem pendente',
    };

    const board = normalizeBoard({
      id: 'board-1',
      numero_placa: '07',
      commercialProjection: { operationalBlock },
    });

    expect(board.operationalBlock).toEqual(operationalBlock);
    expect(board.isAllocationBlocked).toBe(true);
  });
});
