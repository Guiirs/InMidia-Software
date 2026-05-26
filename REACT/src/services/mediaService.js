import { ensureNoProductionMock, requestV4 } from './v4ServiceUtils.js';

function assertImageFile(file) {
  if (!(file instanceof File)) throw new Error('Selecione um arquivo de imagem valido.');
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) throw new Error('Use uma imagem JPG, PNG ou WebP.');
  if (file.size > 5 * 1024 * 1024) throw new Error('Imagem muito grande. Limite atual: 5 MB.');
}

export async function uploadMedia(file, payload = {}) {
  assertImageFile(file);
  const formData = new FormData();
  formData.append('imagem', file);
  Object.entries(payload).forEach(([key, value]) => {
    if (value == null) return;
    formData.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
  });
  const data = await requestV4('post', '/media/upload', {
    operation: 'media.upload',
    data: formData,
  });
  return ensureNoProductionMock(data, 'media.upload');
}

export async function getMediaByOwner(ownerType, ownerId) {
  const data = await requestV4('get', `/media/by-owner/${encodeURIComponent(ownerType)}/${encodeURIComponent(ownerId)}`, {
    operation: 'media.by-owner',
  });
  return ensureNoProductionMock(Array.isArray(data) ? data : data?.data ?? [], 'media.by-owner');
}

export async function setMediaAsMain(mediaId) {
  const data = await requestV4('patch', `/media/${encodeURIComponent(mediaId)}/main`, {
    operation: 'media.set-main',
  });
  return ensureNoProductionMock(data, 'media.set-main');
}

export async function deleteMedia(mediaId) {
  const data = await requestV4('delete', `/media/${encodeURIComponent(mediaId)}`, {
    operation: 'media.delete',
  });
  return ensureNoProductionMock(data, 'media.delete');
}

export async function cleanupDeletePending() {
  const data = await requestV4('post', '/media/cleanup/delete-pending', {
    operation: 'media.cleanup.delete-pending',
  });
  return ensureNoProductionMock(data, 'media.cleanup.delete-pending');
}
