import express from 'express';
import * as controller from './controller';
import authenticateToken from '../shared/infra/http/middlewares/auth.middleware';

const router = express.Router();

// Protegido: usuário autenticado
router.post('/generate', authenticateToken, controller.postGenerate);
router.get('/status/:jobId', authenticateToken, controller.getStatus);

export default router;
