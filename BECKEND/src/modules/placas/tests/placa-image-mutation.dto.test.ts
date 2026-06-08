import { validateUpdatePlaca } from '../dtos/placa.dto';

describe('validateUpdatePlaca image mutation hardening', () => {
  it('nao sobrescreve imagem atual com string vazia', () => {
    const dto = validateUpdatePlaca({ nomeDaRua: 'Rua A', imagem: '', imagemPrincipal: '' }) as any;

    expect(dto.nomeDaRua).toBe('Rua A');
    expect(dto.imagem).toBeUndefined();
    expect(dto.imagemPrincipal).toBeUndefined();
  });

  it('imageUrl é stripped — atualizacoes de imagem vao pelo endpoint de upload', () => {
    // FASE 10: imageUrl não é mais normalizado para imagem/imagemPrincipal.
    // Atualizações de imagem devem usar o endpoint de upload dedicado.
    const dto = validateUpdatePlaca({
      imageUrl: 'https://pub-storage.r2.dev/empresas/e1/plates/p1/main/full.webp?x=1',
    }) as any;

    expect(dto.imageUrl).toBeUndefined();
    expect(dto.imagem).toBeUndefined();
    expect(dto.imagemPrincipal).toBeUndefined();
  });

  it('imagem: null preservado como sinal de remocao — imagemPrincipal nunca presente', () => {
    // FASE 10: imagemPrincipal é sempre stripped (mesmo null); remoção sinalizada só via imagem: null.
    const dto = validateUpdatePlaca({ imagem: null }) as any;

    expect(dto.imagem).toBeNull();
    expect(dto.imagemPrincipal).toBeUndefined();
  });

  it('ignora URL invalida e traversal para impedir imagemUrl falsa', () => {
    expect(validateUpdatePlaca({ imagemPrincipal: 'https://example.com/fake.jpg' } as any)).not.toHaveProperty('imagemPrincipal');
    expect(validateUpdatePlaca({ imagem: '../secret.jpg' } as any)).not.toHaveProperty('imagem');
  });
});
