import { requestV4 } from './v4ServiceUtils.js';

export async function getCanonicalizationReport() {
  return requestV4('GET', '/operations/canonicalization-report', {
    operation: 'operations.canonicalization.report',
  });
}

export async function runOperationPlateBackfill() {
  return requestV4('POST', '/operations/backfill-plate-links', {
    operation: 'operations.backfillPlateLinks',
  });
}

export async function getOperationLinkResolutionContext(operationId) {
  return requestV4('GET', `/operations/${encodeURIComponent(operationId)}/link-resolution-context`, {
    operation: 'operations.linkResolution.context',
  });
}

export async function getOperationLinkResolutionQueue(params = {}) {
  return requestV4('GET', '/operations/link-resolution-queue', {
    operation: 'operations.linkResolution.queue',
    params,
  });
}

export async function refreshOperationCanonicalizationDiagnostics(payload = {}) {
  return requestV4('POST', '/operations/refresh-canonicalization-diagnostics', {
    operation: 'operations.canonicalization.diagnostics.refresh',
    data: payload,
  });
}

export async function resolveOperationPlateLink(operationId, payload) {
  return requestV4('POST', `/operations/${encodeURIComponent(operationId)}/resolve-plate-link`, {
    operation: 'operations.linkResolution.resolve',
    data: payload,
  });
}
