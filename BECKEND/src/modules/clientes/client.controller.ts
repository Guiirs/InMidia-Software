/**
 * Client V4.1 Controller
 */

import { Request, Response, NextFunction } from 'express';
import { IAuthRequest } from '../../types/express.d';
import { getErrorStatusCode, Log, Cache } from '@shared/core';
import type { ClientService } from './client.service';
import type { PaginatedClientsResponse } from './client.dto';

type AuthReq = Request & IAuthRequest;

function getUser(req: AuthReq, res: Response): { empresaId: string; userId: string } | null {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Usuário não autenticado' });
    return null;
  }
  return { empresaId: req.user.empresaId, userId: req.user.id };
}

function sendError(res: Response, error: any): void {
  const status = getErrorStatusCode(error);
  res.status(status).json({ success: false, error: error.message, code: error.code });
}

async function clearClientsCache(empresaId: string): Promise<void> {
  await Cache.clear(`clients:v4:empresa:${empresaId}:*`);
}

export class ClientController {
  constructor(private readonly service: ClientService) {}

  /** POST /api/v4/clients */
  async create(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = getUser(req, res);
      if (!ctx) return;

      const result = await this.service.createClient(req.body, ctx.empresaId, ctx.userId);
      if (result.isFailure) { sendError(res, result.error); return; }

      await clearClientsCache(ctx.empresaId);
      Log.info('[ClientController] Cliente criado', { clientId: result.value._id, empresaId: ctx.empresaId });
      res.status(201).json({ success: true, data: result.value });
    } catch (error) { next(error); }
  }

  /** GET /api/v4/clients */
  async list(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = getUser(req, res);
      if (!ctx) return;

      const cacheKey = `clients:v4:empresa:${ctx.empresaId}:list:${JSON.stringify(req.query)}`;
      const cached = await Cache.get<PaginatedClientsResponse>(cacheKey);
      if (cached.isSuccess && cached.value) {
        res.status(200).json({ success: true, ...cached.value, cached: true });
        return;
      }

      const result = await this.service.listClients(ctx.empresaId, req.query);
      if (result.isFailure) { sendError(res, result.error); return; }

      await Cache.set(cacheKey, result.value, 120);
      res.status(200).json({ success: true, ...result.value });
    } catch (error) { next(error); }
  }

  /** GET /api/v4/clients/search */
  async search(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = getUser(req, res);
      if (!ctx) return;

      const result = await this.service.searchClients(ctx.empresaId, req.query);
      if (result.isFailure) { sendError(res, result.error); return; }

      res.status(200).json({ success: true, data: result.value });
    } catch (error) { next(error); }
  }

  /** GET /api/v4/clients/:id */
  async getById(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = getUser(req, res);
      if (!ctx) return;

      const result = await this.service.getClientById(req.params['id'] as string, ctx.empresaId);
      if (result.isFailure) { sendError(res, result.error); return; }

      res.status(200).json({ success: true, data: result.value });
    } catch (error) { next(error); }
  }

  /** PATCH /api/v4/clients/:id */
  async update(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = getUser(req, res);
      if (!ctx) return;

      const result = await this.service.updateClient(req.params['id'] as string, req.body, ctx.empresaId, ctx.userId);
      if (result.isFailure) { sendError(res, result.error); return; }

      await clearClientsCache(ctx.empresaId);
      res.status(200).json({ success: true, data: result.value });
    } catch (error) { next(error); }
  }

  /** POST /api/v4/clients/:id/archive */
  async archive(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = getUser(req, res);
      if (!ctx) return;

      const result = await this.service.archiveClient(req.params['id'] as string, ctx.empresaId, ctx.userId);
      if (result.isFailure) { sendError(res, result.error); return; }

      await clearClientsCache(ctx.empresaId);
      res.status(200).json({ success: true, data: result.value });
    } catch (error) { next(error); }
  }

  /** POST /api/v4/clients/:id/restore */
  async restore(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = getUser(req, res);
      if (!ctx) return;

      const result = await this.service.restoreClient(req.params['id'] as string, ctx.empresaId, ctx.userId);
      if (result.isFailure) { sendError(res, result.error); return; }

      await clearClientsCache(ctx.empresaId);
      res.status(200).json({ success: true, data: result.value });
    } catch (error) { next(error); }
  }

  /** GET /api/v4/clients/:id/timeline */
  async timeline(req: AuthReq, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = getUser(req, res);
      if (!ctx) return;

      const result = await this.service.getClientTimeline(req.params['id'] as string, ctx.empresaId);
      if (result.isFailure) { sendError(res, result.error); return; }

      res.status(200).json({ success: true, data: result.value });
    } catch (error) { next(error); }
  }
}
