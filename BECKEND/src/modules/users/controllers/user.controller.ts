/**
 * User Controller
 * Camada HTTP com Result pattern
 */

import { Request, Response } from 'express';
import { Log } from '@shared/core';
import { getErrorStatusCode } from '@shared/core';
import type { UserService } from '../services/user.service';
import type { IAuthRequest } from '../../../types/express';

export class UserController {
  
  constructor(private readonly service: UserService) {}

  /**
   * GET /user/profile
   * Busca perfil do usuário autenticado
   */
  getProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as IAuthRequest;
      const userId = authReq.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      const result = await this.service.getUserProfile(userId.toString());

      if (result.isFailure) {
        const statusCode = getErrorStatusCode(result.error);
        res.status(statusCode).json({
          success: false,
          error: result.error.message,
          code: result.error.code
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.value
      });

    } catch (error) {
      Log.error('[UserController] Erro ao buscar perfil', { error });
      res.status(500).json({
        success: false,
        error: 'Erro interno ao buscar perfil',
        code: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * PATCH /user/profile
   * Atualiza perfil do usuário autenticado
   */
  updateProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as IAuthRequest;
      const userId = authReq.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      const result = await this.service.updateProfile(
        userId.toString(),
        req.body
      );

      if (result.isFailure) {
        const statusCode = getErrorStatusCode(result.error);
        res.status(statusCode).json({
          success: false,
          error: result.error.message,
          code: result.error.code
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Perfil atualizado com sucesso',
        data: result.value
      });

    } catch (error) {
      Log.error('[UserController] Erro ao atualizar perfil', { error });
      res.status(500).json({
        success: false,
        error: 'Erro interno ao atualizar perfil',
        code: 'INTERNAL_ERROR'
      });
    }
  };
}
