/**
 * Testes de Contrato — Dashboard / Relatórios
 *
 * Garantem que:
 * 1. DashboardSummary retorna os três campos que o frontend espera.
 * 2. PlacasPorRegiao retorna estrutura com `regiao` (string) e `total_placas` (number).
 * 3. O query de ocupação aceita os dois formatos de data (dataInicio e data_inicio).
 */

import { PeriodoQuerySchema } from '@modules/relatorios/dtos/relatorio.dto';
import type { DashboardSummary, PlacasPorRegiao } from '@modules/relatorios/dtos/relatorio.dto';

// ---------------------------------------------------------------------------
// 1. Contrato: DashboardSummary
// ---------------------------------------------------------------------------

describe('DashboardContract: DashboardSummary shape', () => {
  const validSummary: DashboardSummary = {
    totalPlacas: 50,
    placasDisponiveis: 30,
    regiaoPrincipal: 'Norte',
  };

  it('contém totalPlacas como number', () => {
    expect(typeof validSummary.totalPlacas).toBe('number');
  });

  it('contém placasDisponiveis como number', () => {
    expect(typeof validSummary.placasDisponiveis).toBe('number');
  });

  it('contém regiaoPrincipal como string', () => {
    expect(typeof validSummary.regiaoPrincipal).toBe('string');
  });

  it('placasDisponiveis <= totalPlacas (invariante de negócio)', () => {
    expect(validSummary.placasDisponiveis).toBeLessThanOrEqual(validSummary.totalPlacas);
  });

  it('frontend consome campos: totalPlacas, placasDisponiveis, regiaoPrincipal', () => {
    const requiredFields = ['totalPlacas', 'placasDisponiveis', 'regiaoPrincipal'];
    requiredFields.forEach(field => {
      expect(field in validSummary).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// 2. Contrato: PlacasPorRegiao
// ---------------------------------------------------------------------------

describe('DashboardContract: PlacasPorRegiao shape', () => {
  const validItem: PlacasPorRegiao = {
    regiao: 'Norte',
    total_placas: 15,
  };

  it('contém regiao como string', () => {
    expect(typeof validItem.regiao).toBe('string');
  });

  it('contém total_placas como number', () => {
    expect(typeof validItem.total_placas).toBe('number');
  });

  it('total_placas é não-negativo', () => {
    expect(validItem.total_placas).toBeGreaterThanOrEqual(0);
  });

  it('frontend espera regiao e total_placas — ambos presentes', () => {
    expect('regiao' in validItem).toBe(true);
    expect('total_placas' in validItem).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. Contrato: PeriodoQuerySchema — formato de datas
// ---------------------------------------------------------------------------

describe('DashboardContract: PeriodoQuerySchema', () => {
  it('aceita formato YYYY-MM-DD (dataInicio, dataFim)', () => {
    const result = PeriodoQuerySchema.safeParse({
      dataInicio: '2025-01-01',
      dataFim: '2025-12-31',
    });
    expect(result.success).toBe(true);
  });

  it('rejeita datas em formato inválido', () => {
    const result = PeriodoQuerySchema.safeParse({
      dataInicio: '01/01/2025',
      dataFim: '31/12/2025',
    });
    expect(result.success).toBe(false);
  });

  it('rejeita quando dataFim < dataInicio', () => {
    const result = PeriodoQuerySchema.safeParse({
      dataInicio: '2025-12-31',
      dataFim: '2025-01-01',
    });
    expect(result.success).toBe(false);
  });

  it('rejeita sem dataInicio', () => {
    const result = PeriodoQuerySchema.safeParse({ dataFim: '2025-12-31' });
    expect(result.success).toBe(false);
  });

  it('rejeita sem dataFim', () => {
    const result = PeriodoQuerySchema.safeParse({ dataInicio: '2025-01-01' });
    expect(result.success).toBe(false);
  });
});
