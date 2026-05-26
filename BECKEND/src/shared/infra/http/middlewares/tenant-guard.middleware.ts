import { Request, Response, NextFunction } from 'express';
import { requireEmpresaId } from '../tenant/tenant-context';

export function requireTenantGuard(req: Request, _res: Response, next: NextFunction): void {
  try {
    requireEmpresaId(req);
    next();
  } catch (error) {
    next(error);
  }
}
