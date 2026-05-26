import { memo } from 'react';
import { getImageUrl } from '../../../utils/helpers.js';
import SafeImage from './SafeImage.jsx';

export function resolvePlateImage(board = {}) {
  const images = Array.isArray(board.images) ? board.images : Array.isArray(board.imagens) ? board.imagens : [];
  const mainImage = board.mainImage
    ?? images.find((image) => image?.isMain)
    ?? images.find((image) => image?.category === 'MAIN')
    ?? null;
  const raw = board.mainImageUrl
    ?? board.imagemPrincipal
    ?? mainImage?.publicUrl
    ?? mainImage?.url
    ?? board.imagem
    ?? board.foto
    ?? board.imageUrl
    ?? null;

  if (!raw || typeof raw !== 'string') {
    return { src: null, status: 'MISSING' };
  }
  if (raw.startsWith('blob:') || raw.startsWith('data:')) {
    return { src: raw, status: 'AVAILABLE' };
  }
  return { src: getImageUrl(raw, '/assets/img/placeholder.png'), status: 'AVAILABLE' };
}

function PlateImagePreview({ board, className, fallbackClassName, fallbackLabel = 'Sem imagem cadastrada', onBroken, children, ...props }) {
  const image = resolvePlateImage(board);
  return (
    <SafeImage
      src={image.src}
      alt={`Imagem da placa ${board?.codigo ?? board?.numero_placa ?? ''}`}
      className={className}
      fallbackClassName={fallbackClassName}
      fallbackLabel={fallbackLabel}
      onBroken={onBroken}
      loading="lazy"
      {...props}
    >
      {children}
    </SafeImage>
  );
}

export default memo(PlateImagePreview);
