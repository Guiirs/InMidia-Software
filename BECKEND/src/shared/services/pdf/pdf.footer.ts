/**
 * PDF Service - Footer Renderer
 * Renderiza texto legal e assinaturas
 */

import * as constants from './pdf.constants';
import * as helpers from './pdf.helpers';
import { PDFDocumentInstance, EmpresaData, ClienteData } from './pdf.types';

export function drawFooter(
  doc: PDFDocumentInstance,
  empresa: EmpresaData,
  cliente: ClienteData,
  currentY: number
): void {
  const tableX = constants.MARGIN;
  const tableWidth = constants.PAGE_WIDTH - (constants.MARGIN * 2);
  
  // Verifica espaço
  if (!helpers.hasEnoughSpace(currentY, 150, constants.PAGE_HEIGHT, constants.MARGIN)) {
    doc.addPage({ size: 'A4', layout: 'landscape', margin: constants.MARGIN });
    currentY = constants.MARGIN;
  }
  
  // Texto legal
  doc.fontSize(constants.FONT_SIZE.SMALL).font(constants.FONT_REGULAR);
  const legalText = 'CONTRATO: Declaro que, neste ato, recebi e tomei ciência e concordei com o teor deste contrato, bem como as condições de pagamento e forma de negociação acima. Em caso de cancelamento pelo cliente, o mesmo pagará, a título de multa, a quantia de 30% do valor total acima ou proporcionalmente ao tempo restante até o término do contrato.';
  
  doc.text(legalText, tableX, currentY, { 
    width: tableWidth, 
    align: 'justify' 
  });
  currentY += 30;
  
  // Assinaturas (4 campos horizontais)
  const signWidth = (tableWidth - 30) / 4;
  
  doc.fontSize(constants.FONT_SIZE.HEADER).font(constants.FONT_REGULAR);
  
  // Linhas de assinatura
  let signY = currentY;
  for (let i = 0; i < 4; i++) {
    const xSign = tableX + (i * (signWidth + 10));
    doc.moveTo(xSign, signY).lineTo(xSign + signWidth, signY).stroke();
  }
  
  signY += 10;
  
  // Nomes
  doc.font(constants.FONT_BOLD);
  doc.text(empresa.nome, tableX, signY, { width: signWidth, align: 'center' });
  doc.text(cliente.nome, tableX + signWidth + 10, signY, { width: signWidth, align: 'center' });
  doc.text('VEÍCULO', tableX + (signWidth + 10) * 2, signY, { width: signWidth, align: 'center' });
  doc.text('CONTATO', tableX + (signWidth + 10) * 3, signY, { width: signWidth, align: 'center' });
  
  signY += 10;
  
  // Labels
  doc.font(constants.FONT_REGULAR).fontSize(constants.FONT_SIZE.SMALL);
  doc.text('AGÊNCIA / CONTRATADA', tableX, signY, { width: signWidth, align: 'center' });
  doc.text('ANUNCIANTE / CONTRATANTE', tableX + signWidth + 10, signY, { width: signWidth, align: 'center' });
  doc.text('VEÍCULO / GERÊNCIA', tableX + (signWidth + 10) * 2, signY, { width: signWidth, align: 'center' });
  doc.text('CONTATO / APROVAÇÃO', tableX + (signWidth + 10) * 3, signY, { width: signWidth, align: 'center' });
}
