/**
 * Testes de Contrato — Região
 *
 * Garantem que:
 * 1. ListRegioesQuerySchema aceita os params usados pelo frontend.
 * 2. O limite de regiões (max=100) não quebra quando o frontend não passa limit.
 * 3. RegiaoListItem contém os campos que o frontend espera.
 * 4. O transformer toListItem produz `id` canônico.
 */

import {
  ListRegioesQuerySchema,
  CreateRegiaoSchema,
  toListItem,
} from '@modules/regioes/dtos/regiao.dto';
import type { RegiaoEntity, RegiaoListItem } from '@modules/regioes/dtos/regiao.dto';
import { Types } from 'mongoose';

// ---------------------------------------------------------------------------
// 1. Contrato: ListRegioesQuerySchema
// ---------------------------------------------------------------------------

describe('RegiaoContract: ListRegioesQuerySchema', () => {
  it('aplica default limit=100 quando não informado (ARCH-2: aumentado de 50 para 100)', () => {
    const result = ListRegioesQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(100);
      expect(result.data.page).toBe(1);
    }
  });

  it('aceita limit=500 (máximo permitido — ARCH-2)', () => {
    const result = ListRegioesQuerySchema.safeParse({ limit: '500' });
    expect(result.success).toBe(true);
  });

  it('aceita limit=100 (antigo máximo, ainda válido)', () => {
    const result = ListRegioesQuerySchema.safeParse({ limit: '100' });
    expect(result.success).toBe(true);
  });

  it('rejeita limit > 500 — frontend deve respeitar este limite', () => {
    const result = ListRegioesQuerySchema.safeParse({ limit: '501' });
    expect(result.success).toBe(false);
  });

  it('aceita filtro search como string', () => {
    const result = ListRegioesQuerySchema.safeParse({ search: 'Norte' });
    expect(result.success).toBe(true);
  });

  it('aceita ativo=true como boolean coercível', () => {
    const result = ListRegioesQuerySchema.safeParse({ ativo: 'true' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.ativo).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. Contrato: CreateRegiaoSchema
// ---------------------------------------------------------------------------

describe('RegiaoContract: CreateRegiaoSchema', () => {
  it('aceita nome e codigo obrigatórios', () => {
    const result = CreateRegiaoSchema.safeParse({ nome: 'Norte', codigo: 'N' });
    expect(result.success).toBe(true);
  });

  it('rejeita sem nome', () => {
    const result = CreateRegiaoSchema.safeParse({ codigo: 'N' });
    expect(result.success).toBe(false);
  });

  it('rejeita sem codigo', () => {
    const result = CreateRegiaoSchema.safeParse({ nome: 'Norte' });
    expect(result.success).toBe(false);
  });

  it('converte codigo para maiúsculas', () => {
    const result = CreateRegiaoSchema.safeParse({ nome: 'Norte', codigo: 'norte' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.codigo).toBe('NORTE');
  });
});

// ---------------------------------------------------------------------------
// 3. Contrato: toListItem — campos do response
// ---------------------------------------------------------------------------

describe('RegiaoContract: toListItem shape', () => {
  const makeRegiaoEntity = (): RegiaoEntity & { placasCount?: number } => ({
    _id: new Types.ObjectId('507f1f77bcf86cd799439011'),
    nome: 'Norte',
    codigo: 'N',
    ativo: true,
    empresaId: new Types.ObjectId('507f1f77bcf86cd799439012'),
    createdAt: new Date(),
    updatedAt: new Date(),
    placasCount: 5,
  });

  let item: RegiaoListItem;

  beforeEach(() => {
    item = toListItem(makeRegiaoEntity());
  });

  it('retorna `id` como string', () => {
    expect(typeof item.id).toBe('string');
    expect(item.id).toBe('507f1f77bcf86cd799439011');
  });

  it('retorna `nome`', () => {
    expect(item.nome).toBe('Norte');
  });

  it('retorna `codigo`', () => {
    expect(item.codigo).toBe('N');
  });

  it('retorna `ativo` como boolean', () => {
    expect(typeof item.ativo).toBe('boolean');
  });

  it('retorna `placasCount` quando presente', () => {
    expect(item.placasCount).toBe(5);
  });

  it('frontend consome: id, nome, ativo — todos presentes', () => {
    const frontendFields = ['id', 'nome', 'ativo'];
    frontendFields.forEach(field => {
      expect(field in item).toBe(true);
    });
  });
});
