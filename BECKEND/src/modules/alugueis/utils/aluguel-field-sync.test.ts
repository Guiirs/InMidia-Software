import { syncAluguelFields } from './aluguel-field-sync';

describe('syncAluguelFields', () => {
  const startDate = new Date('2026-06-01T00:00:00.000Z');
  const endDate = new Date('2026-06-30T00:00:00.000Z');
  const dataInicio = new Date('2026-05-01T00:00:00.000Z');
  const dataFim = new Date('2026-05-31T00:00:00.000Z');

  it('nao altera input sem nenhum dos campos sincronizaveis', () => {
    const input = { status: 'ativo', clienteId: 'cliente-1' };

    expect(syncAluguelFields(input)).toEqual(input);
  });

  it('quando apenas o campo novo (startDate/endDate) vem, replica para o legado', () => {
    const input = { startDate, endDate };

    expect(syncAluguelFields(input)).toEqual({
      startDate,
      endDate,
      data_inicio: startDate,
      data_fim: endDate,
    });
  });

  it('quando apenas o campo legado (data_inicio/data_fim) vem, vira o canonico para os dois', () => {
    const input = { data_inicio: dataInicio, data_fim: dataFim };

    expect(syncAluguelFields(input)).toEqual({
      data_inicio: dataInicio,
      data_fim: dataFim,
      startDate: dataInicio,
      endDate: dataFim,
    });
  });

  it('quando ambos os lados vem, o campo novo (canonico) prevalece nos dois', () => {
    const input = { startDate, data_inicio: dataInicio };

    expect(syncAluguelFields(input)).toEqual({
      startDate,
      data_inicio: startDate,
    });
  });

  it('sincroniza biWeekIds <-> bi_week_ids quando apenas o novo vem', () => {
    const input = { biWeekIds: ['2026-B12'] };

    expect(syncAluguelFields(input)).toEqual({
      biWeekIds: ['2026-B12'],
      bi_week_ids: ['2026-B12'],
    });
  });

  it('sincroniza biWeekIds <-> bi_week_ids quando apenas o legado vem', () => {
    const input = { bi_week_ids: ['2026-B11'] };

    expect(syncAluguelFields(input)).toEqual({
      bi_week_ids: ['2026-B11'],
      biWeekIds: ['2026-B11'],
    });
  });

  it('sincroniza todos os pares simultaneamente preservando outros campos', () => {
    const input = {
      status: 'ativo',
      startDate,
      endDate,
      bi_week_ids: ['2026-B11'],
    };

    expect(syncAluguelFields(input)).toEqual({
      status: 'ativo',
      startDate,
      endDate,
      data_inicio: startDate,
      data_fim: endDate,
      biWeekIds: ['2026-B11'],
      bi_week_ids: ['2026-B11'],
    });
  });

  it('e idempotente: aplicar duas vezes produz o mesmo resultado da primeira', () => {
    const input = { data_inicio: dataInicio, data_fim: dataFim, biWeekIds: ['2026-B12'] };

    const once = syncAluguelFields(input);
    const twice = syncAluguelFields(once);

    expect(twice).toEqual(once);
  });

  it('ignora campos canonicos/legados explicitamente undefined', () => {
    const input = { startDate: undefined, data_inicio: dataInicio };

    expect(syncAluguelFields(input)).toEqual({
      startDate: dataInicio,
      data_inicio: dataInicio,
    });
  });
});
