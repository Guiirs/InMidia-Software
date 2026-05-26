import { Request, Response, NextFunction } from 'express';
import { IAuthRequest } from '../../../types/express.d';
import { FeaturesV4Service } from '../services/features-v4.service';

export class FeaturesV4Controller {
  constructor(private readonly service: FeaturesV4Service) {}

  getFlags = async (req: Request & IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.user?.empresaId;
      if (!tenantId) {
        res.status(401).json({ success: false, code: 'AUTH_REQUIRED', message: 'Usuário não autenticado.' });
        return;
      }
      const flags = this.service.getFlags(String(tenantId));
      res.status(200).json({ success: true, data: flags });
    } catch (err) {
      next(err);
    }
  };
}
