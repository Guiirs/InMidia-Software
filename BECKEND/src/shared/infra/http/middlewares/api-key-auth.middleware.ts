import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import Empresa from '@modules/empresas/Empresa';
import logger from '@shared/container/logger';
import AppError from '@shared/container/AppError';
import { createTenantContextFromApiKey, requireEmpresaId } from '../tenant/tenant-context';

/**
 * Extended request with empresa
 */
export interface IApiKeyRequest extends Request {
  empresa?: any;
}

/**
 * Middleware for API Key authentication
 * Validates "prefix_secret" format and compares with stored hash
 */
const apiKeyAuthMiddleware = async (
  req: IApiKeyRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.info('[ApiKeyAuthMiddleware] Tentando autenticar API Key...');

    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      logger.warn('[ApiKeyAuthMiddleware] Autenticação falhou: Chave de API ausente.');
      throw new AppError('Chave de API ausente.', 401);
    }

    logger.debug(`[ApiKeyAuthMiddleware] Chave recebida (prefixo parcial): ${apiKey.substring(0, 15)}...`);

    // Split prefix and secret (format: "prefix_secret")
    const parts = apiKey.split('_');
    if (parts.length < 2) {
      logger.warn('[ApiKeyAuthMiddleware] Autenticação falhou: Chave de API mal formatada.');
      throw new AppError('Chave de API mal formatada.', 403);
    }

    const apiKeySecret = parts.pop()!;
    const apiKeyPrefix = parts.join('_');

    logger.debug(`[ApiKeyAuthMiddleware] Prefixo: ${apiKeyPrefix}.`);

    // Find empresa by prefix
    logger.debug(`[ApiKeyAuthMiddleware] Buscando empresa pelo prefixo: ${apiKeyPrefix}`);
    const empresa = await Empresa.findOne({ api_key_prefix: apiKeyPrefix }).exec();

    if (!empresa) {
      logger.warn(
        `[ApiKeyAuthMiddleware] Autenticação falhou: Prefixo '${apiKeyPrefix}' não encontrado no DB.`
      );
      throw new AppError('Chave de API inválida.', 403);
    }

    // Compare secret with hash
    logger.debug('[ApiKeyAuthMiddleware] Empresa encontrada. Comparando segredo com hash...');
    
    if (!empresa.api_key_hash) {
      logger.warn('[ApiKeyAuthMiddleware] Hash da API key não encontrado.');
      throw new AppError('Chave de API inválida.', 403);
    }

    const match = await bcrypt.compare(apiKeySecret, empresa.api_key_hash);

    if (!match) {
      logger.warn(
        `[ApiKeyAuthMiddleware] Autenticação falhou: Segredo incorreto para o prefixo '${apiKeyPrefix}'.`
      );
      throw new AppError('Chave de API inválida.', 403);
    }

    // Success! Attach empresa to request
    req.empresa = empresa;
    req.tenantContext = createTenantContextFromApiKey(empresa);
    requireEmpresaId(req);

    logger.info(
      `[ApiKeyAuthMiddleware] Autenticação bem-sucedida para empresa: ${empresa.nome} (ID: ${req.tenantContext.empresaId}).`
    );
    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      logger.error(
        `[ApiKeyAuthMiddleware] ERRO INESPERADO durante a validação da API Key: ${(error as Error).message}`,
        { stack: (error as Error).stack }
      );
      next(error);
    }
  }
};

export default apiKeyAuthMiddleware;
