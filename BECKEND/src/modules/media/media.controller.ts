import { Request, Response, NextFunction } from 'express';
import { IAuthRequest } from '../../types/express.d';
import { ByOwnerParamsSchema, UploadMediaSchema } from './media.dto';
import { mediaService, MediaService } from './media.service';

type AuthenticatedRequest = Request & IAuthRequest;

export class MediaController {
  constructor(private readonly service: MediaService = mediaService) {}

  async upload(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Usuario nao autenticado' });
        return;
      }
      const dto = UploadMediaSchema.parse(req.body);
      const asset = await this.service.uploadMedia(req.file as Express.Multer.File, dto, req.user.empresaId, req.user.id);
      res.status(201).json({ success: true, data: asset });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Usuario nao autenticado' });
        return;
      }
      const id = String(req.params.id ?? '');
      if (!id) {
        res.status(400).json({ success: false, error: 'ID da midia e obrigatorio' });
        return;
      }
      const asset = await this.service.getMedia(id, req.user.empresaId);
      if (!asset) {
        res.status(404).json({ success: false, error: 'Midia nao encontrada' });
        return;
      }
      res.json({ success: true, data: asset });
    } catch (error) {
      next(error);
    }
  }

  async setMain(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Usuario nao autenticado' });
        return;
      }
      const id = String(req.params.id ?? '');
      if (!id) {
        res.status(400).json({ success: false, error: 'ID da midia e obrigatorio' });
        return;
      }
      const asset = await this.service.setMain(id, req.user.empresaId, req.user.id);
      res.json({ success: true, data: asset });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Usuario nao autenticado' });
        return;
      }
      const id = String(req.params.id ?? '');
      if (!id) {
        res.status(400).json({ success: false, error: 'ID da midia e obrigatorio' });
        return;
      }
      const asset = await this.service.deleteMedia(id, req.user.empresaId, req.user.id);
      res.json({ success: true, data: asset });
    } catch (error) {
      next(error);
    }
  }

  async getByOwner(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Usuario nao autenticado' });
        return;
      }
      const params = ByOwnerParamsSchema.parse(req.params);
      const assets = await this.service.getByOwner(params.ownerType, params.ownerId, req.user.empresaId);
      res.json({ success: true, data: assets });
    } catch (error) {
      next(error);
    }
  }

  async cleanupDeletePending(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Usuario nao autenticado' });
        return;
      }
      const report = await this.service.cleanupDeletePendingMedia();
      res.json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }

  async cleanupOrphans(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Usuario nao autenticado' });
        return;
      }
      const report = await this.service.findOrphanMediaAssets();
      res.json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }
}
