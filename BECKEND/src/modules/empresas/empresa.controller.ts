/**
 * Empresa Controller
 * Camada HTTP com Result pattern
 */

import { Request, Response } from 'express';
import { Log } from '@shared/core';
import { getErrorStatusCode } from '@shared/core';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import Empresa from './Empresa';
import User from '@modules/users/User';
import type { EmpresaService } from './services/empresa.service';
import type { IAuthRequest } from '../../types/express';

export class EmpresaController {
  
  constructor(private readonly service: EmpresaService) {}

  private isAdminRole(role?: string): boolean {
    const normalizedRole = String(role || '').trim().toLowerCase();
    return normalizedRole === 'admin' || normalizedRole === 'superadmin';
  }

  /**
   * GET /empresas/api-key
   * Busca API Key da empresa
   */
  getApiKey = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as IAuthRequest;
      const empresaId = authReq.user?.empresaId;
      const userRole = authReq.user?.role;

      if (!empresaId) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      if (!this.isAdminRole(userRole)) {
        res.status(403).json({
          success: false,
          error: 'Apenas administradores podem visualizar a API Key',
          code: 'FORBIDDEN'
        });
        return;
      }

      const empresa = await Empresa.findById(empresaId)
        .select('api_key_prefix apiKey')
        .lean()
        .exec();

      if (!empresa) {
        res.status(404).json({
          success: false,
          error: 'Empresa não encontrada',
          code: 'EMPRESA_NOT_FOUND'
        });
        return;
      }

      const apiKeyPrefix = (empresa as any).api_key_prefix || (empresa as any).apiKey || null;

      res.status(200).json({
        success: true,
        data: { apiKeyPrefix }
      });

    } catch (error) {
      Log.error('[EmpresaController] Erro ao buscar API Key', { error });
      res.status(500).json({
        success: false,
        error: 'Erro interno ao buscar API Key',
        code: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * POST /empresas/api-key/regenerate
   * Regenera API Key da empresa
   */
  regenerateApiKey = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as IAuthRequest;
      const empresaId = authReq.user?.empresaId;
      const userId = authReq.user?.id;
      const userRole = authReq.user?.role;
      const { password } = req.body || {};

      if (!empresaId) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      if (!this.isAdminRole(userRole)) {
        res.status(403).json({
          success: false,
          error: 'Apenas administradores podem regenerar a API Key',
          code: 'FORBIDDEN'
        });
        return;
      }

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      if (!password) {
        res.status(400).json({
          success: false,
          error: 'Senha atual é obrigatória para regenerar a API Key',
          code: 'REQUIRED_FIELD'
        });
        return;
      }

      const user = await User.findById(userId).select('+senha +password empresa').lean().exec();

      if (!user) {
        res.status(404).json({
          success: false,
          error: 'Usuário não encontrado',
          code: 'USER_NOT_FOUND'
        });
        return;
      }

      const userEmpresaId = String((user as any).empresa || (user as any).empresaId || '');
      if (userEmpresaId !== String(empresaId)) {
        res.status(403).json({
          success: false,
          error: 'Usuário não pertence à empresa informada',
          code: 'FORBIDDEN'
        });
        return;
      }

      const senhaHash = (user as any).senha || (user as any).password;
      const passwordMatch = senhaHash ? await bcrypt.compare(password, senhaHash) : false;

      if (!passwordMatch) {
        res.status(401).json({
          success: false,
          error: 'Senha incorreta',
          code: 'INVALID_CREDENTIALS'
        });
        return;
      }

      const empresa = await Empresa.findById(empresaId).exec();

      if (!empresa) {
        res.status(404).json({
          success: false,
          error: 'Empresa não encontrada',
          code: 'EMPRESA_NOT_FOUND'
        });
        return;
      }

      const prefixBase = String((empresa as any).nome || 'emp')
        .substring(0, 4)
        .toLowerCase()
        .replace(/[^a-z]/g, '') || 'emp';
      const uuidPrefix = uuidv4().split('-')[0] || 'key0';
      const apiKeyPrefix = `${prefixBase}_${uuidPrefix.substring(0, 4)}`;
      const apiKeySecret = uuidv4();
      const apiKey = `${apiKeyPrefix}_${apiKeySecret}`;

      (empresa as any).api_key_prefix = apiKeyPrefix;
      (empresa as any).api_key_hash = await bcrypt.hash(apiKeySecret, 10);
      (empresa as any).apiKey = undefined;
      await empresa.save();

      res.status(200).json({
        success: true,
        message: 'API Key regenerada com sucesso',
        data: { apiKey, apiKeyPrefix }
      });

    } catch (error) {
      Log.error('[EmpresaController] Erro ao regenerar API Key', { error });
      res.status(500).json({
        success: false,
        error: 'Erro interno ao regenerar API Key',
        code: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * GET /empresas/details
   * Busca detalhes da empresa com cache
   */
  getEmpresaDetails = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as IAuthRequest;
      const empresaId = authReq.user?.empresaId;

      if (!empresaId) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      const result = await this.service.getEmpresaDetails(empresaId.toString());

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
      Log.error('[EmpresaController] Erro ao buscar detalhes da empresa', { error });
      res.status(500).json({
        success: false,
        error: 'Erro interno ao buscar detalhes',
        code: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * PATCH /empresas/details
   * Atualiza detalhes da empresa
   */
  updateEmpresaDetails = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as IAuthRequest;
      const empresaId = authReq.user?.empresaId;

      if (!empresaId) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      const result = await this.service.updateEmpresaDetails(
        empresaId.toString(),
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
        message: 'Empresa atualizada com sucesso',
        data: result.value
      });

    } catch (error) {
      Log.error('[EmpresaController] Erro ao atualizar empresa', { error });
      res.status(500).json({
        success: false,
        error: 'Erro interno ao atualizar empresa',
        code: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * POST /empresas/register
   * Registra uma nova empresa com usuário admin
   */
  register = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.service.registerEmpresa(req.body, req.body);

      if (result.isFailure) {
        const statusCode = getErrorStatusCode(result.error);
        res.status(statusCode).json({
          success: false,
          error: result.error.message,
          code: result.error.code
        });
        return;
      }

      res.status(201).json({
        success: true,
        message: 'Empresa registada com sucesso',
        data: result.value
      });

    } catch (error) {
      Log.error('[EmpresaController] Erro ao registar empresa', { error });
      res.status(500).json({
        success: false,
        error: 'Erro interno ao registar empresa',
        code: 'INTERNAL_ERROR'
      });
    }
  };
}


