import { describe, expect, it } from 'vitest';
import {
  detectOperationalGaps,
  buildAutoOrganizationPreview,
  applyDragMove,
  formatOperationalNumber,
  getFriendlyOrganizationError,
} from './placaOrganizationUtils';

describe('placaOrganizationUtils', () => {
  it('detecta espacos vazios na sequencia', () => {
    const result = detectOperationalGaps([
      { id: '1', numeroOperacional: 1 },
      { id: '2', numeroOperacional: 2 },
      { id: '3', numeroOperacional: 4 },
    ]);

    expect(result.gapCount).toBe(1);
    expect(result.gaps).toEqual([3]);
  });

  it('gera preview automatico sem salvar', () => {
    const preview = buildAutoOrganizationPreview([
      { id: '1', numeroOperacional: 1 },
      { id: '2', numeroOperacional: 3 },
      { id: '3', numeroOperacional: 4 },
    ]);

    expect(preview.before.map((p) => p.numeroOperacional)).toEqual([1, 3, 4]);
    expect(preview.after.map((p) => p.numeroOperacional)).toEqual([1, 2, 3]);
  });

  it('reordena localmente ao mover card', () => {
    const moved = applyDragMove([
      { id: 'a', numeroOperacional: 1 },
      { id: 'b', numeroOperacional: 2 },
      { id: 'c', numeroOperacional: 3 },
    ], 'c', 'a');

    expect(moved.map((item) => item.id)).toEqual(['c', 'a', 'b']);
    expect(moved.map((item) => item.numeroOperacional)).toEqual([1, 2, 3]);
  });

  it('formata numero visual amigavel', () => {
    expect(formatOperationalNumber(1)).toBe('#001');
    expect(formatOperationalNumber(12)).toBe('#012');
  });

  it('retorna erro amigavel para falha ao salvar', () => {
    expect(getFriendlyOrganizationError()).toBe('Não foi possível salvar a nova ordem. Tente novamente.');
  });
});
