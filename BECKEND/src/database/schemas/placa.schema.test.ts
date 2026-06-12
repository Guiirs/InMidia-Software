import { placaSchema } from './placa.schema';

describe('placaSchema normalized name index', () => {
  it('reserva numeroPlacaNormalizado por empresa sem filtro de soft delete', () => {
    const index = placaSchema.indexes().find(([fields]) => (
      fields.empresaId === 1 && fields.numeroPlacaNormalizado === 1
    ));

    expect(index).toBeDefined();
    expect(index?.[1]).toEqual(expect.objectContaining({
      unique: true,
      name: 'idx_placa_nome_normalizado_empresa_unique',
    }));
    expect(index?.[1]).not.toHaveProperty('partialFilterExpression');
  });
});
