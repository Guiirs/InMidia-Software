/**
 * Extrai a chave R2 (Key do S3) de forma segura a partir de qualquer representação
 * (filename, bucket/filename, URL r2.dev, URL cloudflarestorage, URL de domínio customizado).
 *
 * Bloqueia path traversal, paths absolutos, extensões inválidas e qualquer tentativa
 * de acesso arbitrário ao bucket. Nunca faz parsing inseguro com string split.
 */

const ALLOWED_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.svg',
]);

function getR2BucketName(): string {
  return (process.env.R2_BUCKET_NAME || '').replace(/^\/+|\/+$/g, '');
}

function getR2FolderName(): string {
  return (process.env.R2_FOLDER_NAME || 'inmidia-uploads-sistema').replace(/^\/+|\/+$/g, '');
}

function getPublicBaseUrl(): string {
  return (process.env.R2_PUBLIC_URL || process.env.VITE_R2_PUBLIC_URL || '').replace(/\/+$/, '');
}

function isPathSafe(key: string): boolean {
  if (!key) return false;
  if (key.startsWith('/')) return false;
  if (key.includes('\0')) return false;
  // Block all forms of path traversal
  const segments = key.split('/');
  for (const seg of segments) {
    if (seg === '..' || seg === '.') return false;
  }
  return true;
}

function hasAllowedExtension(key: string): boolean {
  const dotIdx = key.lastIndexOf('.');
  if (dotIdx === -1) return false;
  const ext = key.slice(dotIdx).toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext);
}

/**
 * Dado um valor armazenado no campo imagemPrincipal/imagem, extrai a chave R2 pronta
 * para usar no GetObjectCommand. Retorna null se inválido ou inseguro.
 *
 * Aceita:
 *   - "arquivo.png"                              → "inmidia-uploads-sistema/arquivo.png"
 *   - "inmidia-uploads-sistema/arquivo.png"      → "inmidia-uploads-sistema/arquivo.png"
 *   - "https://pub-xxx.r2.dev/pasta/arquivo.png" → "pasta/arquivo.png"
 *   - "https://xxx.r2.cloudflarestorage.com/bucket/pasta/arquivo.png" → "pasta/arquivo.png"
 *   - URL com base custom (R2_PUBLIC_URL)        → caminho sem a base
 *
 * Bloqueia:
 *   - ".." ou traversal
 *   - paths absolutos
 *   - extensões não permitidas
 *   - null bytes
 *   - fragmentos e querystrings (removidos antes da extração)
 */
export function extractR2Key(value: string): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;

  let raw = value.trim();

  // Rejeita null bytes antes de qualquer processamento
  if (raw.includes('\0')) return null;

  if (/^https?:\/\//i.test(raw)) {
    // Verifica traversal no input original ANTES de parsear (URL() normaliza "..")
    if (raw.includes('..')) return null;

    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      return null;
    }

    // Remove querystring e fragment — usa apenas pathname
    const pathname = parsed.pathname; // ex: "/pasta/arquivo.png"

    const publicBase = getPublicBaseUrl();

    if (publicBase) {
      let parsedBase: URL;
      try {
        parsedBase = new URL(publicBase);
      } catch {
        parsedBase = null as any;
      }

      if (
        parsedBase &&
        parsed.host === parsedBase.host &&
        pathname.startsWith(parsedBase.pathname.replace(/\/+$/, ''))
      ) {
        // URL começa com R2_PUBLIC_URL: "https://pub-xxx.r2.dev/pasta/arquivo.png"
        const strippedBase = parsedBase.pathname.replace(/\/+$/, '');
        raw = pathname.slice(strippedBase.length).replace(/^\/+/, '');
      } else if (/\.r2\.dev$/i.test(parsed.host)) {
        raw = pathname.replace(/^\/+/, '');
      } else if (/r2\.cloudflarestorage\.com$/i.test(parsed.host)) {
        // https://ACCOUNT.r2.cloudflarestorage.com/BUCKET/KEY
        const bucket = getR2BucketName();
        const bucketPrefix = bucket ? `/${bucket}/` : null;
        if (bucketPrefix && pathname.startsWith(bucketPrefix)) {
          raw = pathname.slice(bucketPrefix.length);
        } else {
          // Strip primeiro segmento (nome do bucket)
          raw = pathname.replace(/^\/[^/]*\//, '');
        }
      } else {
        return null;
      }
    } else if (/\.r2\.dev$/i.test(parsed.host)) {
      raw = pathname.replace(/^\/+/, '');
    } else if (/r2\.cloudflarestorage\.com$/i.test(parsed.host)) {
      const bucket = getR2BucketName();
      const bucketPrefix = bucket ? `/${bucket}/` : null;
      if (bucketPrefix && pathname.startsWith(bucketPrefix)) {
        raw = pathname.slice(bucketPrefix.length);
      } else {
        raw = pathname.replace(/^\/[^/]*\//, '');
      }
    } else {
      return null;
    }
  } else {
    // Caminho relativo — rejeita paths absolutos (iniciando com /)
    if (raw.startsWith('/')) return null;
    // Remove querystring/fragment caso o caller não tenha feito
    const qIdx = raw.indexOf('?');
    if (qIdx !== -1) raw = raw.slice(0, qIdx);
    const hIdx = raw.indexOf('#');
    if (hIdx !== -1) raw = raw.slice(0, hIdx);
  }

  if (!raw) return null;

  // Se é apenas um filename sem pasta, adiciona o folder padrão
  if (!raw.includes('/')) {
    const folder = getR2FolderName();
    raw = folder ? `${folder}/${raw}` : raw;
  }

  if (!isPathSafe(raw)) return null;
  if (!hasAllowedExtension(raw)) return null;

  return raw;
}
