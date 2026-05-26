/**
 * Sistema de Exports Globais da API
 * Centraliza todos os serviços, modelos, utilitários e configurações
 */

// ============================================
// MODELOS
// ============================================

import Aluguel from '@modules/alugueis/Aluguel';
import Cliente from '@modules/clientes/Cliente';
import Contrato from '@modules/contratos/Contrato';
import Empresa from '@modules/empresas/Empresa';
import Placa from '@modules/placas/Placa';
import PropostaInterna from '@modules/propostas-internas/PropostaInterna';
import Regiao from '@modules/regioes/Regiao';
import User from '@modules/users/User';
import BiWeek from '@modules/biweeks/BiWeek';

export const Models = {
  Aluguel,
  Cliente,
  Contrato,
  Empresa,
  Placa,
  PropostaInterna,
  Regiao,
  User,
  BiWeek
};

// ============================================
// SERVIÇOS
// ============================================

import { ClienteService } from '@modules/clientes/cliente.service';
import { PlacaService } from '@modules/placas/placa.service';
import ContratoService from '@modules/contratos/contrato.service';

export const Services = {
  ClienteService: new ClienteService(),
  PlacaService: new PlacaService(),
  ContratoService: new ContratoService()
};

// ============================================
// UTILITÁRIOS
// ============================================

import AppError from '@shared/container/AppError';
import logger from '@shared/container/logger';

export { AppError, logger };

// ============================================
// CONFIGURAÇÕES
// ============================================

export const Config = {
  // Paginação
  pagination: {
    defaultLimit: 10,
    maxLimit: 100,
    defaultPage: 1
  },
  
  // Upload
  upload: {
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    allowedDocTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    maxImages: 10
  },
  
  // Cache
  cache: {
    defaultTTL: 3600, // 1 hora
    shortTTL: 300, // 5 minutos
    longTTL: 86400 // 24 horas
  },
  
  // JWT
  jwt: {
    expiresIn: '7d',
    refreshExpiresIn: '30d'
  },
  
  // Rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100 // Limite de requisições
  }
};

// ============================================
// HELPERS GLOBAIS
// ============================================

/**
 * Normaliza parâmetros de paginação
 */
export const normalizePagination = (page?: string | number, limit?: string | number) => {
  const pageInt = Math.max(1, parseInt(String(page || 1), 10) || 1);
  const limitInt = Math.min(
    Config.pagination.maxLimit,
    Math.max(1, parseInt(String(limit || Config.pagination.defaultLimit), 10) || Config.pagination.defaultLimit)
  );
  const skip = (pageInt - 1) * limitInt;
  
  return { page: pageInt, limit: limitInt, skip };
};

/**
 * Cria resposta de sucesso padronizada
 */
export const successResponse = <T = any>(data: T, message?: string) => {
  return {
    success: true,
    message: message || 'Operação realizada com sucesso',
    data
  };
};

/**
 * Cria resposta de erro padronizada
 */
export const errorResponse = (message: string, statusCode: number = 500, details?: any) => {
  return {
    success: false,
    message,
    statusCode,
    details
  };
};

/**
 * Trata erros do Mongoose
 */
export const handleMongooseError = (error: any): { message: string; statusCode: number } => {
  // Erro de validação
  if (error.name === 'ValidationError') {
    const messages = Object.values(error.errors).map((err: any) => err.message);
    return {
      message: `Erro de validação: ${messages.join(', ')}`,
      statusCode: 400
    };
  }
  
  // Erro de duplicação (unique constraint)
  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern || {})[0];
    return {
      message: `Já existe um registro com este ${field}`,
      statusCode: 409
    };
  }
  
  // Erro de cast (ObjectId inválido)
  if (error.name === 'CastError') {
    return {
      message: 'ID inválido fornecido',
      statusCode: 400
    };
  }
  
  return {
    message: error.message || 'Erro interno do servidor',
    statusCode: 500
  };
};

/**
 * Sanitiza dados de entrada (remove campos não permitidos)
 */
export const sanitizeInput = <T extends Record<string, any>>(
  data: T,
  allowedFields: (keyof T)[]
): Partial<T> => {
  const sanitized: Partial<T> = {};
  
  allowedFields.forEach(field => {
    if (data[field] !== undefined) {
      sanitized[field] = data[field];
    }
  });
  
  return sanitized;
};

/**
 * Remove campos undefined de um objeto
 */
export const removeUndefined = <T extends Record<string, any>>(obj: T): Partial<T> => {
  const cleaned: Partial<T> = {};
  
  Object.keys(obj).forEach(key => {
    if (obj[key] !== undefined) {
      cleaned[key as keyof T] = obj[key];
    }
  });
  
  return cleaned;
};

/**
 * Valida ObjectId
 */
export const validateObjectId = (id: string, fieldName: string = 'ID'): void => {
  const { Types } = require('mongoose');
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(`${fieldName} inválido`, 400);
  }
};

/**
 * Valida array de ObjectIds
 */
export const validateObjectIds = (ids: string[], fieldName: string = 'IDs'): void => {
  const { Types } = require('mongoose');
  const invalid = ids.filter(id => !Types.ObjectId.isValid(id));
  
  if (invalid.length > 0) {
    throw new AppError(`${fieldName} inválidos: ${invalid.join(', ')}`, 400);
  }
};

/**
 * Formata data para padrão brasileiro
 */
export const formatDateBR = (date: Date | string): string => {
  const d = new Date(date);
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

/**
 * Formata data e hora para padrão brasileiro
 */
export const formatDateTimeBR = (date: Date | string): string => {
  const d = new Date(date);
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Formata valor monetário
 */
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

/**
 * Gera código único
 */
export const generateUniqueCode = (prefix: string = ''): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}${timestamp}${random}`;
};

/**
 * Sleep assíncrono
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Retry com exponential backoff
 */
export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> => {
  let lastError: any;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i);
        logger.warn(`Tentativa ${i + 1} falhou. Tentando novamente em ${delay}ms...`);
        await sleep(delay);
      }
    }
  }
  
  throw lastError;
};

/**
 * Chunking de arrays
 */
export const chunkArray = <T>(array: T[], chunkSize: number): T[][] => {
  const chunks: T[][] = [];
  
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  
  return chunks;
};

/**
 * Remove acentos de string
 */
export const removeAccents = (str: string): string => {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
};

/**
 * Slug generator
 */
export const generateSlug = (str: string): string => {
  return removeAccents(str)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

/**
 * Valida período de datas
 */
export const validateDateRange = (startDate: Date, endDate: Date): void => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (start >= end) {
    throw new AppError('A data de início deve ser anterior à data de fim', 400);
  }
};

/**
 * Calcula diferença em dias
 */
export const daysDifference = (startDate: Date, endDate: Date): number => {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
};

// ============================================
// MIDDLEWARE HELPERS
// ============================================

/**
 * Wrapper para async controllers
 */
export const asyncHandler = (fn: Function) => {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Valida campos obrigatórios
 */
export const validateRequiredFields = (data: Record<string, any>, fields: string[]): void => {
  const missing = fields.filter(field => !data[field]);
  
  if (missing.length > 0) {
    throw new AppError(`Campos obrigatórios ausentes: ${missing.join(', ')}`, 400);
  }
};

/**
 * Extrai empresaId do request
 */
export const extractEmpresaId = (req: any): string => {
  const empresaId = req.user?.empresaId || req.empresaId || req.headers['x-empresa-id'];
  
  if (!empresaId) {
    throw new AppError('EmpresaId não encontrado', 401);
  }
  
  validateObjectId(empresaId, 'EmpresaId');
  return empresaId;
};

// ============================================
// EXPORTS GERAIS
// ============================================

export * from '@shared/types';
