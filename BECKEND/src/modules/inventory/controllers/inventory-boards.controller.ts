import { Request, Response, NextFunction } from 'express';
import { inventoryEmitter } from '@modules/realtime/v4-emitter';
import { defaultAuditService } from '@modules/audit/audit.service';
import { auditRequestContext } from '@modules/audit/audit.helpers';
import type { IAuthRequest } from '../../../types/express.d';
import type { InventoryBoardsService } from '../services/inventory-boards.service';

export class InventoryBoardsController {
  constructor(private readonly service: InventoryBoardsService) {}

  private empresaId(req: Request & IAuthRequest): string | null {
    return req.user?.empresaId ? String(req.user.empresaId) : null;
  }

  private paramId(req: Request): string {
    return String(req.params.id ?? '');
  }

  async listBoards(
    req: Request & IAuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const empresaId = this.empresaId(req);
      if (!empresaId) {
        res.status(401).json({ success: false, code: 'AUTH_REQUIRED', message: 'Usuario nao autenticado.' });
        return;
      }

      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 50;
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      const regiaoId = typeof req.query.regiaoId === 'string' ? req.query.regiaoId : undefined;

      const result = await this.service.listBoards(empresaId, { page, limit, status, search, regiaoId });

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async listRegions(
    req: Request & IAuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const empresaId = this.empresaId(req);
      if (!empresaId) {
        res.status(401).json({ success: false, code: 'AUTH_REQUIRED', message: 'Usuario nao autenticado.' });
        return;
      }

      const result = await this.service.listRegions(empresaId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getBoard(
    req: Request & IAuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const empresaId = this.empresaId(req);
      if (!empresaId) {
        res.status(401).json({ success: false, code: 'AUTH_REQUIRED', message: 'Usuario nao autenticado.' });
        return;
      }

      const board = await this.service.getBoardById(empresaId, this.paramId(req));
      res.status(200).json({ success: true, data: board });
    } catch (error) {
      next(error);
    }
  }

  async updateBoard(
    req: Request & IAuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const empresaId = this.empresaId(req);
      if (!empresaId) {
        res.status(401).json({ success: false, code: 'AUTH_REQUIRED', message: 'Usuario nao autenticado.' });
        return;
      }

      const board = await this.service.updateBoard(empresaId, this.paramId(req), req.body ?? {});
      inventoryEmitter.boardUpdated(empresaId, board.id, {
        numeroPlaca: board.codigo,
        changedFields: Object.keys(req.body ?? {}),
        action: 'inventory.v4.update',
      });
      if (typeof req.body?.imagem === 'string' || typeof req.body?.imageUrl === 'string') {
        inventoryEmitter.boardImageUpdated(empresaId, board.id, { imageUrl: board.imagem ?? undefined });
      }
      res.status(200).json({ success: true, data: board });
    } catch (error) {
      next(error);
    }
  }

  async createBoard(
    req: Request & IAuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const empresaId = this.empresaId(req);
      if (!empresaId) {
        res.status(401).json({ success: false, code: 'AUTH_REQUIRED', message: 'Usuario nao autenticado.' });
        return;
      }

      const board = await this.service.createBoard(empresaId, req.body ?? {});

      defaultAuditService.recordEntityCreated({
        ...auditRequestContext(req),
        module: 'inventory',
        entityType: 'board',
        entityId: board.id,
        entityLabel: board.codigo,
        after: { id: board.id, codigo: board.codigo, regiaoId: board.regiao?.id },
      });

      inventoryEmitter.boardCreated(empresaId, board.id, { numeroPlaca: board.codigo });

      res.status(201).json({ success: true, data: board });
    } catch (error) {
      next(error);
    }
  }

  async deleteBoard(
    req: Request & IAuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const empresaId = this.empresaId(req);
      if (!empresaId) {
        res.status(401).json({ success: false, code: 'AUTH_REQUIRED', message: 'Usuario nao autenticado.' });
        return;
      }

      const board = await this.service.deleteBoard(empresaId, this.paramId(req));

      defaultAuditService.recordEntityDeleted({
        ...auditRequestContext(req),
        module: 'inventory',
        entityType: 'board',
        entityId: board.id,
        entityLabel: board.codigo,
        before: { id: board.id, codigo: board.codigo, status: board.status },
      });

      inventoryEmitter.boardDeleted(empresaId, board.id, { numeroPlaca: board.codigo });

      res.status(200).json({ success: true, data: board, message: 'Placa excluida com sucesso.' });
    } catch (error) {
      next(error);
    }
  }

  async toggleAvailability(
    req: Request & IAuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const empresaId = this.empresaId(req);
      if (!empresaId) {
        res.status(401).json({ success: false, code: 'AUTH_REQUIRED', message: 'Usuario nao autenticado.' });
        return;
      }

      const before = await this.service.getBoardById(empresaId, this.paramId(req));
      const board = await this.service.toggleAvailability(empresaId, this.paramId(req));
      inventoryEmitter.boardAvailabilityChanged(empresaId, board.id, {
        numeroPlaca: board.codigo,
        disponivel: board.disponivel,
        previousStatus: before.disponivel,
      });
      res.status(200).json({ success: true, data: board });
    } catch (error) {
      next(error);
    }
  }
}
