/**
 * PDF Service - Main Generator
 * Orquestra a geração completa do PDF
 */

import PDFDocument from 'pdfkit';
import { Response } from 'express';
import logger from '../../container/logger';
import * as constants from './pdf.constants';
import { drawHorizontalHeader } from './pdf.header';
import { drawProgramacaoTable } from './pdf.programacao';
import { drawTotalizacao } from './pdf.totalizacao';
import { drawFooter } from './pdf.footer';
import { TipoDocumento, PIData, ClienteData, EmpresaData, UserData, ContratoData } from './pdf.types';

/**
 * Gera PDF dinâmico (streaming para Response)
 */
export function generateDynamicPDF(
  res: Response,
  pi: PIData,
  cliente: ClienteData,
  empresa: EmpresaData,
  user: UserData,
  tipoDoc: TipoDocumento,
  contrato?: ContratoData
): void {
  const docId = (tipoDoc === 'PI' ? pi._id : contrato?._id || 'unknown').toString();
  const filename = `${tipoDoc}_${docId}_${cliente.nome.replace(/\s+/g, '_')}.pdf`;
  
  logger.info(`[PdfService] Gerando ${filename} em LANDSCAPE (horizontal)`);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const doc = new PDFDocument({ 
    size: 'A4', 
    layout: 'landscape',
    margin: constants.MARGIN 
  });
  
  doc.pipe(res);

  try {
    let currentY = drawHorizontalHeader(doc, tipoDoc, docId, empresa, cliente, pi, user);
    currentY = drawProgramacaoTable(doc, pi, currentY);
    currentY = drawTotalizacao(doc, pi, currentY);
    drawFooter(doc, empresa, cliente, currentY);

    doc.end();
    logger.info(`[PdfService] PDF ${filename} gerado com sucesso em LANDSCAPE`);
    
  } catch (error: any) {
    logger.error(`[PdfService] Erro ao gerar PDF: ${error.message}`, { stack: error.stack });
    doc.end();
    throw error;
  }
}

/**
 * Gera PDF dinâmico em Buffer (para queue system)
 */
export function generateDynamicPDF_Buffer(
  pi: PIData,
  cliente: ClienteData,
  empresa: EmpresaData,
  user: UserData,
  tipoDoc: TipoDocumento,
  contrato?: ContratoData
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const docId = (tipoDoc === 'PI' ? pi._id : contrato?._id || 'unknown').toString();
    const filename = `${tipoDoc}_${docId}_${cliente.nome.replace(/\s+/g, '_')}.pdf`;

    logger.info(`[PdfService] Gerando ${filename} em buffer (LANDSCAPE)`);

    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: constants.MARGIN
    });

    const buffers: Buffer[] = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const buffer = Buffer.concat(buffers);
      logger.info(`[PdfService] PDF ${filename} gerado com sucesso em buffer`);
      resolve(buffer);
    });
    doc.on('error', (error: Error) => {
      logger.error(`[PdfService] Erro ao gerar PDF em buffer: ${error.message}`);
      reject(error);
    });

    try {
      let currentY = drawHorizontalHeader(doc, tipoDoc, docId, empresa, cliente, pi, user);
      currentY = drawProgramacaoTable(doc, pi, currentY);
      currentY = drawTotalizacao(doc, pi, currentY);
      drawFooter(doc, empresa, cliente, currentY);

      doc.end();
    } catch (error: any) {
      logger.error(`[PdfService] Erro ao gerar PDF: ${error.message}`, { stack: error.stack });
      doc.end();
      reject(error);
    }
  });
}
