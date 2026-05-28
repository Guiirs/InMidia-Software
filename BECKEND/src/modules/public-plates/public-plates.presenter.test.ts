import { toPublicPlaca } from './public-plates.presenter';

describe('public plates presenter image urls', () => {
  const originalR2PublicUrl = process.env.R2_PUBLIC_URL;
  const originalR2FolderName = process.env.R2_FOLDER_NAME;

  beforeEach(() => {
    process.env.R2_PUBLIC_URL = 'https://pub-storage.example.com/';
    process.env.R2_FOLDER_NAME = 'inmidia-uploads-sistema';
  });

  afterEach(() => {
    if (originalR2PublicUrl === undefined) delete process.env.R2_PUBLIC_URL;
    else process.env.R2_PUBLIC_URL = originalR2PublicUrl;
    if (originalR2FolderName === undefined) delete process.env.R2_FOLDER_NAME;
    else process.env.R2_FOLDER_NAME = originalR2FolderName;
  });

  it('converte imagemUrl relativa em absoluta', () => {
    const placa = toPublicPlaca({
      _id: 'placa-1',
      numero_placa: 'PUB-001',
      imagemPrincipal: 'placa-relativa.jpg',
    });

    expect(placa.imagemUrl).toBe('https://pub-storage.example.com/inmidia-uploads-sistema/placa-relativa.jpg');
    expect(placa.imagem).toBe('https://pub-storage.example.com/inmidia-uploads-sistema/placa-relativa.jpg');
  });

  it('mantem imagemUrl https como esta', () => {
    const placa = toPublicPlaca({
      _id: 'placa-2',
      numero_placa: 'PUB-002',
      imagemPrincipal: 'https://cdn.example.com/placas/pronta.jpg',
    });

    expect(placa.imagemUrl).toBe('https://cdn.example.com/placas/pronta.jpg');
    expect(placa.imagem).toBe('https://cdn.example.com/placas/pronta.jpg');
  });

  it('mantem imagemUrl null como null', () => {
    const placa = toPublicPlaca({
      _id: 'placa-3',
      numero_placa: 'PUB-003',
      imagemPrincipal: null,
      imagem: null,
    });

    expect(placa.imagemUrl).toBeNull();
    expect(placa.imagem).toBeNull();
  });

  it('nao duplica o prefixo inmidia-uploads-sistema', () => {
    const placa = toPublicPlaca({
      _id: 'placa-4',
      numero_placa: 'PUB-004',
      imagemPrincipal: 'inmidia-uploads-sistema/placa-com-prefixo.jpg',
    });

    expect(placa.imagemUrl).toBe('https://pub-storage.example.com/inmidia-uploads-sistema/placa-com-prefixo.jpg');
    expect(placa.imagem).toBe('https://pub-storage.example.com/inmidia-uploads-sistema/placa-com-prefixo.jpg');
  });
});
