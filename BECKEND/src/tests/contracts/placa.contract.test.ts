/**
 * Testes de Contrato — Placa
 *
 * Garantem que:
 * 1. O backend aceita os query params que o frontend usa.
 * 2. O backend retorna os campos que o frontend espera.
 * 3. O limit máximo do frontend (1000) não quebra o backend.
 * 4. O campo canônico `disponivel` está presente em PlacaListItem.
 * 5. `disponivel` e `ativa` nunca divergem no toListItem.
 * 6. `regiaoId` é aceito (não `regiao_id` direto sem alias).
 *
 * Estes testes falham se voltar a acontecer:
 *   - ativa vs disponivel divergente
 *   - limit do frontend maior que o backend suporta
 *   - _id/id ausentes sem adapter
 *   - regiao_id vs regiaoId sem normalização
 */

import {
  ListPlacasQuerySchema,
  toListItem,
  validateCreatePlaca,
  validateUpdatePlaca,
  validateListQuery,
} from '@modules/placas/dtos/placa.dto';

// ---------------------------------------------------------------------------
// 1. Contrato: query params de listagem
// ---------------------------------------------------------------------------

describe('PlacaContract: ListPlacasQuerySchema', () => {
  it('aceita limit=10 (default do frontend)', () => {
    const result = ListPlacasQuerySchema.safeParse({ limit: '10' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.limit).toBe(10);
  });

  it('aceita limit=1000 — limite máximo que o frontend pode enviar', () => {
    const result = ListPlacasQuerySchema.safeParse({ limit: '1000' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.limit).toBe(1000);
  });

  it('rejeita limit > 1000', () => {
    const result = ListPlacasQuerySchema.safeParse({ limit: '1001' });
    expect(result.success).toBe(false);
  });

  it('aceita ativa=true (filtro legado do frontend)', () => {
    const result = ListPlacasQuerySchema.safeParse({ ativa: 'true' });
    expect(result.success).toBe(true);
  });

  it('aceita disponivel=true (filtro canônico)', () => {
    const result = ListPlacasQuerySchema.safeParse({ disponivel: 'true' });
    expect(result.success).toBe(true);
  });

  it('aceita regiaoId como string ObjectId', () => {
    const result = ListPlacasQuerySchema.safeParse({ regiaoId: '507f1f77bcf86cd799439011' });
    expect(result.success).toBe(true);
  });

  it('normaliza regiao_id → regiaoId via validateListQuery', () => {
    const result = validateListQuery({ regiao_id: '507f1f77bcf86cd799439011' });
    expect(result.regiaoId).toBe('507f1f77bcf86cd799439011');
  });

  it('aplica defaults: page=1, limit=10, sortBy=numero_placa, order=asc', () => {
    const result = ListPlacasQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(10);
      expect(result.data.sortBy).toBe('numero_placa');
      expect(result.data.order).toBe('asc');
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Contrato: CreatePlacaSchema — alias ativa → disponivel
// ---------------------------------------------------------------------------

describe('PlacaContract: validateCreatePlaca', () => {
  const base = { numero_placa: 'XYZ-001', regiaoId: '507f1f77bcf86cd799439011' };

  it('cria placa com disponivel=true (default)', () => {
    const dto = validateCreatePlaca(base);
    expect(dto.disponivel).toBe(true);
  });

  it('aceita disponivel=false explícito', () => {
    const dto = validateCreatePlaca({ ...base, disponivel: false });
    expect(dto.disponivel).toBe(false);
  });

  it('normaliza alias ativa=false para disponivel=false', () => {
    const dto = validateCreatePlaca({ ...base, ativa: false });
    expect(dto.disponivel).toBe(false);
  });

  it('disponivel tem precedência sobre ativa quando ambos são passados', () => {
    const dto = validateCreatePlaca({ ...base, disponivel: true, ativa: false });
    expect(dto.disponivel).toBe(true);
  });

  it('rejeita sem numero_placa', () => {
    expect(() => validateCreatePlaca({ regiaoId: '507f1f77bcf86cd799439011' })).toThrow();
  });

  it('rejeita sem regiaoId', () => {
    expect(() => validateCreatePlaca({ numero_placa: 'XYZ-001' })).toThrow();
  });

  it('ignora clienteId e contratoId no create canonico de placa', () => {
    const dto = validateCreatePlaca({
      ...base,
      clienteId: '507f1f77bcf86cd799439014',
      contratoId: '507f1f77bcf86cd799439015',
    });
    expect((dto as any).clienteId).toBeUndefined();
    expect((dto as any).contratoId).toBeUndefined();
  });

  it('ignora valor e periodo no update canonico de placa', () => {
    const dto = validateUpdatePlaca({
      endereco: 'Rua Operacional',
      valor_mensal: 1000,
      valor: 1000,
      dataInicio: '2026-06-01',
      dataFim: '2026-06-30',
    });
    expect(dto.endereco).toBe('Rua Operacional');
    expect((dto as any).valor_mensal).toBeUndefined();
    expect((dto as any).valor).toBeUndefined();
    expect((dto as any).dataInicio).toBeUndefined();
    expect((dto as any).dataFim).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 3. Contrato: toListItem — campos canônicos no response
// ---------------------------------------------------------------------------

describe('PlacaContract: toListItem — campos do response', () => {
  const makeRawPlaca = (overrides = {}): any => ({
    _id: { toString: () => '507f1f77bcf86cd799439011', toHexString: () => '507f1f77bcf86cd799439011' },
    numero_placa: 'TEST-001',
    disponivel: true,
    regiaoId: { _id: '507f1f77bcf86cd799439012', nome: 'Norte' },
    localizacao: 'Rua A',
    empresaId: '507f1f77bcf86cd799439013',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  it('retorna campo `disponivel` como boolean', () => {
    const item = toListItem(makeRawPlaca({ disponivel: true }));
    expect(typeof item.disponivel).toBe('boolean');
    expect(item.disponivel).toBe(true);
  });

  it('retorna campo `ativa` igual a `disponivel` (sem divergência)', () => {
    const item = toListItem(makeRawPlaca({ disponivel: false }));
    expect(item.disponivel).toBe(false);
    expect(item.ativa).toBe(item.disponivel);
  });

  it('usa disponivel do DB quando ativa está ausente (bug original)', () => {
    // Simula documento MongoDB real: só tem `disponivel`, não `ativa`
    const rawSemAtiva = makeRawPlaca({ disponivel: false });
    delete rawSemAtiva.ativa;
    const item = toListItem(rawSemAtiva);
    expect(item.disponivel).toBe(false);
  });

  it('retorna `id` e `_id` como strings', () => {
    const item = toListItem(makeRawPlaca());
    expect(typeof item.id).toBe('string');
    expect(typeof item._id).toBe('string');
    expect(item.id).toBe(item._id);
  });

  it('retorna `numero_placa`', () => {
    const item = toListItem(makeRawPlaca());
    expect(item.numero_placa).toBe('TEST-001');
  });

  it('retorna `regiao` como objeto com nome', () => {
    const item = toListItem(makeRawPlaca());
    expect(typeof item.regiao).toBe('object');
    expect(item.regiao_nome).toBe('Norte');
  });

  it('retorna `nomeDaRua` mapeado de localizacao', () => {
    const item = toListItem(makeRawPlaca({ localizacao: 'Av. Brasil' }));
    expect(item.nomeDaRua).toBe('Av. Brasil');
  });

  it('prefere nomeDaRua sobre localizacao quando ambos presentes', () => {
    const item = toListItem(makeRawPlaca({ nomeDaRua: 'Rua Correta', localizacao: 'Rua Antiga' }));
    expect(item.nomeDaRua).toBe('Rua Correta');
  });
});

// ---------------------------------------------------------------------------
// 4. Regressão: ativa vs disponivel — nunca devem divergir
// ---------------------------------------------------------------------------

describe('PlacaContract: regressão — ativa e disponivel nunca divergem', () => {
  const makeRaw = (disponivel: boolean): any => ({
    _id: { toString: () => 'abc123', toHexString: () => 'abc123' },
    numero_placa: 'REG-001',
    disponivel,
    regiaoId: { _id: 'reg1', nome: 'Sul' },
    localizacao: 'Rua B',
    empresaId: 'emp1',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  it.each([true, false])('disponivel=%s → ativa === disponivel', (val) => {
    const item = toListItem(makeRaw(val));
    expect(item.ativa).toBe(item.disponivel);
  });
});
