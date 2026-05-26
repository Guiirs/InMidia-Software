import type {
  MediaAsset,
  MediaMetadata,
  MediaSource,
  MediaStorageTarget,
  MediaVariant,
  MediaValidationResult,
} from '../contracts/media.contracts';

describe('Media contracts', () => {
  it('represents media source and metadata separately', () => {
    const source: MediaSource = {
      filename: 'placa.jpg',
      sourceType: 'legacy-filename',
    };
    const metadata: MediaMetadata = {
      filename: 'placa.jpg',
      extension: '.jpg',
      sourceType: 'legacy-filename',
      createdAt: '2026-05-18T12:00:00.000Z',
      updatedAt: '2026-05-18T12:00:00.000Z',
      partial: true,
    };

    expect(source.sourceType).toBe('legacy-filename');
    expect(metadata.partial).toBe(true);
  });

  it('represents variants and storage target', () => {
    const variant: MediaVariant = {
      type: 'thumbnail',
      path: 'placas/placa.thumb.jpg',
      planned: true,
    };
    const storage: MediaStorageTarget = {
      kind: 'local',
      path: 'placas/placa.jpg',
    };

    expect(variant.planned).toBe(true);
    expect(storage.kind).toBe('local');
  });

  it('represents validation and asset status', () => {
    const validation: MediaValidationResult = {
      ok: false,
      status: 'invalid',
      issues: [{
        code: 'EXTENSION_NOT_ALLOWED',
        level: 'error',
        message: 'Extensao nao permitida',
      }],
    };
    const asset: MediaAsset = {
      id: 'asset-1',
      source: { filename: 'placa.exe', sourceType: 'legacy-filename' },
      metadata: {
        filename: 'placa.exe',
        extension: '.exe',
        sourceType: 'legacy-filename',
        createdAt: '2026-05-18T12:00:00.000Z',
        updatedAt: '2026-05-18T12:00:00.000Z',
        partial: true,
      },
      variants: [],
      storage: { kind: 'local', path: 'placa.exe' },
      status: 'invalid',
      warnings: validation.issues,
      createdAt: '2026-05-18T12:00:00.000Z',
      updatedAt: '2026-05-18T12:00:00.000Z',
    };

    expect(asset.status).toBe('invalid');
    expect(validation.issues[0]?.code).toBe('EXTENSION_NOT_ALLOWED');
  });
});
