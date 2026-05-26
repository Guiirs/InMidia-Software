import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { deleteMedia, getMediaByOwner, setMediaAsMain, uploadMedia } from '../../../services/mediaService.js';
import SafeImage from './SafeImage.jsx';

const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';

function normalizeAsset(asset) {
  const id = asset.id ?? asset._id;
  return {
    id,
    _id: asset._id ?? id,
    url: asset.publicUrl ?? asset.url,
    filename: asset.filename ?? 'Imagem da placa',
    category: asset.category ?? 'OTHER',
    isMain: Boolean(asset.isMain),
    source: asset.source ?? 'UPLOAD',
    uploadedAt: asset.uploadedAt ?? null,
    updatedAt: asset.updatedAt ?? null,
  };
}

function galleryFromBoard(board) {
  const rawImages = Array.isArray(board?.images) ? board.images : Array.isArray(board?.imagens) ? board.imagens : [];
  const mainImage = board?.mainImage
    ?? rawImages.find((image) => image?.isMain)
    ?? rawImages.find((image) => image?.category === 'MAIN')
    ?? null;
  const mainUrl = board?.mainImageUrl
    ?? board?.imagemPrincipal
    ?? mainImage?.publicUrl
    ?? mainImage?.url
    ?? board?.imagem
    ?? board?.foto
    ?? board?.imageUrl
    ?? '';
  const images = rawImages.map((image, index) => ({
    id: image.id ?? image._id ?? `image-${index}`,
    _id: image._id ?? image.id,
    url: image.publicUrl ?? image.url ?? image.imageUrl ?? image.src ?? '',
    filename: image.filename ?? 'Imagem da placa',
    category: image.category ?? 'OTHER',
    isMain: Boolean(image.isMain || image.category === 'MAIN' || image.publicUrl === mainUrl || image.url === mainUrl),
    source: image.source ?? 'UPLOAD',
    uploadedAt: image.uploadedAt ?? null,
  })).filter((image) => image.url);
  if (mainUrl && !images.some((image) => image.url === mainUrl)) {
    images.unshift({ id: 'legacy-main', url: mainUrl, filename: 'Imagem principal', category: 'MAIN', isMain: true, source: 'IMPORTED' });
  }
  return images;
}

function toBoardPatch(board, images) {
  const main = images.find((image) => image.isMain) ?? images[0] ?? null;
  return {
    ...board,
    mainImageUrl: main?.url ?? null,
    imageUrl: main?.url ?? null,
    imagemPrincipal: main?.url ?? null,
    imagem: main?.url ?? null,
    images,
    imagens: images,
    imageStatus: main?.url ? 'AVAILABLE' : 'MISSING',
  };
}

function PlateImageManager({ board, disabled = false, onChange }) {
  const [images, setImages] = useState(() => galleryFromBoard(board));
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const latestBoardRef = useRef(board);
  const latestOnChangeRef = useRef(onChange);
  const ownerId = board?.id ?? board?._id;

  useEffect(() => {
    latestBoardRef.current = board;
    latestOnChangeRef.current = onChange;
  }, [board, onChange]);

  useEffect(() => {
    setImages(galleryFromBoard(board));
  }, [board]);

  useEffect(() => () => {
    if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
  }, [preview]);

  useEffect(() => {
    if (!ownerId) return;
    let cancelled = false;
    getMediaByOwner('PLATE', ownerId)
      .then((assets) => {
        if (cancelled || !Array.isArray(assets) || assets.length === 0) return;
        const nextImages = assets.map(normalizeAsset).filter((image) => image.url);
        setImages(nextImages);
        latestOnChangeRef.current?.(toBoardPatch(latestBoardRef.current, nextImages));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [ownerId]);

  const mainImage = useMemo(() => images.find((image) => image.isMain) ?? images[0] ?? null, [images]);
  const isBusy = disabled || busy;

  const applyImages = (nextImages) => {
    setImages(nextImages);
    onChange?.(toBoardPatch(board, nextImages));
  };

  const clearSelection = () => {
    if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFile = (event) => {
    const nextFile = event.target.files?.[0] ?? null;
    setError(null);
    if (!nextFile) return;
    if (!IMAGE_ACCEPT.split(',').includes(nextFile.type)) {
      setError('Use uma imagem JPG, PNG ou WebP.');
      event.target.value = '';
      return;
    }
    if (nextFile.size > 5 * 1024 * 1024) {
      setError('Imagem muito grande. Limite atual: 5 MB.');
      event.target.value = '';
      return;
    }
    if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
    setFile(nextFile);
    setPreview(URL.createObjectURL(nextFile));
  };

  const uploadSelected = async (setAsMain) => {
    if (!ownerId) {
      setError('Salve a placa para enviar imagens.');
      return;
    }
    if (!file) {
      setError('Escolha uma imagem antes de enviar.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const asset = await uploadMedia(file, {
        ownerType: 'PLATE',
        ownerId,
        category: setAsMain ? 'MAIN' : 'OTHER',
        setAsMain,
        source: 'UPLOAD',
      });
      const nextAsset = normalizeAsset(asset);
      const nextImages = setAsMain
        ? [nextAsset, ...images.filter((image) => image.id !== nextAsset.id).map((image) => ({ ...image, isMain: false }))]
        : [nextAsset, ...images];
      applyImages(nextImages);
      clearSelection();
    } catch (uploadError) {
      setError(uploadError?.message ?? 'Nao foi possivel enviar a imagem.');
    } finally {
      setBusy(false);
    }
  };

  const setMain = async (image) => {
    if (image.id === 'legacy-main') return;
    setBusy(true);
    setError(null);
    try {
      await setMediaAsMain(image.id);
      applyImages(images.map((item) => ({ ...item, isMain: item.id === image.id })));
    } catch (mainError) {
      setError(mainError?.message ?? 'Nao foi possivel definir a imagem principal.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (image) => {
    if (image.id === 'legacy-main') return;
    setBusy(true);
    setError(null);
    try {
      await deleteMedia(image.id);
    const remaining = images.filter((item) => item.id !== image.id);
    const nextImages = remaining.some((item) => item.isMain) || remaining.length === 0
      ? remaining
      : remaining.map((item, index) => ({ ...item, isMain: index === 0 }));
    applyImages(nextImages);
    } catch (deleteError) {
      setError(deleteError?.message ?? 'Nao foi possivel remover a imagem.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="v4p-edit-panel__image-box">
        <div className="v4p-edit-panel__image-preview">
          <SafeImage src={preview || mainImage?.url} alt={`Imagem da placa ${board?.codigo ?? ''}`} fallbackLabel="Sem imagem cadastrada" />
        </div>
        <div className="v4p-edit-panel__image-actions">
          <input ref={fileInputRef} className="v4p-edit-panel__file" type="file" accept={IMAGE_ACCEPT} onChange={handleFile} disabled={isBusy} />
          <button type="button" className="v4p-edit-panel__btn-file" onClick={() => fileInputRef.current?.click()} disabled={isBusy}>
            <span className="material-symbols-rounded" style={{ fontSize: 14 }}>add_photo_alternate</span>
            Adicionar imagem
          </button>
          <button type="button" className="v4p-edit-panel__btn-file" onClick={() => uploadSelected(false)} disabled={isBusy || !file}>Enviar imagem</button>
          <button type="button" className="v4p-edit-panel__btn-file" onClick={() => uploadSelected(true)} disabled={isBusy || !file}>Trocar imagem principal</button>
          {file && <button type="button" className="v4p-edit-panel__btn-image-clear" onClick={clearSelection} disabled={isBusy}>Remover selecao</button>}
          <span className="v4p-edit-panel__image-hint">JPG, PNG ou WebP. Limite: 5 MB.</span>
          {error && <span className="v4p-edit-panel__image-error">{error}</span>}
        </div>
      </div>
      <div className="v4p-edit-panel__gallery" aria-label="Galeria de imagens da placa">
        {images.length === 0 ? (
          <span className="v4p-edit-panel__gallery-empty">Sem imagem cadastrada</span>
        ) : images.map((image) => (
          <div className="v4p-edit-panel__gallery-item" key={image.id}>
            <SafeImage src={image.url} alt={image.filename || `Imagem da placa ${board?.codigo ?? ''}`} />
            <div className="v4p-edit-panel__gallery-meta">
              <strong>{image.filename}</strong>
              <span>{image.category}</span>
              {image.isMain && <em>Principal</em>}
            </div>
            <div className="v4p-edit-panel__gallery-actions">
              {!image.isMain && image.id !== 'legacy-main' && <button type="button" onClick={() => setMain(image)} disabled={isBusy}>Definir como principal</button>}
              {image.id !== 'legacy-main' && <button type="button" onClick={() => remove(image)} disabled={isBusy}>Remover</button>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export default memo(PlateImageManager);
