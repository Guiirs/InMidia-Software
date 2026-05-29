import { projectionCacheService } from './projection-cache.service';
import { dashboardReadModel } from '@modules/dashboard/read-models/dashboard-read-model';
import { inventoryReadModel } from '@modules/inventory/read-models/inventory-read-model';
import { regionReadModel } from '@modules/regions/read-models/region-read-model';

export type InvalidatableProjection = 'dashboard' | 'inventory' | 'commercial' | 'public_plates' | 'all';

export class ProjectionInvalidationService {
  // ── Full-tenant invalidation ─────────────────────────────────────────────

  invalidateTenant(empresaId: string): void {
    projectionCacheService.invalidateTenant(empresaId);
    dashboardReadModel.invalidate(empresaId);
    inventoryReadModel.invalidate(empresaId);
    regionReadModel.invalidate(empresaId);
  }

  // ── Per-projection invalidation ──────────────────────────────────────────

  invalidateProjection(empresaId: string, projection: InvalidatableProjection): void {
    switch (projection) {
      case 'dashboard':
        dashboardReadModel.invalidate(empresaId);
        regionReadModel.invalidate(empresaId);
        projectionCacheService.invalidateTenant(empresaId);
        break;
      case 'inventory':
        inventoryReadModel.invalidate(empresaId);
        projectionCacheService.invalidateTenant(empresaId);
        break;
      case 'commercial':
        // Commercial cache is embedded in the projectionCacheService keys
        projectionCacheService.invalidateTenant(empresaId);
        // Also invalidate downstream read models that depend on commercial data
        dashboardReadModel.invalidate(empresaId);
        inventoryReadModel.invalidate(empresaId);
        break;
      case 'public_plates':
        projectionCacheService.invalidateTenant(empresaId);
        break;
      case 'all':
        this.invalidateTenant(empresaId);
        break;
    }
  }

  // ── Domain event handlers ────────────────────────────────────────────────
  // These are the canonical invalidation points. Call them from service layer
  // when a write occurs that affects availability/dashboard/inventory state.

  onContractCreated(empresaId: string): void {
    this.invalidateProjection(empresaId, 'commercial');
  }

  onContractApproved(empresaId: string): void {
    this.invalidateProjection(empresaId, 'commercial');
  }

  onContractCancelled(empresaId: string): void {
    this.invalidateProjection(empresaId, 'commercial');
  }

  onPIApproved(empresaId: string): void {
    this.invalidateProjection(empresaId, 'commercial');
  }

  onPICancelled(empresaId: string): void {
    this.invalidateProjection(empresaId, 'commercial');
  }

  onTemporalReservationCreated(empresaId: string): void {
    this.invalidateProjection(empresaId, 'commercial');
  }

  onTemporalReservationExpired(empresaId: string): void {
    this.invalidateProjection(empresaId, 'commercial');
  }

  onPlacaChanged(empresaId: string): void {
    this.invalidateTenant(empresaId);
  }

  onRegiaoChanged(empresaId: string): void {
    this.invalidateProjection(empresaId, 'dashboard');
    regionReadModel.invalidate(empresaId);
  }
}

export const projectionInvalidationService = new ProjectionInvalidationService();
