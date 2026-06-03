import { memo } from 'react';
import { getImageUrl } from '../../../utils/helpers.js';
import SafeImage from './SafeImage.jsx';

/**
 * Resolve a URL de imagem de uma placa para uso no <img>.
 *
 * Ordem de prioridade:
 *  1. board.imageUrl    — campo normalizado (saída de normalizePlateCardData ou boardAdapter)
 *  2. board.mainImageUrl — alias normalizado do adapter
 *  3. gallery images[].publicUrl / images[].url — primeira imagem marcada como principal
 *
 * Campos legados (imagemPrincipal, imagem, foto, storageKey) NÃO são lidos aqui.
 * Eles são resolvidos exclusivamente no boardAdapter antes de chegar neste componente.
 */
export function resolvePlateImage(board = {}) {
  const images = Array.isArray(board.images)  ? board.images
               : Array.isArray(board.imagens) ? board.imagens
               : [];

  const mainImage =
    board.mainImage
    ?? images.find((img) => img?.isMain)
    ?? images.find((img) => img?.category === 'MAIN')
    ?? null;

  const raw =
    board.imageUrl                        // campo normalizado (prioridade máxima)
    ?? board.mainImageUrl                 // alias do adapter
    ?? mainImage?.publicUrl               // galeria — imagem principal
    ?? mainImage?.url                     // galeria — fallback de campo
    ?? null;

  if (!raw || typeof raw !== 'string') {
    return { src: null, status: 'MISSING' };
  }
  if (raw.startsWith('blob:') || raw.startsWith('data:')) {
    return { src: raw, status: 'AVAILABLE' };
  }
  return { src: getImageUrl(raw, '/assets/img/placeholder.png'), status: 'AVAILABLE' };
}

/**
 * Renderiza a imagem de uma placa com fallback seguro.
 *
 * Aceita tanto a prop `imageUrl` (contrato do card normalizado)
 * quanto o prop `board` completo (uso standalone/legado).
 *
 * @param {string}  [imageUrl]         URL já normalizada (de normalizePlateCardData)
 * @param {string}  [codigo]           Código da placa para o atributo alt
 * @param {Object}  [board]            Board completo (uso direto fora do card)
 * @param {string}  [className]
 * @param {string}  [fallbackClassName]
 * @param {string}  [fallbackLabel]
 * @param {Object}  [fallbackStyle]
 * @param {Function}[onBroken]
 * @param {*}       [children]         Conteúdo dentro do fallback
 */
function PlateImagePreview({
  imageUrl,
  codigo,
  board,
  className,
  fallbackClassName,
  fallbackLabel = 'Sem imagem cadastrada',
  onBroken,
  children,
  ...props
}) {
  // Quando usado com props explícitas do card normalizado, `imageUrl` tem prioridade.
  // Quando usado standalone com `board`, resolve via resolvePlateImage.
  const resolved = imageUrl !== undefined
    ? { src: imageUrl || null, status: imageUrl ? 'AVAILABLE' : 'MISSING' }
    : resolvePlateImage(board ?? {});

  const altCodigo = codigo ?? board?.codigo ?? board?.numero_placa ?? '';

  return (
    <SafeImage
      src={resolved.src}
      alt={`Imagem da placa ${altCodigo}`}
      className={className}
      fallbackClassName={fallbackClassName}
      fallbackLabel={fallbackLabel}
      fallbackStyle={props.fallbackStyle ?? props.style}
      onBroken={onBroken}
      loading="lazy"
      {...props}
    >
      {children}
    </SafeImage>
  );
}

export default memo(PlateImagePreview);
