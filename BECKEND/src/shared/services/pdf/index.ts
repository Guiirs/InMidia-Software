/**
 * PDF Service - Main Entry Point
 * Exporta funções públicas do serviço de PDF
 */

import { Response } from 'express';
import { generateDynamicPDF, generateDynamicPDF_Buffer } from './pdf.generator';

/**
 * Gera PDF de Proposta Interna (streaming)
 */
export const generatePI_PDF = function(res: Response, pi: any, cliente: any, empresa: any, user: any): void {
  generateDynamicPDF(res, pi, cliente, empresa, user, 'PI');
};

/**
 * Gera PDF de Contrato (streaming)
 */
export const generateContrato_PDF = function(res: Response, contrato: any, pi: any, cliente: any, empresa: any): void {
  const dummyUser = { _id: '', username: '', nome: 'Sistema', sobrenome: '', email: '' };
  generateDynamicPDF(res, pi, cliente, empresa, dummyUser, 'Contrato', contrato);
};

/**
 * Gera PDF de Proposta Interna (buffer para queue)
 */
export const generatePI_PDF_Buffer = function(pi: any, cliente: any, empresa: any, user: any): Promise<Buffer> {
  return generateDynamicPDF_Buffer(pi, cliente, empresa, user, 'PI');
};

/**
 * Gera PDF de Contrato (buffer para queue)
 */
export const generateContrato_PDF_Buffer = function(
  pi: any,
  cliente: any,
  empresa: any,
  user: any,
  _options: any = {}
): Promise<Buffer> {
  const userWithDefaults = user || { _id: '', username: '', nome: 'Sistema', sobrenome: '', email: '' };
  return generateDynamicPDF_Buffer(pi, cliente, empresa, userWithDefaults, 'PI');
};

export default {
  generatePI_PDF,
  generateContrato_PDF,
  generatePI_PDF_Buffer,
  generateContrato_PDF_Buffer
};
