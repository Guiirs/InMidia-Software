// src/utils/helpers.js

const R2_PUBLIC_URL = import.meta.env.VITE_R2_PUBLIC_URL || 'https://pub-a7928cc212cd43008627cd87e0ecdf91.r2.dev';
const R2_BASE_PATH = import.meta.env.VITE_R2_BASE_PATH || 'inmidia-uploads-sistema';
const LOG_PREFIX = '[Helpers]';

function validateR2Config() {
  if (typeof R2_PUBLIC_URL !== 'string' || !R2_PUBLIC_URL.trim()) {
    const errorMsg = `${LOG_PREFIX} Configuracao invalida: VITE_R2_PUBLIC_URL nao esta definida ou esta vazia.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  if (!R2_PUBLIC_URL.startsWith('http://') && !R2_PUBLIC_URL.startsWith('https://')) {
    const errorMsg = `${LOG_PREFIX} Configuracao invalida: VITE_R2_PUBLIC_URL ("${R2_PUBLIC_URL}") nao parece ser uma URL valida.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  if (typeof R2_BASE_PATH !== 'string') {
    console.warn(`${LOG_PREFIX} Configuracao: VITE_R2_BASE_PATH nao e uma string. Assumindo caminho raiz.`);
  }
}

export function getImageUrl(imagePathOrUrl, placeholderUrl) {
  const internalLogPrefix = `${LOG_PREFIX}[getImageUrl]`;

  if (typeof placeholderUrl !== 'string' || !placeholderUrl.trim() || !placeholderUrl.startsWith('/')) {
    console.error(`${internalLogPrefix} placeholderUrl invalido fornecido ("${placeholderUrl}").`);
    return '/assets/img/placeholder.png';
  }

  if (typeof imagePathOrUrl !== 'string' || !imagePathOrUrl.trim()) {
    return placeholderUrl;
  }

  const imagePath = imagePathOrUrl.trim();

  try {
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      try {
        new URL(imagePath);
        return imagePath;
      } catch (urlError) {
        console.warn(`${internalLogPrefix} URL absoluta invalida ("${imagePath}"): ${urlError.message}`);
        return placeholderUrl;
      }
    }

    validateR2Config();

    const safeBasePath = typeof R2_BASE_PATH === 'string' ? R2_BASE_PATH.trim().replace(/^\/+|\/+$/g, '') : '';
    const safePath = imagePath.replace(/^\/+|\/+$/g, '');
    const baseSegments = safeBasePath.split('/').filter(Boolean);
    const firstBaseSegment = baseSegments[0] ?? '';
    const imageAlreadyHasStoragePath = Boolean(
      firstBaseSegment
      && (safePath === firstBaseSegment || safePath.startsWith(`${firstBaseSegment}/`))
    );

    return [
      R2_PUBLIC_URL.replace(/\/+$/g, ''),
      imageAlreadyHasStoragePath ? '' : safeBasePath,
      safePath,
    ].filter(Boolean).join('/');
  } catch (error) {
    console.error(`${internalLogPrefix} Erro ao processar imagem ("${imagePath}"): ${error.message}`);
    return placeholderUrl;
  }
}

export function formatDate(dateInput, defaultValue = 'N/A') {
  if (!dateInput) return defaultValue;

  try {
    const dateStr = String(dateInput);
    const dateObj = new Date(dateStr.includes('T') && !dateStr.endsWith('Z') ? `${dateStr}Z` : dateStr);

    if (Number.isNaN(dateObj.getTime())) {
      console.warn(`${LOG_PREFIX}[formatDate] Data invalida recebida:`, dateInput);
      return defaultValue;
    }

    const dia = String(dateObj.getUTCDate()).padStart(2, '0');
    const mes = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
    const ano = dateObj.getUTCFullYear();
    return `${dia}/${mes}/${ano}`;
  } catch (error) {
    console.error(`${LOG_PREFIX}[formatDate] Erro ao formatar data:`, dateInput, error);
    return defaultValue;
  }
}

export const handleDownload = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.setAttribute('download', filename);

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  window.URL.revokeObjectURL(url);
};
