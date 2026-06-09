export type WebPManifestStatus = 'DRY_RUN' | 'CONVERTED' | 'FAILED' | 'ROLLED_BACK';

export interface WebPManifest {
  plateId: string;
  originalKey: string;
  optimizedKey: string;
  originalSizeBytes: number;
  optimizedSizeBytes: number;
  originalMimeType: string;
  optimizedMimeType: 'image/webp';
  width: number;
  height: number;
  convertedAt: string;
  checksumOriginal: string;
  checksumOptimized: string;
  status: WebPManifestStatus;
}

export interface WebPDryRunEntry {
  plateId: string;
  originalKey: string;
  plannedOptimizedKey: string;
  originalMimeType: string | null;
  originalSizeBytes: number | null;
  alreadyOptimized: boolean;
  webpEnabled: boolean;
}

export interface WebPDryRunReport {
  generatedAt: string;
  total: number;
  toConvert: number;
  alreadyOptimized: number;
  skippedNoImage: number;
  entries: WebPDryRunEntry[];
}
