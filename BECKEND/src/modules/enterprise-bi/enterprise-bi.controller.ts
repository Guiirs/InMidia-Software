import type { Request, Response } from 'express';
import { EnterpriseBIService } from './services/enterprise-bi.service';
import { localEnterpriseBISnapshotStore } from './stores/enterprise-bi.snapshot-store';
import {
  ExecutiveBIPresenter,
  GovernanceBIPresenter,
  InventoryBIPresenter,
  QualityBIPresenter,
  RegionalBIPresenter,
} from './presenters/enterprise-bi.presenters';
import type { EnterpriseBIExportProfile } from './contracts/enterprise-bi.contracts';

const service = new EnterpriseBIService(localEnterpriseBISnapshotStore);

const EMPTY_SNAPSHOT_RESPONSE = {
  success: true,
  data: null,
  empty: true,
  message: 'Nenhum snapshot BI disponível. Execute uma análise operacional para gerar dados.',
};

function resolveEmpresaId(req: Request): string | undefined {
  return req.tenantContext?.empresaId ?? (req.user as { empresaId?: string } | undefined)?.empresaId;
}

/** GET /api/v1/enterprise-bi/snapshot */
export function getSnapshot(req: Request, res: Response): void {
  const empresaId = resolveEmpresaId(req);
  const snapshot = localEnterpriseBISnapshotStore.getLatest({ tenantId: empresaId });

  if (!snapshot) {
    res.json(EMPTY_SNAPSHOT_RESPONSE);
    return;
  }

  res.json({
    success: true,
    data: {
      id: snapshot.id,
      generatedAt: snapshot.generatedAt,
      grain: snapshot.grain,
      exportProfile: snapshot.exportProfile,
      visibility: snapshot.visibility,
      summary: snapshot.summary,
      datasetNames: snapshot.datasets.map((d) => d.name),
      metricCount: snapshot.metrics.length,
    },
  });
}

function datasetByProfile(req: Request, res: Response, profile: EnterpriseBIExportProfile): void {
  const empresaId = resolveEmpresaId(req);
  const snapshot = localEnterpriseBISnapshotStore.getLatest({ tenantId: empresaId });

  if (!snapshot) {
    res.json(EMPTY_SNAPSHOT_RESPONSE);
    return;
  }

  const dataset = snapshot.datasets.find((d) => d.profile === profile);

  if (!dataset) {
    res.json({
      success: true,
      data: null,
      empty: true,
      message: `Dataset "${profile}" não disponível no snapshot atual.`,
    });
    return;
  }

  let presented: ReturnType<ExecutiveBIPresenter['present']>;
  switch (profile) {
    case 'executive-summary':
      presented = new ExecutiveBIPresenter().present(dataset);
      break;
    case 'regional-performance':
      presented = new RegionalBIPresenter().present(dataset);
      break;
    case 'inventory-health':
      presented = new InventoryBIPresenter().present(dataset);
      break;
    case 'quality-report':
      presented = new QualityBIPresenter().present(dataset);
      break;
    case 'governance-report':
      presented = new GovernanceBIPresenter().present(dataset);
      break;
    default:
      presented = new ExecutiveBIPresenter().present(dataset);
  }

  res.json({
    success: true,
    data: presented,
    snapshotId: snapshot.id,
    generatedAt: snapshot.generatedAt,
  });
}

/** GET /api/v1/enterprise-bi/datasets/executive */
export function getExecutiveDataset(req: Request, res: Response): void {
  datasetByProfile(req, res, 'executive-summary');
}

/** GET /api/v1/enterprise-bi/datasets/regional */
export function getRegionalDataset(req: Request, res: Response): void {
  datasetByProfile(req, res, 'regional-performance');
}

/** GET /api/v1/enterprise-bi/datasets/inventory */
export function getInventoryDataset(req: Request, res: Response): void {
  datasetByProfile(req, res, 'inventory-health');
}

/** GET /api/v1/enterprise-bi/datasets/quality */
export function getQualityDataset(req: Request, res: Response): void {
  datasetByProfile(req, res, 'quality-report');
}

/** GET /api/v1/enterprise-bi/datasets/governance */
export function getGovernanceDataset(req: Request, res: Response): void {
  datasetByProfile(req, res, 'governance-report');
}

export { service as enterpriseBIService };
