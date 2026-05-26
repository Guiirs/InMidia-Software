import type { MediaSource, MediaStorageTarget } from '../contracts/media.contracts';

export class MediaStorageTargetResolver {
  resolve(source: MediaSource): MediaStorageTarget {
    if (source.bucket || source.key || source.location) {
      return {
        kind: 'remote',
        bucket: source.bucket,
        key: source.key,
        publicUrl: source.location,
      };
    }

    if (source.sourceType === 'external-url' || source.sourceType === 'remote-url') {
      return {
        kind: 'external-url',
        url: source.url ?? source.raw,
      };
    }

    if (source.sourceType === 'local-path' || source.sourceType === 'legacy-filename') {
      return {
        kind: 'local',
        path: source.path ?? source.raw ?? source.filename,
      };
    }

    return { kind: 'unknown' };
  }
}
