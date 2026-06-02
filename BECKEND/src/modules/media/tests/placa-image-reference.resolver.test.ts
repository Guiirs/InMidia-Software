import {
  resolvePlacaGalleryReferences,
  resolvePlacaImageReference,
} from '../placa-image-reference.resolver';

describe('placa image reference resolver', () => {
  it('resolve imagem principal canonica com contentType', () => {
    const result = resolvePlacaImageReference({
      imagemPrincipal: 'empresas/e1/plates/p1/main/img.webp',
    });

    expect(result).toEqual({
      hasImage: true,
      storageKey: 'empresas/e1/plates/p1/main/img.webp',
      sourceField: 'imagemPrincipal',
      contentType: 'image/webp',
    });
  });

  it('extrai key de URL antiga', () => {
    const result = resolvePlacaImageReference({
      imagem: 'https://pub-storage.r2.dev/inmidia-uploads-sistema/placa.jpg?cache=1',
    });

    expect(result.storageKey).toBe('inmidia-uploads-sistema/placa.jpg');
    expect(result.sourceField).toBe('imagem');
  });

  it('bloqueia traversal e filename solto', () => {
    expect(resolvePlacaImageReference({ imagemPrincipal: '../secret.jpg' }).hasImage).toBe(false);
    expect(resolvePlacaImageReference({ imagemPrincipal: 'placa.jpg' }).hasImage).toBe(false);
  });

  it('usa imagem valida quando imagemPrincipal e invalida', () => {
    const result = resolvePlacaImageReference({
      imagemPrincipal: '../secret.jpg',
      imagem: 'empresas/e1/plates/p1/main/legacy.jpg',
    });

    expect(result.storageKey).toBe('empresas/e1/plates/p1/main/legacy.jpg');
    expect(result.sourceField).toBe('imagem');
  });

  it('prioriza imagemPrincipal quando imagem e imagemPrincipal sao validas', () => {
    const result = resolvePlacaImageReference({
      imagemPrincipal: 'empresas/e1/plates/p1/main/new.webp',
      imagem: 'empresas/e1/plates/p1/main/old.webp',
    });

    expect(result.storageKey).toBe('empresas/e1/plates/p1/main/new.webp');
  });

  it('aceita key antiga, key nova e URL completa', () => {
    expect(resolvePlacaImageReference({ imagem: 'inmidia-uploads-sistema/old.jpg' }).storageKey)
      .toBe('inmidia-uploads-sistema/old.jpg');
    expect(resolvePlacaImageReference({ storageKey: 'empresas/e1/plates/p1/main/new.webp' }).storageKey)
      .toBe('empresas/e1/plates/p1/main/new.webp');
    expect(resolvePlacaImageReference({ imageUrl: 'https://pub-storage.r2.dev/empresas/e1/plates/p1/main/full.png' }).storageKey)
      .toBe('empresas/e1/plates/p1/main/full.png');
  });

  it('rejeita URL invalida, extensao proibida e bucket inexistente em URL nao R2', () => {
    expect(resolvePlacaImageReference({ imagemPrincipal: 'https://example.com/placa.jpg' }).hasImage).toBe(false);
    expect(resolvePlacaImageReference({ imagemPrincipal: 'https://pub-storage.r2.dev/placa.exe' }).hasImage).toBe(false);
    expect(resolvePlacaImageReference({ imagemPrincipal: 'https://not-r2.example/empresas/e1/img.jpg' }).hasImage).toBe(false);
  });

  it('rejeita storageKey inexistente no contrato por ser filename solto ou vazio', () => {
    expect(resolvePlacaImageReference({ storageKey: '' }).hasImage).toBe(false);
    expect(resolvePlacaImageReference({ storageKey: 'missing.jpg' }).hasImage).toBe(false);
  });

  it('resolve galeria sem escolher campo manualmente', () => {
    const result = resolvePlacaGalleryReferences({
      imagens: [
        { id: 'a', storageKey: 'empresas/e1/plates/p1/history/a.jpg' },
        { id: 'b', r2Key: 'empresas/e1/plates/p1/main/b.png', isMain: true },
      ],
    });

    expect(result).toEqual([
      expect.objectContaining({ id: 'a', storageKey: 'empresas/e1/plates/p1/history/a.jpg', isMain: false }),
      expect.objectContaining({ id: 'b', storageKey: 'empresas/e1/plates/p1/main/b.png', isMain: true, contentType: 'image/png' }),
    ]);
  });

  it('resolve multiplas imagens e troca de principal por flag explicita', () => {
    const result = resolvePlacaImageReference({
      imagemPrincipal: null,
      imagens: [
        { id: 'old', storageKey: 'empresas/e1/plates/p1/history/old.jpg' },
        { id: 'main', storageKey: 'empresas/e1/plates/p1/main/main.webp', isMain: true },
      ],
    });

    expect(result.storageKey).toBe('empresas/e1/plates/p1/main/main.webp');
    expect(result.sourceField).toBe('mainImage.storageKey');
  });
});
