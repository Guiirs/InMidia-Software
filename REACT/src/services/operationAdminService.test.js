import { beforeEach, describe, expect, it, vi } from 'vitest';

import { requestV4 } from './v4ServiceUtils.js';
import {
  getCanonicalizationReport,
  getOperationLinkResolutionQueue,
  refreshOperationCanonicalizationDiagnostics,
  runOperationPlateBackfill,
} from './operationAdminService.js';

vi.mock('./v4ServiceUtils.js', () => ({
  requestV4: vi.fn(),
}));

describe('operationAdminService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('chama endpoint de relatorio de canonicalizacao', async () => {
    requestV4.mockResolvedValueOnce({ canonicalizationRate: 100 });

    await getCanonicalizationReport();

    expect(requestV4).toHaveBeenCalledWith('GET', '/operations/canonicalization-report', {
      operation: 'operations.canonicalization.report',
    });
  });

  it('chama endpoint administrativo de backfill', async () => {
    requestV4.mockResolvedValueOnce({ updated: 1 });

    await runOperationPlateBackfill();

    expect(requestV4).toHaveBeenCalledWith('POST', '/operations/backfill-plate-links', {
      operation: 'operations.backfillPlateLinks',
    });
  });

  it('chama endpoint da fila de resolucao manual', async () => {
    requestV4.mockResolvedValueOnce({ items: [] });

    await getOperationLinkResolutionQueue({ status: 'unresolved', page: 2 });

    expect(requestV4).toHaveBeenCalledWith('GET', '/operations/link-resolution-queue', {
      operation: 'operations.linkResolution.queue',
      params: { status: 'unresolved', page: 2 },
    });
  });

  it('chama endpoint de refresh de diagnosticos', async () => {
    requestV4.mockResolvedValueOnce({ updated: 2 });

    await refreshOperationCanonicalizationDiagnostics({ limit: 50 });

    expect(requestV4).toHaveBeenCalledWith('POST', '/operations/refresh-canonicalization-diagnostics', {
      operation: 'operations.canonicalization.diagnostics.refresh',
      data: { limit: 50 },
    });
  });
});
