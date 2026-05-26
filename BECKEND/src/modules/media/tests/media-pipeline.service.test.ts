import { mediaPipelineService } from '../services/media-pipeline.service';

const NOW = new Date('2026-05-18T12:00:00.000Z');

describe('MediaPipelineService', () => {
  it('validates a valid URL', () => {
    const source = mediaPipelineService.normalizeMediaSource('https://cdn.example.com/placa.jpg');
    const validation = mediaPipelineService.validateMediaAsset(source);

    expect(source.sourceType).toBe('external-url');
    expect(validation.ok).toBe(true);
  });

  it('detects an invalid URL', () => {
    const source = mediaPipelineService.normalizeMediaSource({
      url: 'notaurl',
      sourceType: 'external-url',
    });
    const validation = mediaPipelineService.validateMediaAsset(source);

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'INVALID_URL' }),
      ]),
    );
  });

  it('normalizes local path', () => {
    const source = mediaPipelineService.normalizeMediaSource('uploads/placas/placa.png');

    expect(source.sourceType).toBe('local-path');
    expect(source.path).toBe('uploads/placas/placa.png');
  });

  it('accepts allowed extension', () => {
    const asset = mediaPipelineService.buildMediaAsset('placa.webp', { now: NOW });

    expect(asset.status).toBe('valid');
    expect(asset.metadata.extension).toBe('.webp');
  });

  it('rejects forbidden extension', () => {
    const result = mediaPipelineService.processMediaAsset('placa.exe', { now: NOW });

    expect(result.ok).toBe(false);
    expect(result.status).toBe('invalid');
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'EXTENSION_NOT_ALLOWED' }),
      ]),
    );
  });

  it('handles missing asset as unknown warning', () => {
    const result = mediaPipelineService.processMediaAsset(undefined, { now: NOW });

    expect(result.ok).toBe(true);
    expect(result.status).toBe('unknown');
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'ASSET_MISSING' }),
      ]),
    );
  });

  it('extracts partial metadata when upload details are incomplete', () => {
    const metadata = mediaPipelineService.extractMediaMetadata(
      mediaPipelineService.normalizeMediaSource('placa.jpg'),
      { now: NOW },
    );

    expect(metadata.partial).toBe(true);
    expect(metadata.filename).toBe('placa.jpg');
  });

  it('plans media variants', () => {
    const source = mediaPipelineService.normalizeMediaSource('placas/placa.jpg');
    const variants = mediaPipelineService.generateMediaVariants(source, { now: NOW });

    expect(variants.map((variant) => variant.type)).toEqual([
      'original',
      'thumbnail',
      'preview',
      'optimized',
      'map-marker',
    ]);
    expect(variants.find((variant) => variant.type === 'thumbnail')?.planned).toBe(true);
  });

  it('resolves local storage target', () => {
    const asset = mediaPipelineService.buildMediaAsset('uploads/placa.png', { now: NOW });

    expect(asset.storage.kind).toBe('local');
  });

  it('resolves external-url storage target', () => {
    const asset = mediaPipelineService.buildMediaAsset('https://assets.example.com/placa.png', { now: NOW });

    expect(asset.storage.kind).toBe('external-url');
  });

  it('processes with warning when metadata is partial', () => {
    const result = mediaPipelineService.processMediaAsset('placa.jpg', { now: NOW });

    expect(result.ok).toBe(true);
    expect(result.status).toBe('processed');
    expect(result.asset?.metadata.partial).toBe(true);
  });

  it('keeps compatibility with legacy filename', () => {
    const asset = mediaPipelineService.buildMediaAsset('legacy-placa.jpeg', {
      ownerType: 'placa',
      now: NOW,
    });

    expect(asset.source.sourceType).toBe('legacy-filename');
    expect(asset.metadata.filename).toBe('legacy-placa.jpeg');
  });

  it('builds media summary', () => {
    const processed = mediaPipelineService.processMediaAsset('placa.jpg', { now: NOW }).asset!;
    const invalid = mediaPipelineService.processMediaAsset('placa.exe', { now: NOW }).asset!;
    const archived = mediaPipelineService.archiveMediaAsset(processed, { now: NOW });

    const summary = mediaPipelineService.buildMediaSummary([processed, invalid, archived]);

    expect(summary.total).toBe(3);
    expect(summary.processed).toBe(1);
    expect(summary.invalid).toBe(1);
    expect(summary.archived).toBe(1);
  });
});
