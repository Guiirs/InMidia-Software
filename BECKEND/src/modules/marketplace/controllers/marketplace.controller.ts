import type { Request, Response } from 'express';
import { presentMarketplaceCatalog, presentMarketplaceActivation } from '../presenters/marketplace.presenter';
import { marketplaceService } from '../services/marketplace.service';
import type { MarketplaceActivationRequest, MarketplaceTenantAccess } from '../contracts/marketplace.contracts';

function resolveTenantType(role?: string): 'internal' | 'external' {
  if (!role) return 'internal';
  return ['admin_empresa', 'admin', 'superadmin'].includes(role) ? 'internal' : 'external';
}

function resolveAccessFromRequest(req: Request, body: Partial<MarketplaceActivationRequest> = {}): MarketplaceTenantAccess {
  return {
    tenantId: req.tenantContext?.empresaId ?? body.tenantId ?? '',
    empresaId: req.tenantContext?.empresaId ?? body.empresaId ?? req.user?.empresaId,
    actorId: req.user?.id ?? body.actorId,
    role: req.user?.role ?? body.role,
    tenantType: body.tenantType ?? resolveTenantType(req.user?.role),
    governanceScore: typeof body.governanceScore === 'number' ? body.governanceScore : 100,
    qualityScore: typeof body.qualityScore === 'number' ? body.qualityScore : 100,
    scopes: body.scopes ?? ['admin.access'],
    featureFlags: body.featureFlags ?? {},
  };
}

export function getMarketplaceModules(req: Request, res: Response): void {
  const access = resolveAccessFromRequest(req);
  const catalog = marketplaceService.buildMarketplaceCatalog(access);
  res.json(presentMarketplaceCatalog(catalog));
}

export function getMarketplaceCapabilities(req: Request, res: Response): void {
  const access = resolveAccessFromRequest(req);
  const catalog = marketplaceService.buildMarketplaceCatalog(access);
  res.json(presentMarketplaceCatalog(catalog));
}

export function activateCapability(req: Request, res: Response): void {
  const capabilityId = String(req.body?.capabilityId ?? '').trim();
  if (!capabilityId) {
    res.status(400).json({ success: false, error: 'capabilityId obrigatório.' });
    return;
  }

  const access = resolveAccessFromRequest(req, {
    capabilityId,
    tenantId: req.body?.tenantId,
    empresaId: req.body?.empresaId,
    actorId: req.body?.actorId,
    role: req.body?.role,
    tenantType: req.body?.tenantType,
    governanceScore: typeof req.body?.governanceScore === 'number' ? req.body.governanceScore : undefined,
    qualityScore: typeof req.body?.qualityScore === 'number' ? req.body.qualityScore : undefined,
    scopes: Array.isArray(req.body?.scopes) ? req.body.scopes : undefined,
    featureFlags: req.body?.featureFlags,
  });

  const request: MarketplaceActivationRequest = {
    capabilityId,
    ...access,
  };

  const result = marketplaceService.activateCapability(request);

  if (!result.success) {
    res.status(result.status === 'not-found' ? 404 : 403).json(presentMarketplaceActivation(result));
    return;
  }

  res.json(presentMarketplaceActivation(result));
}

export function deactivateCapability(req: Request, res: Response): void {
  const capabilityId = String(req.body?.capabilityId ?? '').trim();
  if (!capabilityId) {
    res.status(400).json({ success: false, error: 'capabilityId obrigatório.' });
    return;
  }

  const access = resolveAccessFromRequest(req, {
    capabilityId,
    tenantId: req.body?.tenantId,
    empresaId: req.body?.empresaId,
    actorId: req.body?.actorId,
    role: req.body?.role,
    tenantType: req.body?.tenantType,
    governanceScore: typeof req.body?.governanceScore === 'number' ? req.body.governanceScore : undefined,
    qualityScore: typeof req.body?.qualityScore === 'number' ? req.body.qualityScore : undefined,
    scopes: Array.isArray(req.body?.scopes) ? req.body.scopes : undefined,
    featureFlags: req.body?.featureFlags,
  });

  const request: MarketplaceActivationRequest = {
    capabilityId,
    ...access,
  };

  const result = marketplaceService.deactivateCapability(request);

  if (!result.success) {
    res.status(result.status === 'not-found' ? 404 : 403).json(presentMarketplaceActivation(result));
    return;
  }

  res.json(presentMarketplaceActivation(result));
}
