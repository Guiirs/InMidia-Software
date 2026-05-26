import { Router } from 'express';
import multer from 'multer';
import authMiddleware from '@shared/infra/http/middlewares/auth.middleware';
import { requireTenantGuard } from '@shared/infra/http/middlewares/tenant-guard.middleware';
import { requirePermission } from '@shared/infra/http/middlewares/permissions.middleware';
import { ALLOWED_MEDIA_MIME_TYPES, MAX_MEDIA_UPLOAD_SIZE } from './media.dto';
import { MediaController } from './media.controller';

export const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MEDIA_UPLOAD_SIZE },
  fileFilter: (_req, file, cb) => {
    cb(null, ALLOWED_MEDIA_MIME_TYPES.includes(file.mimetype as (typeof ALLOWED_MEDIA_MIME_TYPES)[number]));
  },
});

const router = Router();
const controller = new MediaController();

router.use(authMiddleware, requireTenantGuard);

router.post('/upload', requirePermission('placas.update'), mediaUpload.single('imagem'), controller.upload.bind(controller));
router.get('/by-owner/:ownerType/:ownerId', requirePermission('placas.read'), controller.getByOwner.bind(controller));
router.post('/cleanup/orphans', requirePermission('admin.access'), controller.cleanupOrphans.bind(controller));
router.post('/cleanup/delete-pending', requirePermission('admin.access'), controller.cleanupDeletePending.bind(controller));
router.get('/:id', requirePermission('placas.read'), controller.getById.bind(controller));
router.patch('/:id/main', requirePermission('placas.update'), controller.setMain.bind(controller));
router.delete('/:id', requirePermission('placas.update'), controller.delete.bind(controller));

export default router;
