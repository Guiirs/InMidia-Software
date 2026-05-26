/**
 * Client V4.1 Routes — /api/v4/clients
 */

import { Router, Request, Response, NextFunction } from 'express';
import { param } from 'express-validator';
import { handleValidationErrors } from '@modules/auth/authValidator';
import authenticateToken from '@shared/infra/http/middlewares/auth.middleware';
import { requirePermission } from '@shared/infra/http/middlewares/permissions.middleware';
import { ClientController } from './client.controller';
import { ClientService } from './client.service';
import { ClientRepository } from './client.repository';
import { IAuthRequest } from '../../types/express.d';

type AuthReq = Request & IAuthRequest;

const router = Router();

const clientRepository = new ClientRepository();
const clientService    = new ClientService(clientRepository);
const clientController = new ClientController(clientService);

const validateId = [
  param('id').isMongoId().withMessage('ID de cliente inválido'),
  handleValidationErrors,
];

router.use(authenticateToken);

// Search must be before /:id to avoid "search" being treated as an ObjectId
router.get(
  '/search',
  requirePermission('clients.read'),
  (req: AuthReq, res: Response, next: NextFunction) => clientController.search(req, res, next)
);

router.get(
  '/',
  requirePermission('clients.read'),
  (req: AuthReq, res: Response, next: NextFunction) => clientController.list(req, res, next)
);

router.get(
  '/:id',
  requirePermission('clients.read'),
  validateId,
  (req: AuthReq, res: Response, next: NextFunction) => clientController.getById(req, res, next)
);

router.get(
  '/:id/timeline',
  requirePermission('clients.read'),
  validateId,
  (req: AuthReq, res: Response, next: NextFunction) => clientController.timeline(req, res, next)
);

router.post(
  '/',
  requirePermission('clients.create'),
  (req: AuthReq, res: Response, next: NextFunction) => clientController.create(req, res, next)
);

router.patch(
  '/:id',
  requirePermission('clients.update'),
  validateId,
  (req: AuthReq, res: Response, next: NextFunction) => clientController.update(req, res, next)
);

router.post(
  '/:id/archive',
  requirePermission('clients.archive'),
  validateId,
  (req: AuthReq, res: Response, next: NextFunction) => clientController.archive(req, res, next)
);

router.post(
  '/:id/restore',
  requirePermission('clients.archive'),
  validateId,
  (req: AuthReq, res: Response, next: NextFunction) => clientController.restore(req, res, next)
);

export default router;
