import { validateUpdatePlaca } from '../dtos/placa.dto';

describe('validateUpdatePlaca image mutation hardening', () => {
  it('nao sobrescreve imagem atual com string vazia', () => {
    const dto = validateUpdatePlaca({ nomeDaRua: 'Rua A', imagem: '', imagemPrincipal: '' }) as any;

    expect(dto.nomeDaRua).toBe('Rua A');
    expect(dto.imagem).toBeUndefined();
    expect(dto.imagemPrincipal).toBeUndefined();
  });

  it('normaliza URL completa para storageKey canonica', () => {
    const dto = validateUpdatePlaca({
      imageUrl: 'https://pub-storage.r2.dev/empresas/e1/plates/p1/main/full.webp?x=1',
    }) as any;

    expect(dto.imagem).toBe('empresas/e1/plates/p1/main/full.webp');
    expect(dto.imagemPrincipal).toBe('empresas/e1/plates/p1/main/full.webp');
    expect(dto.imageUrl).toBeUndefined();
  });

  it('mantem intencao explicita de remocao', () => {
    const dto = validateUpdatePlaca({ imagem: null }) as any;

    expect(dto.imagem).toBeNull();
    expect(dto.imagemPrincipal).toBeNull();
  });

  it('ignora URL invalida e traversal para impedir imagemUrl falsa', () => {
    expect(validateUpdatePlaca({ imagemPrincipal: 'https://example.com/fake.jpg' } as any)).not.toHaveProperty('imagemPrincipal');
    expect(validateUpdatePlaca({ imagem: '../secret.jpg' } as any)).not.toHaveProperty('imagem');
  });
});
