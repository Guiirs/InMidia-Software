import { extractR2Key } from './r2-key.helper';

const BUCKET = 'inmidia-uploads-sistema';
const FOLDER = 'inmidia-uploads-sistema';
const PUB_URL = 'https://pub-abc123.r2.dev';
const STORAGE_URL = `https://35592074f140ccb6703beaca381c6231.r2.cloudflarestorage.com`;

describe('extractR2Key', () => {
  const origR2Bucket = process.env.R2_BUCKET_NAME;
  const origR2Folder = process.env.R2_FOLDER_NAME;
  const origR2Public = process.env.R2_PUBLIC_URL;

  beforeEach(() => {
    process.env.R2_BUCKET_NAME = BUCKET;
    process.env.R2_FOLDER_NAME = FOLDER;
    process.env.R2_PUBLIC_URL = PUB_URL;
  });

  afterEach(() => {
    if (origR2Bucket === undefined) delete process.env.R2_BUCKET_NAME;
    else process.env.R2_BUCKET_NAME = origR2Bucket;
    if (origR2Folder === undefined) delete process.env.R2_FOLDER_NAME;
    else process.env.R2_FOLDER_NAME = origR2Folder;
    if (origR2Public === undefined) delete process.env.R2_PUBLIC_URL;
    else process.env.R2_PUBLIC_URL = origR2Public;
  });

  // ── Casos válidos ──────────────────────────────────────────────────────────

  it('extrai chave de URL r2.dev', () => {
    const key = extractR2Key(`${PUB_URL}/${FOLDER}/arquivo.jpg`);
    expect(key).toBe(`${FOLDER}/arquivo.jpg`);
  });

  it('extrai chave de URL cloudflarestorage.com', () => {
    const key = extractR2Key(`${STORAGE_URL}/${BUCKET}/${FOLDER}/arquivo.png`);
    expect(key).toBe(`${FOLDER}/arquivo.png`);
  });

  it('aceita caminho relativo com pasta', () => {
    const key = extractR2Key(`${FOLDER}/arquivo.webp`);
    expect(key).toBe(`${FOLDER}/arquivo.webp`);
  });

  it('aceita filename simples e adiciona pasta default', () => {
    const key = extractR2Key('arquivo.jpg');
    expect(key).toBe(`${FOLDER}/arquivo.jpg`);
  });

  it('remove querystring e fragment de URLs', () => {
    const key = extractR2Key(`${PUB_URL}/${FOLDER}/arquivo.jpg?v=1&x=2#frag`);
    expect(key).toBe(`${FOLDER}/arquivo.jpg`);
  });

  it('remove querystring de caminhos relativos', () => {
    const key = extractR2Key(`${FOLDER}/arquivo.png?size=large`);
    expect(key).toBe(`${FOLDER}/arquivo.png`);
  });

  it('aceita extensão .avif', () => {
    const key = extractR2Key(`${FOLDER}/foto.avif`);
    expect(key).toBe(`${FOLDER}/foto.avif`);
  });

  it('aceita extensão .gif', () => {
    const key = extractR2Key(`${FOLDER}/animado.gif`);
    expect(key).toBe(`${FOLDER}/animado.gif`);
  });

  // ── Path traversal e segurança ─────────────────────────────────────────────

  it('bloqueia ".." em caminho relativo', () => {
    expect(extractR2Key('../../../etc/passwd.jpg')).toBeNull();
  });

  it('bloqueia ".." dentro do path', () => {
    expect(extractR2Key(`${FOLDER}/../secrets/arquivo.jpg`)).toBeNull();
  });

  it('bloqueia ".." em URL r2.dev', () => {
    const key = extractR2Key(`${PUB_URL}/${FOLDER}/../secrets/arquivo.jpg`);
    expect(key).toBeNull();
  });

  it('bloqueia path absoluto iniciando com /', () => {
    expect(extractR2Key('/etc/hosts.jpg')).toBeNull();
  });

  it('bloqueia null bytes', () => {
    expect(extractR2Key(`${FOLDER}/arquivo\0.jpg`)).toBeNull();
  });

  // ── Extensões inválidas ────────────────────────────────────────────────────

  it('bloqueia extensão .exe', () => {
    expect(extractR2Key(`${FOLDER}/virus.exe`)).toBeNull();
  });

  it('bloqueia extensão .sh', () => {
    expect(extractR2Key(`${FOLDER}/script.sh`)).toBeNull();
  });

  it('bloqueia arquivo sem extensão', () => {
    expect(extractR2Key(`${FOLDER}/arquivo`)).toBeNull();
  });

  it('bloqueia .php', () => {
    expect(extractR2Key(`${FOLDER}/shell.php`)).toBeNull();
  });

  // ── Entradas inválidas ─────────────────────────────────────────────────────

  it('retorna null para string vazia', () => {
    expect(extractR2Key('')).toBeNull();
  });

  it('retorna null para URL de domínio desconhecido', () => {
    expect(extractR2Key('https://cdn.evil.com/pasta/arquivo.jpg')).toBeNull();
  });

  it('retorna null para URL sem extensão válida', () => {
    expect(extractR2Key(`${PUB_URL}/${FOLDER}/arquivo`)).toBeNull();
  });
});
